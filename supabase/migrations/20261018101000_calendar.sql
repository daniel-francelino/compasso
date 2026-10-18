begin;

create function public.calendar_range_ok(p_from timestamptz, p_to timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from is not null and p_to is not null and p_to > p_from
    and p_to - p_from <= interval '100 days'
$$;

create function public.content_item_is_ready(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_variants v
    where v.content_item_id = p_item and v.editorial_status <> 'cancelled'
  ) and not exists (
    select 1 from public.content_variants v
    where v.content_item_id = p_item and v.editorial_status not in ('approved', 'cancelled')
  )
$$;

create function public.notification_date_text(p_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select extract(day from p_date)::int || ' de ' || (array[
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ])[extract(month from p_date)::int]
$$;

create function public.list_calendar_entries(
  p_from timestamptz,
  p_to timestamptz,
  p_brands uuid[] default null,
  p_channels uuid[] default null,
  p_assignee uuid default null,
  p_editorial text[] default null,
  p_publication text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('calendar.view');
  if not public.calendar_range_ok(p_from, p_to) then
    raise exception 'invalid_input';
  end if;

  return (
    with base as (
      select
        v.id as variant_id, i.id as item_id, v.planned_at, v.published_at, v.publication_status,
        i.production_due_date, b.timezone as brand_timezone,
        jsonb_build_object(
          'variant_id', v.id, 'item_id', i.id, 'title', i.title, 'brand_id', b.id,
          'brand_name', b.name, 'brand_timezone', b.timezone, 'channel_id', c.id,
          'platform', c.platform, 'profile_name', c.profile_name, 'format', v.format,
          'editorial_status', v.editorial_status, 'publication_status', v.publication_status,
          'planned_timezone', v.planned_timezone, 'version', v.version, 'item_version', i.version,
          'assignee_id', i.assignee_id,
          'assignee_name', (select p.full_name from public.profiles p where p.id = i.assignee_id),
          'channel_archived', c.archived_at is not null
        ) as common
      from public.content_variants v
      join public.content_items i on i.id = v.content_item_id
      join public.brands b on b.id = v.brand_id
      join public.channels c on c.id = v.channel_id
      where v.editorial_status <> 'cancelled' and i.cancelled_at is null
        and public.can_access_brand(v.brand_id)
        and (p_brands is null or v.brand_id = any (p_brands))
        and (p_channels is null or v.channel_id = any (p_channels))
        and (p_assignee is null or i.assignee_id = p_assignee)
        and (p_editorial is null or v.editorial_status = any (p_editorial))
        and (p_publication is null or v.publication_status = any (p_publication))
    ),
    entries as (
      select x.*, row_number() over (order by x.sort_at, x.kind, x.ref) as rn
      from (
        select
          s.common || jsonb_build_object('kind', 'publication', 'at', s.planned_at) as obj,
          s.planned_at as sort_at, 'publication' as kind, s.variant_id::text as ref
        from base s
        where s.publication_status = 'planned' and s.planned_at >= p_from and s.planned_at < p_to
        union all
        select
          s.common || jsonb_build_object('kind', 'published', 'at', s.published_at),
          s.published_at, 'published', s.variant_id::text
        from base s
        where s.publication_status = 'published_manually'
          and s.published_at >= p_from and s.published_at < p_to
        union all
        select
          s.common || jsonb_build_object('kind', 'approval_deadline', 'date', q.due_date, 'request_id', q.id),
          (q.due_date::timestamp at time zone s.brand_timezone), 'approval_deadline', s.variant_id::text
        from base s
        join public.approval_requests q on q.variant_id = s.variant_id and q.status = 'pending'
        where q.due_date is not null
          and q.due_date >= (p_from at time zone s.brand_timezone)::date
          and q.due_date <= ((p_to - interval '1 second') at time zone s.brand_timezone)::date
        union all
        select
          d.common || jsonb_build_object('kind', 'production_deadline', 'date', d.production_due_date,
            'variant_id', null, 'channel_id', null, 'platform', null, 'profile_name', null,
            'format', null, 'editorial_status', null, 'publication_status', null,
            'planned_timezone', null, 'version', null, 'channel_archived', false),
          (d.production_due_date::timestamp at time zone d.brand_timezone), 'production_deadline',
          d.item_id::text
        from (
          select distinct on (s.item_id) s.*
          from base s
          where s.production_due_date >= (p_from at time zone s.brand_timezone)::date
            and s.production_due_date <= ((p_to - interval '1 second') at time zone s.brand_timezone)::date
          order by s.item_id, s.variant_id
        ) d
      ) x
      order by x.sort_at, x.kind, x.ref
      limit 501
    )
    select jsonb_build_object(
      'entries', coalesce((select jsonb_agg(e.obj order by e.rn) from entries e where e.rn <= 500), '[]'::jsonb),
      'truncated', (select count(*) > 500 from entries),
      'undated', coalesce(
        (
          select jsonb_agg(u.common order by u.title)
          from (
            select s.common, s.common ->> 'title' as title
            from base s
            where s.planned_at is null and s.publication_status = 'unplanned'
            order by s.common ->> 'title'
            limit 100
          ) u
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

create function public.reschedule_variant(
  p_variant uuid,
  p_planned_at timestamptz,
  p_timezone text,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_tz text := nullif(btrim(coalesce(p_timezone, '')), '');
  v_variant public.content_variants;
  v_item public.content_items;
  v_channel public.channels;
  v_brand public.brands;
  v_current public.content_revisions;
  v_prev public.approval_requests;
  v_revision uuid;
  v_request uuid;
  v_due date;
  v_no int;
  v_version int;
begin
  perform public.assert_action('calendar.manage');
  perform public.assert_action('content.update');
  if p_planned_at is null or v_tz is null or not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz
  ) then
    raise exception 'invalid_input';
  end if;

  select * into v_variant from public.content_variants v where v.id = p_variant for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_variant.brand_id);
  if p_expected_version is null or p_expected_version <> v_variant.version then
    raise exception 'conflict';
  end if;
  if v_variant.editorial_status = 'cancelled' or v_variant.publication_status = 'published_manually' then
    raise exception 'transition_not_allowed';
  end if;

  select * into v_item from public.content_items i where i.id = v_variant.content_item_id;
  select * into v_channel from public.channels c where c.id = v_variant.channel_id;
  select * into v_brand from public.brands b where b.id = v_variant.brand_id;
  if v_item.cancelled_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  if v_channel.archived_at is not null then
    raise exception 'channel_archived';
  end if;

  if v_variant.editorial_status not in ('awaiting_approval', 'approved') then
    update public.content_variants
    set planned_at = p_planned_at, planned_timezone = v_tz, publication_status = 'planned',
        version = version + 1
    where id = p_variant
    returning version into v_version;
    perform public.audit_write(
      v_org, v_variant.brand_id, 'variant.rescheduled', 'content_variant', p_variant,
      jsonb_build_object('from', v_variant.planned_at, 'to', p_planned_at, 'resubmitted', false)
    );
    return jsonb_build_object('id', p_variant, 'version', v_version, 'resubmitted', false);
  end if;

  select * into v_current from public.content_revisions r where r.id = v_variant.current_revision_id;
  select * into v_prev from public.approval_requests q
  where q.variant_id = p_variant and q.revision_id = v_variant.current_revision_id
  order by q.requested_at desc limit 1 for update;
  if v_current.id is null or v_prev.id is null then
    raise exception 'transition_not_allowed';
  end if;
  if not public.approver_is_valid(v_variant.brand_id, v_prev.approver_user_id) then
    raise exception 'approver_without_access';
  end if;

  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.content_revisions r where r.variant_id = p_variant;

  insert into public.content_revisions (variant_id, brand_id, revision_no, snapshot, created_by)
  values (
    p_variant, v_variant.brand_id, v_no,
    v_current.snapshot || jsonb_build_object('planned_at', p_planned_at, 'planned_timezone', v_tz),
    auth.uid()
  )
  returning id into v_revision;

  insert into public.content_revision_media (revision_id, media_version_id, position, alt_text)
  select v_revision, m.media_version_id, m.position, m.alt_text
  from public.content_revision_media m where m.revision_id = v_current.id;

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id, alt_text)
  select m.media_version_id, 'content_revision', v_revision, m.alt_text
  from public.content_revision_media m where m.revision_id = v_revision
  on conflict do nothing;

  if v_prev.status = 'pending' then
    update public.approval_requests set status = 'superseded', decided_at = now() where id = v_prev.id;
    perform public.resolve_notifications('approval_request', v_prev.id);
  end if;

  v_due := case
    when v_prev.due_date >= (now() at time zone v_brand.timezone)::date then v_prev.due_date
    else null
  end;

  insert into public.approval_requests (
    brand_id, variant_id, revision_id, approver_user_id, requested_by, due_date
  )
  values (v_variant.brand_id, p_variant, v_revision, v_prev.approver_user_id, auth.uid(), v_due)
  returning id into v_request;

  if v_variant.editorial_status = 'approved' then
    update public.content_variants
    set editorial_status = 'in_production', approved_revision_id = null
    where id = p_variant;
  end if;

  update public.content_variants
  set editorial_status = 'awaiting_approval', current_revision_id = v_revision,
      approved_revision_id = null, planned_at = p_planned_at, planned_timezone = v_tz,
      publication_status = 'planned', approval_due_date = v_due, version = version + 1
  where id = p_variant
  returning version into v_version;

  perform public.audit_write(
    v_org, v_variant.brand_id, 'variant.rescheduled', 'content_variant', p_variant,
    jsonb_build_object(
      'from', v_variant.planned_at, 'to', p_planned_at, 'resubmitted', true,
      'revision_no', v_no, 'request_id', v_request
    )
  );
  perform public.audit_write(
    v_org, v_variant.brand_id, 'approval.requested', 'approval_request', v_request,
    jsonb_build_object('approver_id', v_prev.approver_user_id, 'revision_id', v_revision)
  );

  if v_prev.status = 'pending' then
    perform public.audit_write(
      v_org, v_variant.brand_id, 'approval.superseded', 'approval_request', v_prev.id,
      jsonb_build_object('replaced_by', v_request)
    );
    perform public.notify_users(
      'approval.superseded', v_variant.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_variant.brand_id || '/approvals/' || v_request,
      'approval_request', v_prev.id, 'approval.superseded:' || v_prev.id,
      array[v_prev.approver_user_id]
    );
  end if;

  perform public.notify_users(
    'approval.requested', v_variant.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_channel.profile_name),
    '/portal/brands/' || v_variant.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    array[v_prev.approver_user_id]
  );

  return jsonb_build_object(
    'id', p_variant, 'version', v_version, 'resubmitted', true, 'request_id', v_request,
    'revision_no', v_no
  );
end;
$$;

create function public.reschedule_production_deadline(
  p_item uuid,
  p_date date,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_version int;
begin
  perform public.assert_action('calendar.manage');
  perform public.assert_action('content.update');
  if p_date is null then
    raise exception 'invalid_input';
  end if;
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if p_expected_version is null or p_expected_version <> v_item.version then
    raise exception 'conflict';
  end if;
  if v_item.cancelled_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  update public.content_items
  set production_due_date = p_date, version = version + 1
  where id = p_item
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.updated', 'content_item', p_item,
    jsonb_build_object('field', 'production_due_date')
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;

create function public.portal_list_calendar(p_brand uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.portal_assert_member(p_brand);
  if not public.calendar_range_ok(p_from, p_to) then
    raise exception 'invalid_input';
  end if;
  return jsonb_build_object(
    'brand_timezone', (select b.timezone from public.brands b where b.id = p_brand),
    'entries', coalesce(
    (
      select jsonb_agg(l.obj order by l.at, l.request_id)
      from (
        select
          (r.snapshot ->> 'planned_at')::timestamptz as at,
          q.id as request_id,
          jsonb_build_object(
            'request_id', q.id, 'status', q.status, 'title', r.snapshot ->> 'title',
            'platform', r.snapshot -> 'channel' ->> 'platform',
            'profile_name', r.snapshot -> 'channel' ->> 'profile_name',
            'planned_at', r.snapshot ->> 'planned_at',
            'planned_timezone', r.snapshot ->> 'planned_timezone',
            'brand_timezone', r.snapshot ->> 'brand_timezone',
            'is_mine', q.approver_user_id = auth.uid()
          ) as obj
        from (
          select distinct on (q2.variant_id) q2.*
          from public.approval_requests q2
          join public.content_variants v on v.id = q2.variant_id
          where q2.brand_id = p_brand and q2.status <> 'cancelled'
            and v.editorial_status <> 'cancelled'
          order by q2.variant_id, q2.requested_at desc
        ) q
        join public.content_revisions r on r.id = q.revision_id
        where r.snapshot ->> 'planned_at' is not null
          and (r.snapshot ->> 'planned_at')::timestamptz >= p_from
          and (r.snapshot ->> 'planned_at')::timestamptz < p_to
      ) l
    ),
    '[]'::jsonb
    )
  );
end;
$$;

create function public.notify_scan_content()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_lead int[];
  v_first int;
  v_step int;
  v_when text;
begin
  for v_row in
    select q.id, q.brand_id, q.requested_by, q.due_date, i.title,
      ((now() at time zone b.timezone)::date - q.due_date) as days_late
    from public.approval_requests q
    join public.content_variants v on v.id = q.variant_id
    join public.content_items i on i.id = v.content_item_id
    join public.brands b on b.id = q.brand_id
    where q.status = 'pending' and q.due_date is not null and q.requested_by is not null
      and q.due_date < (now() at time zone b.timezone)::date
  loop
    v_lead := coalesce(public.notification_lead_days(v_row.requested_by, 'approval.overdue'), array[1, 2]);
    v_first := coalesce(v_lead[1], 1);
    v_step := greatest(coalesce(v_lead[2], 2), 1);
    if v_row.days_late >= v_first and (v_row.days_late - v_first) % v_step = 0 then
      perform public.notify_users(
        'approval.overdue', v_row.brand_id, 'Aprovação atrasada',
        format('A aprovação de «%s» está pendente desde %s.', v_row.title,
          public.notification_date_text(v_row.due_date)),
        '/admin/marketing/approvals/' || v_row.id, 'approval_request', v_row.id,
        'approval.overdue:' || v_row.id || ':' || v_row.days_late, array[v_row.requested_by]
      );
    end if;
  end loop;

  for v_row in
    select i.id, i.title, i.brand_id, i.assignee_id, i.production_due_date,
      (i.production_due_date - (now() at time zone b.timezone)::date) as days_left
    from public.content_items i
    join public.brands b on b.id = i.brand_id
    where i.cancelled_at is null and i.assignee_id is not null
      and i.production_due_date >= (now() at time zone b.timezone)::date
      and not public.content_item_is_ready(i.id)
  loop
    v_lead := coalesce(public.notification_lead_days(v_row.assignee_id, 'content.due_soon'), array[2, 0]);
    if v_row.days_left = any (v_lead) then
      v_when := case
        when v_row.days_left = 0 then 'hoje'
        when v_row.days_left = 1 then 'em 1 dia'
        else 'em ' || v_row.days_left || ' dias'
      end;
      perform public.notify_users(
        'content.due_soon', v_row.brand_id, 'Prazo de produção chegando',
        format('«%s» deve ficar pronto %s.', v_row.title, v_when),
        '/admin/marketing/content/' || v_row.id, 'content_item', v_row.id,
        'content.due_soon:' || v_row.id || ':' || v_row.production_due_date || ':' || v_row.days_left,
        array[v_row.assignee_id]
      );
    end if;
  end loop;

  for v_row in
    select i.id, i.title, i.brand_id, i.assignee_id, i.production_due_date,
      (now() at time zone b.timezone)::date as today,
      array(
        select u.id from (
          select i.assignee_id as id
          union
          select m.user_id
          from public.brand_members m
          join public.profiles p on p.id = m.user_id
          join public.roles r on r.id = p.role_id
          where m.brand_id = i.brand_id and m.kind = 'internal' and m.status = 'active'
            and r.key = 'manager'
        ) u
        where u.id is not null
      ) as recipients
    from public.content_items i
    join public.brands b on b.id = i.brand_id
    where i.cancelled_at is null
      and i.production_due_date < (now() at time zone b.timezone)::date
      and not public.content_item_is_ready(i.id)
  loop
    perform public.notify_users(
      'content.overdue', v_row.brand_id, 'Prazo de produção vencido',
      format('O prazo de «%s» venceu em %s.', v_row.title,
        public.notification_date_text(v_row.production_due_date)),
      '/admin/marketing/content/' || v_row.id, 'content_item', v_row.id,
      'content.overdue:' || v_row.id || ':' || v_row.today, v_row.recipients
    );
  end loop;

  for v_row in
    select v.id, v.brand_id, v.planned_at, i.title, i.assignee_id,
      ((now() at time zone v.planned_timezone)::date - (v.planned_at at time zone v.planned_timezone)::date) as days_since,
      (v.planned_at at time zone v.planned_timezone)::date as planned_day,
      (v.planned_at at time zone v.planned_timezone) as planned_local
    from public.content_variants v
    join public.content_items i on i.id = v.content_item_id
    where v.publication_status = 'planned' and v.editorial_status = 'approved'
      and v.planned_at < now() and i.cancelled_at is null and i.assignee_id is not null
  loop
    v_lead := coalesce(public.notification_lead_days(v_row.assignee_id, 'variant.publish_due'), array[1]);
    if v_row.days_since >= coalesce(v_lead[1], 1) then
      perform public.notify_users(
        'variant.publish_due', v_row.brand_id, 'Hora de registrar a publicação',
        format(
          '«%s» estava planejado para %s às %s. Já foi publicado?', v_row.title,
          case when v_row.days_since = 1 then 'ontem' else public.notification_date_text(v_row.planned_day) end,
          to_char(v_row.planned_local, 'FMHH24') || 'h'
            || case when extract(minute from v_row.planned_local) <> 0 then to_char(v_row.planned_local, 'MI') else '' end
        ),
        '/admin/marketing/variants/' || v_row.id, 'content_variant', v_row.id,
        'variant.publish_due:' || v_row.id || ':' || extract(epoch from v_row.planned_at)::bigint,
        array[v_row.assignee_id]
      );
    end if;
  end loop;

  update public.notifications n
  set status = 'resolved'
  where n.status = 'active' and n.kind = 'approval.overdue' and n.ref_type = 'approval_request'
    and not exists (
      select 1 from public.approval_requests q where q.id = n.ref_id and q.status = 'pending'
    );

  update public.notifications n
  set status = 'resolved'
  where n.status = 'active' and n.kind in ('content.due_soon', 'content.overdue')
    and n.ref_type = 'content_item'
    and not exists (
      select 1 from public.content_items i
      where i.id = n.ref_id and i.cancelled_at is null and i.production_due_date is not null
        and not public.content_item_is_ready(i.id)
    );

  update public.notifications n
  set status = 'resolved'
  where n.status = 'active' and n.kind = 'variant.publish_due' and n.ref_type = 'content_variant'
    and not exists (
      select 1 from public.content_variants v
      where v.id = n.ref_id and v.publication_status = 'planned' and v.editorial_status = 'approved'
        and v.planned_at < now()
    );
end;
$$;

update public.notification_kinds
set available = true
where kind in ('approval.overdue', 'content.due_soon', 'content.overdue', 'variant.publish_due');

revoke execute on function public.calendar_range_ok(timestamptz, timestamptz),
  public.content_item_is_ready(uuid), public.notification_date_text(date),
  public.list_calendar_entries(timestamptz, timestamptz, uuid[], uuid[], uuid, text[], text[]),
  public.reschedule_variant(uuid, timestamptz, text, int),
  public.reschedule_production_deadline(uuid, date, int),
  public.portal_list_calendar(uuid, timestamptz, timestamptz), public.notify_scan_content()
  from public, anon;

grant execute on function public.list_calendar_entries(timestamptz, timestamptz, uuid[], uuid[], uuid, text[], text[]),
  public.reschedule_variant(uuid, timestamptz, text, int),
  public.reschedule_production_deadline(uuid, date, int),
  public.portal_list_calendar(uuid, timestamptz, timestamptz)
  to authenticated;

revoke execute on function public.calendar_range_ok(timestamptz, timestamptz),
  public.content_item_is_ready(uuid), public.notification_date_text(date),
  public.notify_scan_content() from authenticated;

grant execute on function public.generate_due_notifications() to service_role;

commit;

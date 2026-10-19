begin;

drop function public.portal_list_comments(uuid);
drop function public.portal_add_comment(uuid, text);
drop function public.portal_list_calendar(uuid, timestamptz, timestamptz);
drop function public.dashboard_my_items();

create or replace function public.portal_request_row(p_request public.approval_requests)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_request.id,
    'item_id', p_request.item_id,
    'status', p_request.status,
    'title', r.snapshot ->> 'title',
    'channels', coalesce(r.snapshot -> 'channels', '[]'::jsonb),
    'brand_timezone', r.snapshot ->> 'brand_timezone',
    'revision_no', r.revision_no,
    'due_date', p_request.due_date,
    'requested_at', p_request.requested_at,
    'decided_at', p_request.decided_at,
    'is_mine', p_request.approver_user_id = auth.uid(),
    'approver_name', (select p.full_name from public.profiles p where p.id = p_request.approver_user_id)
  )
  from public.content_revisions r
  where r.id = p_request.revision_id
$$;

create or replace function public.portal_get_approval(p_request uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_item public.content_items;
  v_revision public.content_revisions;
  v_decision public.approval_decisions;
  v_current uuid;
  v_designated boolean;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_request.brand_id) then
    raise exception 'not_found';
  end if;
  select * into v_item from public.content_items i where i.id = v_request.item_id;
  select * into v_revision from public.content_revisions r where r.id = v_request.revision_id;
  select * into v_decision from public.approval_decisions d where d.request_id = p_request;
  select q.id into v_current
  from public.approval_requests q
  where q.item_id = v_request.item_id and q.status <> 'cancelled'
    and q.revision_id = v_item.current_revision_id
  order by (q.status = 'pending') desc, q.requested_at desc
  limit 1;
  v_designated := v_request.approver_user_id = auth.uid();

  return jsonb_build_object(
    'request', public.portal_request_row(v_request),
    'brand_id', v_request.brand_id,
    'brand_name', (select b.name from public.brands b where b.id = v_request.brand_id),
    'message', v_request.message,
    'caption', v_revision.snapshot -> 'caption',
    'call_to_action', v_revision.snapshot ->> 'call_to_action',
    'revision_id', v_revision.id,
    'is_current', v_item.current_revision_id = v_request.revision_id,
    'current_request_id', case when v_current is distinct from p_request then v_current else null end,
    'is_designated', v_designated,
    'can_decide', v_designated
      and v_request.status = 'pending'
      and v_item.current_revision_id = v_request.revision_id
      and public.has_action('approvals.decide')
      and public.is_external_brand_member(v_request.brand_id, true),
    'media', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'version_id', m.media_version_id,
            'position', m.position,
            'alt_text', m.alt_text,
            'mime_type', mv.mime_type,
            'width', mv.width,
            'height', mv.height,
            'name', mv.original_filename,
            'has_thumb', mv.thumb_key is not null,
            'has_display', mv.display_key is not null
          )
          order by m.position
        )
        from public.content_revision_media m
        join public.media_versions mv on mv.id = m.media_version_id
        where m.revision_id = v_revision.id
      ),
      '[]'::jsonb
    ),
    'decision', case
      when v_decision.id is null then null
      else jsonb_build_object(
        'outcome', v_decision.outcome,
        'comment', v_decision.comment,
        'decided_at', v_decision.decided_at,
        'decided_by_name', (select p.full_name from public.profiles p where p.id = v_decision.decided_by)
      )
    end,
    'history', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'request_id', h.id,
            'revision_no', hr.revision_no,
            'status', h.status,
            'requested_at', h.requested_at,
            'decided_at', h.decided_at,
            'comment', hd.comment
          )
          order by h.requested_at desc
        )
        from public.approval_requests h
        join public.content_revisions hr on hr.id = h.revision_id
        left join public.approval_decisions hd on hd.request_id = h.id
        where h.item_id = v_request.item_id and h.id <> p_request and h.status <> 'cancelled'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.portal_decide_approval(p_request uuid, p_outcome text, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_item public.content_items;
  v_brand public.brands;
  v_probe record;
  v_names text;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_recipients uuid[];
begin
  perform public.assert_action('approvals.decide');
  select q.item_id, q.brand_id into v_probe from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_probe.brand_id) then
    raise exception 'not_found';
  end if;

  select * into v_item from public.content_items i where i.id = v_probe.item_id for update;
  select * into v_request from public.approval_requests q where q.id = p_request for update;

  if v_request.approver_user_id <> auth.uid() then
    raise exception 'not_designated_approver';
  end if;
  if not public.is_external_brand_member(v_request.brand_id, true) then
    raise exception 'approver_without_access';
  end if;
  if v_request.status = 'superseded' then
    raise exception 'revision_superseded';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if v_item.current_revision_id is distinct from v_request.revision_id then
    raise exception 'revision_superseded';
  end if;
  if v_item.editorial_status <> 'awaiting_approval' then
    raise exception 'request_not_pending';
  end if;
  if p_outcome is null or p_outcome not in ('approved', 'changes_requested') then
    raise exception 'invalid_input';
  end if;
  if p_outcome = 'changes_requested' and char_length(coalesce(v_comment, '')) < 5 then
    raise exception 'comment_required';
  end if;
  if char_length(coalesce(v_comment, '')) > 4000 then
    raise exception 'invalid_input';
  end if;

  insert into public.approval_decisions (request_id, revision_id, decided_by, outcome, comment)
  values (p_request, v_request.revision_id, auth.uid(), p_outcome, v_comment);

  update public.approval_requests
  set status = p_outcome, decided_at = now()
  where id = p_request;

  update public.content_items
  set editorial_status = p_outcome,
      approved_revision_id = case when p_outcome = 'approved' then v_request.revision_id else null end,
      version = version + 1
  where id = v_request.item_id;

  select * into v_brand from public.brands b where b.id = v_request.brand_id;
  select string_agg(c ->> 'profile_name', ', ') into v_names
  from public.content_revisions r, jsonb_array_elements(r.snapshot -> 'channels') c
  where r.id = v_request.revision_id;

  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.decided', 'approval_request',
    p_request, jsonb_build_object('outcome', p_outcome, 'revision_id', v_request.revision_id)
  );
  perform public.resolve_notifications('approval_request', p_request);

  select array_agg(distinct u) into v_recipients
  from unnest(array[v_request.requested_by, v_item.assignee_id]) u
  where u is not null;
  if v_recipients is not null then
    perform public.notify_users(
      'approval.decided', v_request.brand_id, 'Aprovação concluída',
      case when p_outcome = 'approved'
        then format('%s aprovou «%s» (%s).', v_brand.name, v_item.title, v_names)
        else format('%s pediu alterações em «%s».', v_brand.name, v_item.title)
      end,
      '/admin/marketing/approvals/' || p_request,
      'approval_request', p_request, 'approval.decided:' || p_request, v_recipients
    );
  end if;
  return jsonb_build_object('status', p_outcome);
end;
$$;

create function public.portal_list_comments(p_item uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select i.brand_id into v_brand from public.content_items i where i.id = p_item;
  if v_brand is null or not public.is_external_brand_member(v_brand)
    or not exists (select 1 from public.approval_requests q where q.item_id = p_item) then
    raise exception 'not_found';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'body', c.body, 'created_at', c.created_at, 'author_name', p.full_name,
          'mine', c.author_id = auth.uid(), 'from_team', p.kind = 'internal',
          'revision_no', r.revision_no
        )
        order by c.created_at
      )
      from public.comments c
      join public.profiles p on p.id = c.author_id
      left join public.content_revisions r on r.id = c.revision_id
      where c.item_id = p_item and c.visibility = 'external' and c.deleted_at is null
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.portal_add_comment(p_item uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_body text := btrim(coalesce(p_body, ''));
  v_author text;
  v_last_requester uuid;
  v_recipients uuid[];
  v_id uuid;
begin
  perform public.assert_action('comments.create_external');
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'invalid_input';
  end if;
  select * into v_item from public.content_items i where i.id = p_item;
  if not found or not public.is_external_brand_member(v_item.brand_id)
    or not exists (select 1 from public.approval_requests q where q.item_id = p_item) then
    raise exception 'not_found';
  end if;

  insert into public.comments (brand_id, item_id, revision_id, author_id, visibility, body)
  values (v_item.brand_id, p_item, v_item.current_revision_id, auth.uid(), 'external', v_body)
  returning id into v_id;

  select p.full_name into v_author from public.profiles p where p.id = auth.uid();
  select q.requested_by into v_last_requester
  from public.approval_requests q where q.item_id = p_item order by q.requested_at desc limit 1;
  select array_agg(distinct u) into v_recipients
  from unnest(array[v_item.assignee_id, v_last_requester]) u
  where u is not null;

  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'comment.created', 'comment', v_id,
    jsonb_build_object('visibility', 'external', 'item_id', p_item)
  );
  if v_recipients is not null then
    perform public.notify_users(
      'comment.created', v_item.brand_id, 'Novo comentário',
      format('%s comentou em «%s».', v_author, v_item.title),
      '/admin/marketing/content/' || p_item,
      'comment', v_id, 'comment.created:' || v_id, v_recipients
    );
  end if;
  return jsonb_build_object('id', v_id);
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
        select jsonb_agg(l.obj order by l.at, l.request_id, l.channel_row)
        from (
          select
            (ch.value ->> 'planned_at')::timestamptz as at,
            q.id as request_id,
            ch.value ->> 'row_id' as channel_row,
            jsonb_build_object(
              'request_id', q.id, 'status', q.status, 'title', r.snapshot ->> 'title',
              'platform', ch.value ->> 'platform',
              'profile_name', ch.value ->> 'profile_name',
              'planned_at', ch.value ->> 'planned_at',
              'planned_timezone', ch.value ->> 'planned_timezone',
              'brand_timezone', r.snapshot ->> 'brand_timezone',
              'is_mine', q.approver_user_id = auth.uid()
            ) as obj
          from (
            select distinct on (q2.item_id) q2.*
            from public.approval_requests q2
            join public.content_items i on i.id = q2.item_id
            where q2.brand_id = p_brand and q2.status <> 'cancelled'
              and i.cancelled_at is null
            order by q2.item_id, q2.requested_at desc
          ) q
          join public.content_revisions r on r.id = q.revision_id
          cross join lateral jsonb_array_elements(coalesce(r.snapshot -> 'channels', '[]'::jsonb)) ch
          where ch.value ->> 'planned_at' is not null
            and (ch.value ->> 'planned_at')::timestamptz >= p_from
            and (ch.value ->> 'planned_at')::timestamptz < p_to
        ) l
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function public.dashboard_attention(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_approvals boolean;
begin
  if not (public.has_action('content.view') or public.has_action('approvals.view')) then
    raise exception 'denied';
  end if;
  v_approvals := public.has_action('approvals.view');

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'item_id', att.item_id, 'title', att.title, 'brand_id', att.brand_id,
          'brand_name', att.brand_name, 'channels', to_jsonb(att.channels),
          'reasons', to_jsonb(att.reasons)
        )
        order by cardinality(att.reasons) desc, att.title
      )
      from (
        select
          i.id as item_id, i.title, b.id as brand_id, b.name as brand_name,
          array(
            select c.profile_name
            from public.content_channels r
            join public.channels c on c.id = r.channel_id
            where r.content_item_id = i.id and r.publication_status <> 'cancelled'
            order by r.position, r.created_at
          ) as channels,
          array_remove(
            array[
              case when v_approvals and exists (
                select 1 from public.approval_requests q
                where q.item_id = i.id and q.status = 'pending' and q.due_date is not null
                  and q.due_date < (now() at time zone b.timezone)::date
              ) then 'approval_overdue' end,
              case when i.editorial_status = 'changes_requested' then 'changes_requested' end,
              case when i.production_due_date is not null
                and i.production_due_date < (now() at time zone b.timezone)::date
                and i.editorial_status <> 'approved' then 'production_overdue' end,
              case when exists (
                select 1 from public.content_channels r
                where r.content_item_id = i.id and r.publication_status = 'planned'
                  and r.planned_at < now()
              ) then 'planned_date_passed' end,
              case when v_approvals and exists (
                select 1 from public.approval_requests q
                where q.item_id = i.id and q.status = 'pending'
                  and not public.approver_is_valid(q.brand_id, q.approver_user_id)
              ) then 'approver_without_access' end
            ],
            null
          ) as reasons
        from public.content_items i
        join public.brands b on b.id = i.brand_id
        where i.cancelled_at is null and public.can_access_brand(i.brand_id)
          and (p_brands is null or i.brand_id = any (p_brands))
      ) att
      where cardinality(att.reasons) > 0
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.dashboard_status_counts(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.view');
  return coalesce(
    (
      select jsonb_object_agg(counted.status, counted.total)
      from (
        select i.editorial_status as status, count(*)::int as total
        from public.content_items i
        where i.cancelled_at is null and public.can_access_brand(i.brand_id)
          and (p_brands is null or i.brand_id = any (p_brands))
        group by i.editorial_status
      ) counted
    ),
    '{}'::jsonb
  );
end;
$$;

create function public.dashboard_my_items()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.view');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'item_id', mine.id, 'title', mine.title, 'brand_id', mine.brand_id,
          'brand_name', mine.brand_name, 'production_due_date', mine.production_due_date,
          'editorial_status', mine.editorial_status
        )
        order by mine.production_due_date nulls last, mine.title
      )
      from (
        select i.id, i.title, i.brand_id, b.name as brand_name, i.production_due_date,
          i.editorial_status
        from public.content_items i
        join public.brands b on b.id = i.brand_id
        where i.assignee_id = auth.uid() and i.cancelled_at is null
          and public.can_access_brand(i.brand_id)
        order by i.production_due_date nulls last, i.title
        limit 20
      ) mine
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.notify_scan_content()
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
    join public.content_items i on i.id = q.item_id
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
    select r.id, r.brand_id, r.planned_at, i.id as item_id, i.title, i.assignee_id, c.profile_name,
      ((now() at time zone r.planned_timezone)::date - (r.planned_at at time zone r.planned_timezone)::date) as days_since,
      (r.planned_at at time zone r.planned_timezone)::date as planned_day,
      (r.planned_at at time zone r.planned_timezone) as planned_local
    from public.content_channels r
    join public.content_items i on i.id = r.content_item_id
    join public.channels c on c.id = r.channel_id
    where r.publication_status = 'planned' and i.editorial_status = 'approved'
      and r.planned_at < now() and i.cancelled_at is null and i.assignee_id is not null
  loop
    v_lead := coalesce(public.notification_lead_days(v_row.assignee_id, 'content.publish_due'), array[1]);
    if v_row.days_since >= coalesce(v_lead[1], 1) then
      perform public.notify_users(
        'content.publish_due', v_row.brand_id, 'Hora de registrar a publicação',
        format(
          '«%s» (%s) estava planejado para %s às %s. Já foi publicado?', v_row.title, v_row.profile_name,
          case when v_row.days_since = 1 then 'ontem' else public.notification_date_text(v_row.planned_day) end,
          to_char(v_row.planned_local, 'FMHH24') || 'h'
            || case when extract(minute from v_row.planned_local) <> 0 then to_char(v_row.planned_local, 'MI') else '' end
        ),
        '/admin/marketing/content/' || v_row.item_id, 'content_channel', v_row.id,
        'content.publish_due:' || v_row.id || ':' || extract(epoch from v_row.planned_at)::bigint,
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
  where n.status = 'active' and n.kind = 'content.publish_due' and n.ref_type = 'content_channel'
    and not exists (
      select 1 from public.content_channels r
      join public.content_items i on i.id = r.content_item_id
      where r.id = n.ref_id and r.publication_status = 'planned' and i.editorial_status = 'approved'
        and r.planned_at < now()
    );
end;
$$;

revoke execute on function public.portal_list_comments(uuid), public.portal_add_comment(uuid, text),
  public.portal_list_calendar(uuid, timestamptz, timestamptz), public.dashboard_my_items()
  from public, anon;

grant execute on function public.portal_list_comments(uuid), public.portal_add_comment(uuid, text),
  public.portal_list_calendar(uuid, timestamptz, timestamptz), public.dashboard_my_items()
  to authenticated;

commit;

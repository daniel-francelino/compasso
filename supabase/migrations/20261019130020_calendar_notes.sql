begin;

create table public.calendar_notes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  kind text not null check (kind in ('idea', 'date')),
  title text not null check (char_length(title) between 2 and 140),
  description text check (description is null or char_length(description) <= 2000),
  note_date date not null,
  repeat text not null default 'none' check (repeat in ('none', 'weekly', 'monthly', 'yearly')),
  converted_item_id uuid,
  converted_at timestamptz,
  archived_at timestamptz,
  version int not null default 1,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (converted_item_id, brand_id) references public.content_items (id, brand_id),
  check ((converted_item_id is null) = (converted_at is null))
);

create index calendar_notes_brand_idx on public.calendar_notes (brand_id, note_date)
  where archived_at is null;
create index calendar_notes_item_idx on public.calendar_notes (converted_item_id)
  where converted_item_id is not null;

alter table public.calendar_notes enable row level security;

create trigger calendar_notes_set_updated_at before update on public.calendar_notes
for each row execute function public.set_updated_at();

create policy calendar_notes_read on public.calendar_notes for select
  using (public.has_action('calendar.view') and public.can_access_brand(brand_id));

revoke all on public.calendar_notes from anon, authenticated;
grant select on public.calendar_notes to authenticated;

update public.actions
set description = 'Reschedule from the calendar and manage ideas and dates'
where key = 'calendar.manage';

create function public.calendar_note_save(p_note jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_note ->> 'id', '')::uuid;
  v_brand uuid := nullif(p_note ->> 'brand_id', '')::uuid;
  v_kind text := p_note ->> 'kind';
  v_title text := btrim(coalesce(p_note ->> 'title', ''));
  v_description text := nullif(btrim(coalesce(p_note ->> 'description', '')), '');
  v_date date := nullif(p_note ->> 'note_date', '')::date;
  v_repeat text := coalesce(nullif(p_note ->> 'repeat', ''), 'none');
  v_expected int := nullif(p_note ->> 'expected_version', '')::int;
  v_old public.calendar_notes;
  v_version int;
begin
  perform public.assert_action('calendar.manage');
  if v_kind is null or v_kind not in ('idea', 'date') or char_length(v_title) not between 2 and 140
    or char_length(coalesce(v_description, '')) > 2000 or v_date is null
    or v_repeat not in ('none', 'weekly', 'monthly', 'yearly') then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    perform public.assert_brand_access(v_brand);
    if exists (select 1 from public.brands b where b.id = v_brand and b.archived_at is not null) then
      raise exception 'brand_archived';
    end if;
    insert into public.calendar_notes (brand_id, kind, title, description, note_date, repeat, created_by)
    values (v_brand, v_kind, v_title, v_description, v_date, v_repeat, auth.uid())
    returning id, version into v_id, v_version;
    perform public.audit_write(
      public.current_organization_id(), v_brand, 'calendar_note.created', 'calendar_note', v_id,
      jsonb_build_object('kind', v_kind)
    );
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  select * into v_old from public.calendar_notes n where n.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;
  if v_old.converted_item_id is not null or v_old.archived_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  update public.calendar_notes
  set kind = v_kind, title = v_title, description = v_description, note_date = v_date,
      repeat = v_repeat, version = version + 1
  where id = v_id
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'calendar_note.updated', 'calendar_note', v_id,
    jsonb_build_object('kind', v_kind)
  );
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.calendar_note_archive(p_note uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note public.calendar_notes;
begin
  perform public.assert_action('calendar.manage');
  select * into v_note from public.calendar_notes n where n.id = p_note for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_note.brand_id);
  if v_note.converted_item_id is not null or v_note.archived_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  update public.calendar_notes set archived_at = now(), version = version + 1 where id = p_note;
  perform public.audit_write(
    public.current_organization_id(), v_note.brand_id, 'calendar_note.archived', 'calendar_note',
    p_note, jsonb_build_object('kind', v_note.kind)
  );
end;
$$;

create function public.calendar_note_get(p_note uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_note public.calendar_notes;
begin
  perform public.assert_action('calendar.view');
  select * into v_note from public.calendar_notes n where n.id = p_note;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_note.brand_id);
  return jsonb_build_object(
    'id', v_note.id, 'brand_id', v_note.brand_id, 'kind', v_note.kind, 'title', v_note.title,
    'description', v_note.description, 'note_date', v_note.note_date, 'repeat', v_note.repeat,
    'converted_item_id', v_note.converted_item_id, 'archived', v_note.archived_at is not null,
    'version', v_note.version
  );
end;
$$;

create or replace function public.content_item_is_ready(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_items i
    where i.id = p_item and i.cancelled_at is null and i.editorial_status = 'approved'
  )
$$;

drop function public.list_calendar_entries(timestamptz, timestamptz, uuid[], uuid[], uuid, text[], text[]);
drop function public.reschedule_variant(uuid, timestamptz, text, int);

create function public.list_calendar_entries(
  p_from timestamptz,
  p_to timestamptz,
  p_brands uuid[] default null,
  p_channels uuid[] default null,
  p_assignee uuid default null,
  p_editorial text[] default null,
  p_publication text[] default null,
  p_notes text[] default null
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
        r.id as row_id, i.id as item_id, r.planned_at, r.published_at, r.publication_status,
        i.production_due_date, b.timezone as brand_timezone,
        jsonb_build_object(
          'channel_row_id', r.id, 'item_id', i.id, 'title', i.title, 'brand_id', b.id,
          'brand_name', b.name, 'brand_timezone', b.timezone, 'channel_id', c.id,
          'platform', c.platform, 'profile_name', c.profile_name, 'format', r.format,
          'editorial_status', i.editorial_status, 'publication_status', r.publication_status,
          'planned_timezone', r.planned_timezone, 'version', r.version, 'item_version', i.version,
          'assignee_id', i.assignee_id,
          'assignee_name', (select p.full_name from public.profiles p where p.id = i.assignee_id),
          'channel_archived', c.archived_at is not null
        ) as common
      from public.content_channels r
      join public.content_items i on i.id = r.content_item_id
      join public.brands b on b.id = r.brand_id
      join public.channels c on c.id = r.channel_id
      where r.publication_status <> 'cancelled' and i.cancelled_at is null
        and public.can_access_brand(r.brand_id)
        and (p_brands is null or r.brand_id = any (p_brands))
        and (p_channels is null or r.channel_id = any (p_channels))
        and (p_assignee is null or i.assignee_id = p_assignee)
        and (p_editorial is null or i.editorial_status = any (p_editorial))
        and (p_publication is null or r.publication_status = any (p_publication))
    ),
    noted as (
      select
        jsonb_build_object(
          'kind', n.kind, 'note_id', n.id, 'title', n.title, 'description', n.description,
          'date', d.day, 'brand_id', b.id, 'brand_name', b.name, 'brand_timezone', b.timezone,
          'repeat', n.repeat, 'converted_item_id', n.converted_item_id, 'version', n.version
        ) as obj,
        (d.day::timestamp at time zone b.timezone) as sort_at,
        n.kind as kind, n.id::text as ref
      from public.calendar_notes n
      join public.brands b on b.id = n.brand_id
      cross join lateral (
        select g::date as day
        from generate_series(
          greatest(n.note_date, (p_from at time zone b.timezone)::date),
          ((p_to - interval '1 second') at time zone b.timezone)::date,
          interval '1 day'
        ) g
        where (n.repeat = 'none' and g::date = n.note_date)
          or (n.repeat = 'weekly' and g::date >= n.note_date and (g::date - n.note_date) % 7 = 0)
          or (n.repeat = 'monthly' and g::date >= n.note_date
            and extract(day from g) = extract(day from n.note_date))
          or (n.repeat = 'yearly' and g::date >= n.note_date
            and to_char(g, 'MM-DD') = to_char(n.note_date, 'MM-DD'))
      ) d
      where n.archived_at is null and public.can_access_brand(n.brand_id)
        and p_notes is not null and n.kind = any (p_notes)
        and (p_brands is null or n.brand_id = any (p_brands))
        and p_channels is null and p_assignee is null and p_editorial is null and p_publication is null
    ),
    entries as (
      select x.*, row_number() over (order by x.sort_at, x.kind, x.ref) as rn
      from (
        select
          s.common || jsonb_build_object('kind', 'publication', 'at', s.planned_at) as obj,
          s.planned_at as sort_at, 'publication' as kind, s.row_id::text as ref
        from base s
        where s.publication_status = 'planned' and s.planned_at >= p_from and s.planned_at < p_to
        union all
        select
          s.common || jsonb_build_object('kind', 'published', 'at', s.published_at),
          s.published_at, 'published', s.row_id::text
        from base s
        where s.publication_status = 'published_manually'
          and s.published_at >= p_from and s.published_at < p_to
        union all
        select
          a.common || jsonb_build_object('kind', 'approval_deadline', 'date', q.due_date, 'request_id', q.id,
            'channel_row_id', null, 'channel_id', null, 'platform', null, 'profile_name', null,
            'format', null, 'publication_status', null, 'planned_timezone', null, 'version', null,
            'channel_archived', false),
          (q.due_date::timestamp at time zone a.brand_timezone), 'approval_deadline', a.item_id::text
        from (
          select distinct on (s.item_id) s.*
          from base s
          order by s.item_id, s.row_id
        ) a
        join public.approval_requests q on q.item_id = a.item_id and q.status = 'pending'
        where q.due_date is not null
          and q.due_date >= (p_from at time zone a.brand_timezone)::date
          and q.due_date <= ((p_to - interval '1 second') at time zone a.brand_timezone)::date
        union all
        select
          d.common || jsonb_build_object('kind', 'production_deadline', 'date', d.production_due_date,
            'channel_row_id', null, 'channel_id', null, 'platform', null, 'profile_name', null,
            'format', null, 'publication_status', null, 'planned_timezone', null, 'version', null,
            'channel_archived', false),
          (d.production_due_date::timestamp at time zone d.brand_timezone), 'production_deadline',
          d.item_id::text
        from (
          select distinct on (s.item_id) s.*
          from base s
          where s.production_due_date >= (p_from at time zone s.brand_timezone)::date
            and s.production_due_date <= ((p_to - interval '1 second') at time zone s.brand_timezone)::date
          order by s.item_id, s.row_id
        ) d
        union all
        select nt.obj, nt.sort_at, nt.kind, nt.ref from noted nt
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

create function public.reschedule_channel(
  p_channel_row uuid,
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
  v_row public.content_channels;
  v_item public.content_items;
  v_brand public.brands;
  v_channel public.channels;
  v_current public.content_revisions;
  v_prev public.approval_requests;
  v_snapshot jsonb;
  v_names text;
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

  select * into v_row from public.content_channels r where r.id = p_channel_row;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_item from public.content_items i where i.id = v_row.content_item_id for update;
  select * into v_row from public.content_channels r where r.id = p_channel_row for update;
  perform public.assert_brand_access(v_row.brand_id);
  if p_expected_version is null or p_expected_version <> v_row.version then
    raise exception 'conflict';
  end if;
  if v_row.publication_status in ('cancelled', 'published_manually') or v_item.cancelled_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  select * into v_channel from public.channels c where c.id = v_row.channel_id;
  select * into v_brand from public.brands b where b.id = v_row.brand_id;
  if v_channel.archived_at is not null then
    raise exception 'channel_archived';
  end if;

  if v_item.editorial_status not in ('awaiting_approval', 'approved') then
    update public.content_channels
    set planned_at = p_planned_at, planned_timezone = v_tz, publication_status = 'planned',
        version = version + 1
    where id = p_channel_row
    returning version into v_version;
    perform public.audit_write(
      v_org, v_row.brand_id, 'content_channel.rescheduled', 'content_channel', p_channel_row,
      jsonb_build_object('from', v_row.planned_at, 'to', p_planned_at, 'resubmitted', false)
    );
    return jsonb_build_object('id', p_channel_row, 'version', v_version, 'resubmitted', false);
  end if;

  select * into v_current from public.content_revisions r where r.id = v_item.current_revision_id;
  select * into v_prev from public.approval_requests q
  where q.item_id = v_item.id and q.revision_id = v_item.current_revision_id
  order by q.requested_at desc limit 1 for update;
  if v_current.id is null or v_prev.id is null then
    raise exception 'transition_not_allowed';
  end if;
  if not public.approver_is_valid(v_row.brand_id, v_prev.approver_user_id) then
    raise exception 'approver_without_access';
  end if;

  select jsonb_agg(
    case
      when e.value ->> 'row_id' = p_channel_row::text
        then e.value || jsonb_build_object('planned_at', p_planned_at, 'planned_timezone', v_tz)
      else e.value
    end
    order by e.ordinality
  )
  into v_snapshot
  from jsonb_array_elements(v_current.snapshot -> 'channels') with ordinality as e (value, ordinality);
  select string_agg(c ->> 'profile_name', ', ') into v_names
  from jsonb_array_elements(v_snapshot) c;

  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.content_revisions r where r.item_id = v_item.id;

  insert into public.content_revisions (item_id, brand_id, revision_no, snapshot, created_by)
  values (
    v_item.id, v_row.brand_id, v_no,
    jsonb_set(v_current.snapshot, '{channels}', v_snapshot), auth.uid()
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
    brand_id, item_id, revision_id, approver_user_id, requested_by, due_date
  )
  values (v_row.brand_id, v_item.id, v_revision, v_prev.approver_user_id, auth.uid(), v_due)
  returning id into v_request;

  if v_item.editorial_status = 'approved' then
    update public.content_items
    set editorial_status = 'in_production', approved_revision_id = null
    where id = v_item.id;
  end if;

  update public.content_items
  set editorial_status = 'awaiting_approval', current_revision_id = v_revision,
      approved_revision_id = null, approval_due_date = v_due, version = version + 1
  where id = v_item.id;

  update public.content_channels
  set planned_at = p_planned_at, planned_timezone = v_tz, publication_status = 'planned',
      version = version + 1
  where id = p_channel_row
  returning version into v_version;

  perform public.audit_write(
    v_org, v_row.brand_id, 'content_channel.rescheduled', 'content_channel', p_channel_row,
    jsonb_build_object(
      'from', v_row.planned_at, 'to', p_planned_at, 'resubmitted', true,
      'revision_no', v_no, 'request_id', v_request
    )
  );
  perform public.audit_write(
    v_org, v_row.brand_id, 'approval.requested', 'approval_request', v_request,
    jsonb_build_object('approver_id', v_prev.approver_user_id, 'revision_id', v_revision)
  );

  if v_prev.status = 'pending' then
    perform public.audit_write(
      v_org, v_row.brand_id, 'approval.superseded', 'approval_request', v_prev.id,
      jsonb_build_object('replaced_by', v_request)
    );
    perform public.notify_users(
      'approval.superseded', v_row.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_row.brand_id || '/approvals/' || v_request,
      'approval_request', v_prev.id, 'approval.superseded:' || v_prev.id,
      array[v_prev.approver_user_id]
    );
  end if;

  perform public.notify_users(
    'approval.requested', v_row.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_names),
    '/portal/brands/' || v_row.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    array[v_prev.approver_user_id]
  );

  return jsonb_build_object(
    'id', p_channel_row, 'version', v_version, 'resubmitted', true, 'request_id', v_request,
    'revision_no', v_no
  );
end;
$$;

revoke execute on function public.calendar_note_save(jsonb), public.calendar_note_archive(uuid),
  public.calendar_note_get(uuid), public.content_item_is_ready(uuid),
  public.list_calendar_entries(timestamptz, timestamptz, uuid[], uuid[], uuid, text[], text[], text[]),
  public.reschedule_channel(uuid, timestamptz, text, int)
  from public, anon;

grant execute on function public.calendar_note_save(jsonb), public.calendar_note_archive(uuid),
  public.calendar_note_get(uuid),
  public.list_calendar_entries(timestamptz, timestamptz, uuid[], uuid[], uuid, text[], text[], text[]),
  public.reschedule_channel(uuid, timestamptz, text, int)
  to authenticated;

revoke execute on function public.content_item_is_ready(uuid) from authenticated;

commit;

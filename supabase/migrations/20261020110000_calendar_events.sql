begin;

alter table public.calendar_notes drop constraint calendar_notes_kind_check;
alter table public.calendar_notes add constraint calendar_notes_kind_check check (kind in ('idea', 'date', 'event'));

alter table public.calendar_notes
  add column event_type text check (event_type is null or event_type in ('shoot', 'meeting', 'other')),
  add column all_day boolean not null default true,
  add column end_date date,
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add column timezone text,
  add column location text check (location is null or char_length(location) <= 200),
  add column client_visible boolean not null default false,
  add column internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000);

alter table public.calendar_notes add constraint calendar_notes_event_shape check (
  (kind = 'event' and event_type is not null
    and (all_day or (starts_at is not null and ends_at is not null and timezone is not null
      and ends_at >= starts_at))
    and (end_date is null or end_date >= note_date))
  or (kind <> 'event' and event_type is null and starts_at is null and ends_at is null
    and end_date is null and location is null and internal_notes is null and all_day)
);

alter table public.calendar_notes add constraint calendar_notes_idea_not_shared
  check (kind <> 'idea' or not client_visible);

alter table public.calendar_notes add constraint calendar_notes_repeat_single_day
  check (repeat = 'none' or end_date is null or end_date = note_date);

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
values ('calendar.event', 'Evento no calendário', 'portal.view', 'info', null, false, true, false, true)
on conflict (kind) do nothing;

create function public.calendar_note_days(
  p_note_date date,
  p_end_date date,
  p_repeat text,
  p_from timestamptz,
  p_to timestamptz,
  p_zone text
)
returns setof date
language sql
immutable
set search_path = ''
as $fn$
  select g::date
  from generate_series(
    greatest(p_note_date, (p_from at time zone p_zone)::date),
    least(
      ((p_to - interval '1 second') at time zone p_zone)::date,
      case when p_repeat = 'none' then coalesce(p_end_date, p_note_date) else '9999-12-31'::date end
    ),
    interval '1 day'
  ) g
  where (p_repeat = 'none' and g::date >= p_note_date and g::date <= coalesce(p_end_date, p_note_date))
    or (p_repeat = 'weekly' and g::date >= p_note_date and (g::date - p_note_date) % 7 = 0)
    or (p_repeat = 'monthly' and g::date >= p_note_date
      and extract(day from g) = extract(day from p_note_date))
    or (p_repeat = 'yearly' and g::date >= p_note_date
      and to_char(g, 'MM-DD') = to_char(p_note_date, 'MM-DD'))
$fn$;

create function public.calendar_event_when(p_note public.calendar_notes)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case
    when p_note.all_day then to_char(p_note.note_date, 'DD/MM/YYYY')
      || case when p_note.end_date is not null and p_note.end_date > p_note.note_date
        then ' a ' || to_char(p_note.end_date, 'DD/MM/YYYY') else '' end
    else to_char(p_note.starts_at at time zone p_note.timezone, 'DD/MM/YYYY HH24:MI')
      || ' (' || p_note.timezone || ')'
  end
$fn$;

create function public.calendar_event_notify(p_note public.calendar_notes, p_change text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if p_note.kind not in ('event', 'date') then
    return;
  end if;
  perform public.notify_users(
    'calendar.event', p_note.brand_id,
    case p_change
      when 'created' then 'Novo evento no calendário'
      when 'changed' then 'Evento alterado'
      else 'Evento cancelado'
    end,
    format('«%s» · %s', p_note.title, public.calendar_event_when(p_note)),
    '/portal/brands/' || p_note.brand_id || '/calendar',
    'calendar_note', p_note.id,
    'calendar.event:' || p_note.id || ':' || p_note.version || ':' || p_change
  );
end;
$fn$;

revoke execute on function public.calendar_note_days(date, date, text, timestamptz, timestamptz, text),
  public.calendar_event_when(public.calendar_notes),
  public.calendar_event_notify(public.calendar_notes, text) from public, anon, authenticated;

create or replace function public.calendar_note_save(p_note jsonb)
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
  v_end_date date := nullif(p_note ->> 'end_date', '')::date;
  v_repeat text := coalesce(nullif(p_note ->> 'repeat', ''), 'none');
  v_expected int := nullif(p_note ->> 'expected_version', '')::int;
  v_event_type text := nullif(p_note ->> 'event_type', '');
  v_all_day boolean := coalesce((p_note ->> 'all_day')::boolean, true);
  v_starts timestamptz := nullif(p_note ->> 'starts_at', '')::timestamptz;
  v_ends timestamptz := nullif(p_note ->> 'ends_at', '')::timestamptz;
  v_zone text := nullif(btrim(coalesce(p_note ->> 'timezone', '')), '');
  v_location text := nullif(btrim(coalesce(p_note ->> 'location', '')), '');
  v_visible boolean := coalesce((p_note ->> 'client_visible')::boolean, false);
  v_internal text := nullif(btrim(coalesce(p_note ->> 'internal_notes', '')), '');
  v_old public.calendar_notes;
  v_new public.calendar_notes;
  v_brand_tz text;
  v_changed boolean;
begin
  perform public.assert_action('calendar.manage');
  if v_kind is null or v_kind not in ('idea', 'date', 'event')
    or char_length(v_title) not between 2 and 140
    or char_length(coalesce(v_description, '')) > 2000
    or char_length(coalesce(v_location, '')) > 200
    or char_length(coalesce(v_internal, '')) > 4000
    or v_repeat not in ('none', 'weekly', 'monthly', 'yearly')
    or (v_kind = 'idea' and v_visible)
    or (v_location is not null and v_location ~* '^http://') then
    raise exception 'invalid_input';
  end if;

  if v_kind = 'event' then
    if v_event_type is null or v_event_type not in ('shoot', 'meeting', 'other') then
      raise exception 'invalid_input';
    end if;
    if v_id is null then
      perform public.assert_brand_access(v_brand);
    end if;
    select b.timezone into v_brand_tz from public.brands b
    where b.id = coalesce(v_brand, (select n.brand_id from public.calendar_notes n where n.id = v_id));
    v_zone := coalesce(v_zone, v_brand_tz);
    if v_zone is null or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_zone) then
      raise exception 'invalid_input';
    end if;
    if v_all_day then
      v_starts := null;
      v_ends := null;
      if v_date is null or (v_end_date is not null and (v_end_date < v_date or v_end_date > v_date + 60)) then
        raise exception 'invalid_input';
      end if;
    else
      if v_starts is null or v_ends is null or v_ends < v_starts then
        raise exception 'invalid_input';
      end if;
      v_date := (v_starts at time zone v_zone)::date;
      v_end_date := (v_ends at time zone v_zone)::date;
      if v_end_date > v_date + 60 then
        raise exception 'invalid_input';
      end if;
    end if;
    if v_end_date = v_date then
      v_end_date := null;
    end if;
    if v_repeat <> 'none' and v_end_date is not null then
      raise exception 'invalid_input';
    end if;
  else
    if v_date is null or v_event_type is not null or v_location is not null or v_internal is not null
      or v_starts is not null or v_ends is not null or v_end_date is not null or not v_all_day then
      raise exception 'invalid_input';
    end if;
    v_zone := null;
  end if;

  if v_id is null then
    perform public.assert_brand_access(v_brand);
    if exists (select 1 from public.brands b where b.id = v_brand and b.archived_at is not null) then
      raise exception 'brand_archived';
    end if;
    insert into public.calendar_notes (
      brand_id, kind, title, description, note_date, end_date, repeat, event_type, all_day, starts_at,
      ends_at, timezone, location, client_visible, internal_notes, created_by
    )
    values (
      v_brand, v_kind, v_title, v_description, v_date, v_end_date, v_repeat, v_event_type, v_all_day,
      v_starts, v_ends, v_zone, v_location, v_visible, v_internal, auth.uid()
    )
    returning * into v_new;
    perform public.audit_write(
      public.current_organization_id(), v_brand, 'calendar_note.created', 'calendar_note', v_new.id,
      jsonb_build_object('kind', v_kind, 'client_visible', v_visible)
    );
    if v_visible then
      perform public.calendar_event_notify(v_new, 'created');
    end if;
    return jsonb_build_object('id', v_new.id, 'version', v_new.version);
  end if;

  select * into v_old from public.calendar_notes n where n.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;
  if v_old.converted_item_id is not null or v_old.archived_at is not null
    or (v_old.kind = 'event') <> (v_kind = 'event') then
    raise exception 'transition_not_allowed';
  end if;
  update public.calendar_notes
  set kind = v_kind, title = v_title, description = v_description, note_date = v_date,
      end_date = v_end_date, repeat = v_repeat, event_type = v_event_type, all_day = v_all_day,
      starts_at = v_starts, ends_at = v_ends, timezone = v_zone, location = v_location,
      client_visible = v_visible, internal_notes = v_internal, version = version + 1
  where id = v_id
  returning * into v_new;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'calendar_note.updated', 'calendar_note', v_id,
    jsonb_build_object('kind', v_kind, 'client_visible', v_visible)
  );

  v_changed := v_old.title is distinct from v_new.title
    or v_old.note_date is distinct from v_new.note_date
    or v_old.end_date is distinct from v_new.end_date
    or v_old.starts_at is distinct from v_new.starts_at
    or v_old.ends_at is distinct from v_new.ends_at
    or v_old.location is distinct from v_new.location
    or v_old.description is distinct from v_new.description
    or v_old.repeat is distinct from v_new.repeat;
  if v_new.client_visible and not v_old.client_visible then
    perform public.calendar_event_notify(v_new, 'created');
  elsif v_new.client_visible and v_changed then
    perform public.calendar_event_notify(v_new, 'changed');
  elsif v_old.client_visible and not v_new.client_visible then
    perform public.calendar_event_notify(v_new, 'cancelled');
  end if;
  return jsonb_build_object('id', v_id, 'version', v_new.version);
end;
$$;

create or replace function public.calendar_note_archive(p_note uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note public.calendar_notes;
  v_after public.calendar_notes;
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
  update public.calendar_notes set archived_at = now(), version = version + 1
  where id = p_note
  returning * into v_after;
  perform public.audit_write(
    public.current_organization_id(), v_note.brand_id, 'calendar_note.archived', 'calendar_note',
    p_note, jsonb_build_object('kind', v_note.kind, 'client_visible', v_note.client_visible)
  );
  if v_note.client_visible then
    perform public.calendar_event_notify(v_after, 'cancelled');
  end if;
end;
$$;

create or replace function public.calendar_note_get(p_note uuid)
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
    'description', v_note.description, 'note_date', v_note.note_date, 'end_date', v_note.end_date,
    'repeat', v_note.repeat, 'converted_item_id', v_note.converted_item_id,
    'archived', v_note.archived_at is not null, 'version', v_note.version,
    'event_type', v_note.event_type, 'all_day', v_note.all_day, 'starts_at', v_note.starts_at,
    'ends_at', v_note.ends_at, 'timezone', v_note.timezone, 'location', v_note.location,
    'client_visible', v_note.client_visible, 'internal_notes', v_note.internal_notes
  );
end;
$$;

create or replace function public.list_calendar_entries(
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
          'repeat', n.repeat, 'converted_item_id', n.converted_item_id, 'version', n.version,
          'event_type', n.event_type, 'all_day', n.all_day, 'end_date', n.end_date,
          'starts_at', n.starts_at, 'ends_at', n.ends_at, 'timezone', n.timezone,
          'location', n.location, 'client_visible', n.client_visible,
          'internal_notes', n.internal_notes
        ) as obj,
        case
          when n.kind = 'event' and not n.all_day
            then (d.day::timestamp + (n.starts_at at time zone n.timezone)::time) at time zone n.timezone
          else (d.day::timestamp at time zone b.timezone)
        end as sort_at,
        n.kind as kind, n.id::text as ref
      from public.calendar_notes n
      join public.brands b on b.id = n.brand_id
      cross join lateral (
        select cd as day
        from public.calendar_note_days(
          n.note_date, n.end_date, n.repeat, p_from, p_to, coalesce(n.timezone, b.timezone)
        ) cd
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

create or replace function public.portal_list_calendar(p_brand uuid, p_from timestamptz, p_to timestamptz)
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
    'events', coalesce(
      (
        select jsonb_agg(o.obj order by o.sort_at, o.note_id)
        from (
          select
            n.id as note_id,
            case
              when n.kind = 'event' and not n.all_day
                then (d.day::timestamp + (n.starts_at at time zone n.timezone)::time) at time zone n.timezone
              else (d.day::timestamp at time zone b.timezone)
            end as sort_at,
            jsonb_build_object(
              'note_id', n.id, 'kind', n.kind, 'event_type', n.event_type, 'title', n.title,
              'description', n.description, 'date', d.day, 'end_date', n.end_date,
              'all_day', n.all_day,
              'starts_at', case
                when n.starts_at is null then null
                when n.repeat = 'none' then n.starts_at
                else (d.day::timestamp + (n.starts_at at time zone n.timezone)::time) at time zone n.timezone
              end,
              'ends_at', case
                when n.ends_at is null then null
                when n.repeat = 'none' then n.ends_at
                else ((d.day::timestamp + (n.starts_at at time zone n.timezone)::time) at time zone n.timezone)
                  + (n.ends_at - n.starts_at)
              end,
              'timezone', coalesce(n.timezone, b.timezone), 'location', n.location
            ) as obj
          from public.calendar_notes n
          join public.brands b on b.id = n.brand_id
          cross join lateral (
            select cd as day
            from public.calendar_note_days(
              n.note_date, n.end_date, n.repeat, p_from, p_to, coalesce(n.timezone, b.timezone)
            ) cd
          ) d
          where n.brand_id = p_brand and n.client_visible and n.archived_at is null
            and n.kind in ('event', 'date')
          limit 500
        ) o
      ),
      '[]'::jsonb
    ),
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
              'stage', q.stage
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

commit;

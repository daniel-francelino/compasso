begin;

alter table public.content_items add column publish_date date;

create index content_items_publish_date_idx on public.content_items (brand_id, publish_date);

update public.content_items i
set publish_date = d.day
from (
  select c.content_item_id, min((c.planned_at at time zone c.planned_timezone)::date) as day
  from public.content_channels c
  where c.planned_at is not null and c.planned_timezone is not null
    and c.publication_status <> 'cancelled'
  group by c.content_item_id
) d
where d.content_item_id = i.id and i.publish_date is null;

create table public.content_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'violet'
    check (color in ('violet', 'orchid', 'rose', 'peach', 'coral', 'sage', 'cactus', 'ink_soft')),
  emoji text check (emoji is null or char_length(emoji) between 1 and 8),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index content_types_name_key on public.content_types (organization_id, lower(name));

create trigger content_types_set_updated_at before update on public.content_types
for each row execute function public.set_updated_at();

create table public.content_item_types (
  content_item_id uuid not null,
  brand_id uuid not null,
  content_type_id uuid not null references public.content_types (id),
  created_at timestamptz not null default now(),
  primary key (content_item_id, content_type_id),
  foreign key (content_item_id, brand_id)
    references public.content_items (id, brand_id) on delete cascade
);

create index content_item_types_type_idx on public.content_item_types (content_type_id);
create index content_item_types_brand_idx on public.content_item_types (brand_id);

alter table public.content_types enable row level security;
alter table public.content_item_types enable row level security;

create policy content_types_read on public.content_types for select
  using (public.has_action('content.view'));

create policy content_item_types_read on public.content_item_types for select
  using (public.has_action('content.view') and public.can_access_brand(brand_id));

revoke all on public.content_types, public.content_item_types from public, anon, authenticated;
grant select on public.content_types, public.content_item_types to authenticated;

create function public.content_type_save(p_type jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_type ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p_type ->> 'name', ''));
  v_color text := coalesce(nullif(btrim(coalesce(p_type ->> 'color', '')), ''), 'violet');
  v_emoji text := nullif(btrim(coalesce(p_type ->> 'emoji', '')), '');
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('settings.manage');
  if char_length(v_name) not between 1 and 40
    or v_color not in ('violet', 'orchid', 'rose', 'peach', 'coral', 'sage', 'cactus', 'ink_soft')
    or (v_emoji is not null and char_length(v_emoji) > 8) then
    raise exception 'invalid_input';
  end if;

  begin
    if v_id is null then
      insert into public.content_types (organization_id, name, color, emoji)
      values (v_org, v_name, v_color, v_emoji)
      returning id into v_id;
    else
      update public.content_types
      set name = v_name, color = v_color, emoji = v_emoji
      where id = v_id and organization_id = v_org;
      if not found then
        raise exception 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'content_type_name_taken';
  end;

  perform public.audit_write(v_org, null, 'content_type.saved', 'content_type', v_id, '{}'::jsonb);
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.content_type_set_archived(p_type uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('settings.manage');
  update public.content_types
  set archived_at = case when p_archived then now() else null end
  where id = p_type and organization_id = v_org;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.audit_write(
    v_org, null, 'content_type.archived', 'content_type', p_type,
    jsonb_build_object('archived', p_archived)
  );
  return jsonb_build_object('id', p_type);
end;
$$;

revoke execute on function public.content_type_save(jsonb),
  public.content_type_set_archived(uuid, boolean) from public, anon;
grant execute on function public.content_type_save(jsonb),
  public.content_type_set_archived(uuid, boolean) to authenticated;

create or replace function public.content_item_save(p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_item ->> 'id', '')::uuid;
  v_brand uuid := nullif(p_item ->> 'brand_id', '')::uuid;
  v_title text := btrim(coalesce(p_item ->> 'title', ''));
  v_notes text := nullif(btrim(coalesce(p_item ->> 'internal_notes', '')), '');
  v_assignee uuid := nullif(p_item ->> 'assignee_id', '')::uuid;
  v_publish date := nullif(p_item ->> 'publish_date', '')::date;
  v_due date := nullif(p_item ->> 'production_due_date', '')::date;
  v_has_due boolean := p_item ? 'production_due_date';
  v_expected int := nullif(p_item ->> 'expected_version', '')::int;
  v_text text := coalesce(p_item -> 'caption' ->> 'text', '');
  v_caption jsonb;
  v_cta text := nullif(btrim(coalesce(p_item ->> 'call_to_action', '')), '');
  v_media jsonb := public.content_normalize_media(p_item -> 'working_media');
  v_plan_media jsonb := public.content_normalize_media(p_item -> 'plan_media');
  v_plan_summary jsonb := case when jsonb_typeof(p_item -> 'plan_summary') = 'object' then p_item -> 'plan_summary' else null end;
  v_channels jsonb := coalesce(p_item -> 'channels', '[]'::jsonb);
  v_source_note uuid := nullif(p_item ->> 'source_note', '')::uuid;
  v_type_ids uuid[] := '{}';
  v_org uuid := public.current_organization_id();
  v_is_new boolean := nullif(p_item ->> 'id', '') is null;
  v_old public.content_items;
  v_existing public.content_channels;
  v_removed record;
  v_row jsonb;
  v_row_id uuid;
  v_channel uuid;
  v_format text;
  v_row_caption jsonb;
  v_planned timestamptz;
  v_tz text;
  v_brand_tz text;
  v_position int := 0;
  v_keep uuid[] := '{}';
  v_signature jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_out jsonb := '[]'::jsonb;
  v_plan_signature jsonb := '[]'::jsonb;
  v_plan_required boolean;
  v_version int;
begin
  if jsonb_typeof(p_item -> 'type_ids') = 'array' then
    select coalesce(array_agg(distinct t::uuid), '{}')
    into v_type_ids
    from jsonb_array_elements_text(p_item -> 'type_ids') t;
  end if;
  if char_length(v_title) not between 2 and 140
    or char_length(coalesce(v_notes, '')) > 4000
    or char_length(v_text) > 5000
    or char_length(coalesce(v_cta, '')) > 300
    or octet_length(coalesce(v_plan_summary::text, '')) > 100000
    or jsonb_array_length(v_plan_media) > 10
    or cardinality(v_type_ids) > 20
    or jsonb_typeof(v_channels) <> 'array'
    or jsonb_array_length(v_channels) > 20 then
    raise exception 'invalid_input';
  end if;
  v_caption := case when btrim(v_text) = '' then null else jsonb_build_object('text', v_text) end;

  if v_is_new then
    perform public.assert_action('content.create');
    perform public.assert_brand_access(v_brand);
    if exists (select 1 from public.brands b where b.id = v_brand and b.archived_at is not null) then
      raise exception 'brand_archived';
    end if;
    if v_assignee is not null and not public.user_can_work_on_brand(v_assignee, v_brand) then
      raise exception 'invalid_input';
    end if;
  else
    perform public.assert_action('content.update');
    select * into v_old from public.content_items i where i.id = v_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    v_brand := v_old.brand_id;
    perform public.assert_brand_access(v_brand);
    if v_expected is null or v_expected <> v_old.version then
      raise exception 'conflict';
    end if;
    if v_old.cancelled_at is not null then
      raise exception 'transition_not_allowed';
    end if;
    if v_assignee is not null and v_assignee is distinct from v_old.assignee_id
      and not public.user_can_work_on_brand(v_assignee, v_brand) then
      raise exception 'invalid_input';
    end if;
  end if;

  if exists (
    select 1 from unnest(v_type_ids) t
    where not exists (
      select 1 from public.content_types ct where ct.id = t and ct.organization_id = v_org
    )
  ) or exists (
    select 1 from public.content_types ct
    where ct.id = any (v_type_ids) and ct.archived_at is not null
      and not exists (
        select 1 from public.content_item_types l
        where l.content_item_id = v_id and l.content_type_id = ct.id
      )
  ) then
    raise exception 'invalid_input';
  end if;

  v_plan_required := case when v_is_new then public.plan_approval_required() else v_old.plan_required end;
  perform public.content_check_media(v_brand, v_media);
  perform public.content_check_media(v_brand, v_plan_media);
  select b.timezone into v_brand_tz from public.brands b where b.id = v_brand;

  for v_row in select e.value from jsonb_array_elements(v_channels) e loop
    v_channel := nullif(v_row ->> 'channel_id', '')::uuid;
    v_format := v_row ->> 'format';
    v_planned := nullif(v_row ->> 'planned_at', '')::timestamptz;
    v_tz := nullif(btrim(coalesce(v_row ->> 'planned_timezone', '')), '');
    v_row_caption := case
      when btrim(coalesce(v_row ->> 'caption', '')) = '' then null
      else jsonb_build_object('text', v_row ->> 'caption')
    end;
    if v_channel is null or v_format is null or v_format not in (
      'image', 'carousel', 'video', 'text', 'story', 'reel', 'article', 'other'
    ) or char_length(coalesce(v_row ->> 'caption', '')) > 5000
      or (v_tz is not null and not exists (
        select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz
      )) then
      raise exception 'invalid_input';
    end if;
    perform public.content_check_channel(v_brand, v_channel);
    v_tz := case when v_planned is null then null else coalesce(v_tz, v_brand_tz) end;
    v_signature := v_signature || jsonb_build_array(jsonb_build_object(
      'channel_id', v_channel, 'format', v_format, 'caption', v_row_caption, 'planned_at', v_planned
    ));
    v_plan_signature := v_plan_signature || jsonb_build_array(jsonb_build_object(
      'channel_id', v_channel, 'format', v_format, 'planned_at', v_planned
    ));
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', nullif(v_row ->> 'id', ''), 'channel_id', v_channel, 'format', v_format,
      'caption', v_row_caption, 'planned_at', v_planned, 'planned_timezone', v_tz
    ));
  end loop;

  if not v_is_new and v_old.plan_approved_revision_id is not null and (
    v_plan_signature is distinct from public.content_plan_signature(v_id)
    or v_publish is distinct from v_old.publish_date
    or v_plan_summary is distinct from v_old.plan_summary
    or v_plan_media is distinct from v_old.plan_media
  ) then
    raise exception 'plan_locked';
  end if;

  if not v_is_new and v_old.editorial_status in ('approved', 'published') and (
    v_caption is distinct from v_old.caption
    or v_cta is distinct from v_old.call_to_action
    or v_media is distinct from v_old.working_media
    or v_signature is distinct from public.content_channels_signature(v_id)
  ) then
    raise exception 'requires_new_revision';
  end if;

  if v_is_new then
    insert into public.content_items (
      brand_id, title, internal_notes, assignee_id, publish_date, production_due_date, caption,
      call_to_action, working_media, plan_required, plan_summary, plan_media, editorial_status, created_by
    )
    values (
      v_brand, v_title, v_notes, v_assignee, v_publish, v_due, v_caption, v_cta, v_media,
      v_plan_required, v_plan_summary, v_plan_media,
      case when v_plan_required then 'planning' else 'draft' end, auth.uid()
    )
    returning id, version into v_id, v_version;
    perform public.audit_write(v_org, v_brand, 'content.created', 'content_item', v_id, '{}'::jsonb);
  end if;

  for v_row in select e.value from jsonb_array_elements(v_rows) e loop
    v_row_id := nullif(v_row ->> 'id', '')::uuid;
    v_planned := nullif(v_row ->> 'planned_at', '')::timestamptz;
    if v_row_id is null then
      insert into public.content_channels (
        brand_id, content_item_id, channel_id, format, caption, planned_at, planned_timezone,
        publication_status, position
      )
      values (
        v_brand, v_id, (v_row ->> 'channel_id')::uuid, v_row ->> 'format', nullif(v_row -> 'caption', 'null'::jsonb),
        v_planned, nullif(v_row ->> 'planned_timezone', ''),
        case when v_planned is null then 'unplanned' else 'planned' end, v_position
      )
      returning id into v_row_id;
      perform public.audit_write(
        v_org, v_brand, 'content_channel.added', 'content_channel', v_row_id,
        jsonb_build_object('item_id', v_id, 'channel_id', (v_row ->> 'channel_id')::uuid)
      );
    else
      select * into v_existing from public.content_channels r
      where r.id = v_row_id and r.content_item_id = v_id for update;
      if not found then
        raise exception 'not_found';
      end if;
      if v_existing.publication_status = 'published_manually' then
        v_keep := v_keep || v_row_id;
        v_position := v_position + 1;
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_row_id, 'channel_id', v_existing.channel_id));
        continue;
      end if;
      update public.content_channels
      set channel_id = (v_row ->> 'channel_id')::uuid, format = v_row ->> 'format',
          caption = nullif(v_row -> 'caption', 'null'::jsonb), planned_at = v_planned,
          planned_timezone = nullif(v_row ->> 'planned_timezone', ''), position = v_position,
          publication_status = case when v_planned is null then 'unplanned' else 'planned' end,
          version = version + 1
      where id = v_row_id;
    end if;
    v_keep := v_keep || v_row_id;
    v_position := v_position + 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_row_id, 'channel_id', (v_row ->> 'channel_id')::uuid));
  end loop;

  if exists (
    select 1 from public.content_channels r
    where r.content_item_id = v_id and r.publication_status = 'published_manually'
      and not (r.id = any (v_keep))
  ) then
    raise exception 'transition_not_allowed';
  end if;

  for v_removed in
    select r.id, r.channel_id from public.content_channels r
    where r.content_item_id = v_id and r.publication_status in ('unplanned', 'planned')
      and not (r.id = any (v_keep))
  loop
    delete from public.content_channels where id = v_removed.id;
    perform public.audit_write(
      v_org, v_brand, 'content_channel.removed', 'content_channel', v_removed.id,
      jsonb_build_object('item_id', v_id, 'channel_id', v_removed.channel_id)
    );
  end loop;

  if not v_is_new then
    update public.content_items
    set title = v_title, internal_notes = v_notes, assignee_id = v_assignee,
        publish_date = v_publish,
        production_due_date = case when v_has_due then v_due else production_due_date end,
        caption = v_caption, call_to_action = v_cta,
        working_media = v_media, plan_summary = v_plan_summary, plan_media = v_plan_media,
        version = version + 1
    where id = v_id
    returning version into v_version;
    perform public.audit_write(v_org, v_brand, 'content.updated', 'content_item', v_id, '{}'::jsonb);
  end if;

  delete from public.content_item_types
  where content_item_id = v_id and not (content_type_id = any (v_type_ids));
  insert into public.content_item_types (content_item_id, brand_id, content_type_id)
  select v_id, v_brand, t from unnest(v_type_ids) t
  on conflict do nothing;

  if v_is_new and v_source_note is not null and public.has_action('calendar.manage') then
    update public.calendar_notes
    set converted_item_id = v_id, converted_at = now()
    where id = v_source_note and brand_id = v_brand and converted_item_id is null
      and archived_at is null;
    if found then
      perform public.audit_write(
        v_org, v_brand, 'calendar_note.converted', 'calendar_note', v_source_note,
        jsonb_build_object('item_id', v_id)
      );
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'version', v_version, 'channels', v_out);
end;
$$;

create or replace function public.audit_write(
  p_org uuid,
  p_brand uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog constant text[] := array[
    'invitation.created',
    'invitation.revoked',
    'invitation.accepted',
    'client.created',
    'client.updated',
    'client.owner_changed',
    'client.archived',
    'client.reactivated',
    'client.deleted',
    'contact.created',
    'contact.updated',
    'contact.deleted',
    'brand.created',
    'brand.updated',
    'brand.timezone_changed',
    'brand.archived',
    'brand.reactivated',
    'brand.deleted',
    'brand.member_added',
    'brand.member_revoked',
    'brand.member_can_decide_changed',
    'channel.created',
    'channel.updated',
    'channel.archived',
    'channel.reactivated',
    'channel.deleted',
    'content.created',
    'content.updated',
    'content.submitted',
    'content.reopened',
    'content.cancelled',
    'content.published',
    'content.deleted',
    'content_channel.added',
    'content_channel.removed',
    'content_channel.rescheduled',
    'content_channel.published_manually',
    'content_channel.cancelled',
    'calendar_note.created',
    'calendar_note.updated',
    'calendar_note.archived',
    'calendar_note.converted',
    'variant.created',
    'variant.updated',
    'variant.submitted',
    'variant.reopened',
    'variant.rescheduled',
    'variant.cancelled',
    'variant.published_manually',
    'comment.created',
    'comment.deleted',
    'comment.edited',
    'approval.requested',
    'approval.decided',
    'approval.superseded',
    'approval.approved_by_team',
    'approval.cancelled',
    'approval.approver_reassigned',
    'approval.reminder_sent',
    'media.published',
    'media.unpublished',
    'media.deleted_permanently',
    'media.version_replaced',
    'media.share_created',
    'media.share_revoked',
    'site.page_published',
    'site.page_unpublished',
    'site.rolled_back',
    'site.case_study_authorized',
    'site.case_study_withdrawn',
    'site.settings_changed',
    'settings.policy_changed',
    'content_type.saved',
    'content_type.archived',
    'organization.updated',
    'channel.connected',
    'channel.disconnected',
    'channel.connection_lost',
    'content_channel.published_auto',
    'content_channel.publish_failed',
    'content_channel.publish_mode_changed',
    'content_channel.publish_requested',
    'metric_mark.created',
    'metric_mark.updated',
    'metric_mark.deleted',
    'metrics_report.published',
    'metrics_report.withdrawn',
    'audit.exported'
  ];
  v_actor uuid := auth.uid();
  v_kind text;
  v_request text;
begin
  if not (p_action = any (v_catalog)) then
    raise exception 'invalid_input';
  end if;

  if v_actor is null then
    v_kind := 'system';
  else
    select p.kind into v_kind from public.profiles p where p.id = v_actor;
    v_kind := coalesce(v_kind, 'internal');
  end if;

  begin
    v_request := (current_setting('request.headers', true)::jsonb) ->> 'x-request-id';
  exception when others then
    v_request := null;
  end;

  insert into public.audit_events (
    organization_id, brand_id, actor_id, actor_kind, action, entity_type, entity_id, metadata,
    request_id
  )
  values (
    p_org, p_brand, v_actor, v_kind, p_action, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), v_request
  );
end;
$$;

commit;

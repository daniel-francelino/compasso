begin;

alter table public.content_items drop constraint content_items_editorial_status_check;
alter table public.content_items add constraint content_items_editorial_status_check check (
  editorial_status in (
    'draft', 'planning', 'awaiting_plan_approval', 'plan_changes_requested', 'plan_approved',
    'in_production', 'internal_review', 'awaiting_approval', 'changes_requested', 'approved',
    'published', 'cancelled'
  )
);

alter table public.media_versions
  add column purge_requested_at timestamptz,
  add column purge_keep_preview boolean not null default true,
  add column original_purged_at timestamptz;

create index media_versions_purge_idx on public.media_versions (purge_requested_at)
  where purge_requested_at is not null and original_purged_at is null;

create or replace function public.editorial_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select case p_from
    when 'draft' then p_to in ('planning', 'in_production', 'cancelled')
    when 'planning' then p_to in ('awaiting_plan_approval', 'cancelled')
    when 'awaiting_plan_approval' then p_to in (
      'plan_approved', 'plan_changes_requested', 'planning', 'cancelled'
    )
    when 'plan_changes_requested' then p_to in ('planning', 'awaiting_plan_approval', 'cancelled')
    when 'plan_approved' then p_to in ('in_production', 'planning', 'cancelled')
    when 'in_production' then p_to in ('internal_review', 'awaiting_approval', 'planning', 'cancelled')
    when 'internal_review' then p_to in ('awaiting_approval', 'in_production', 'planning', 'cancelled')
    when 'awaiting_approval' then p_to in (
      'approved', 'changes_requested', 'in_production', 'planning', 'cancelled'
    )
    when 'changes_requested' then p_to in ('in_production', 'planning', 'cancelled')
    when 'approved' then p_to in ('in_production', 'planning', 'published', 'cancelled')
    else false
  end
$fn$;

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
  v_objective text := nullif(btrim(coalesce(p_item ->> 'objective', '')), '');
  v_objective_kind text := nullif(btrim(coalesce(p_item ->> 'objective_kind', '')), '');
  v_briefing jsonb := case when jsonb_typeof(p_item -> 'briefing') = 'object' then p_item -> 'briefing' else null end;
  v_notes text := nullif(btrim(coalesce(p_item ->> 'internal_notes', '')), '');
  v_assignee uuid := nullif(p_item ->> 'assignee_id', '')::uuid;
  v_due date := nullif(p_item ->> 'production_due_date', '')::date;
  v_expected int := nullif(p_item ->> 'expected_version', '')::int;
  v_text text := coalesce(p_item -> 'caption' ->> 'text', '');
  v_caption jsonb;
  v_cta text := nullif(btrim(coalesce(p_item ->> 'call_to_action', '')), '');
  v_media jsonb := public.content_normalize_media(p_item -> 'working_media');
  v_plan_media jsonb := public.content_normalize_media(p_item -> 'plan_media');
  v_plan_summary text := nullif(btrim(coalesce(p_item ->> 'plan_summary', '')), '');
  v_channels jsonb := coalesce(p_item -> 'channels', '[]'::jsonb);
  v_source_note uuid := nullif(p_item ->> 'source_note', '')::uuid;
  v_tags text[] := '{}';
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
  if jsonb_typeof(p_item -> 'tags') = 'array' then
    select coalesce(array_agg(distinct btrim(t) order by btrim(t)), '{}')
    into v_tags
    from jsonb_array_elements_text(p_item -> 'tags') t
    where btrim(t) <> '';
  end if;
  if char_length(v_title) not between 2 and 140
    or char_length(coalesce(v_objective, '')) > 2000
    or (v_objective_kind is not null and v_objective_kind not in (
      'awareness', 'engagement', 'traffic', 'leads', 'sales', 'community', 'other'
    ))
    or char_length(coalesce(v_notes, '')) > 4000
    or char_length(v_text) > 5000
    or char_length(coalesce(v_cta, '')) > 300
    or char_length(coalesce(v_plan_summary, '')) > 4000
    or jsonb_array_length(v_plan_media) > 10
    or cardinality(v_tags) > 20
    or exists (select 1 from unnest(v_tags) t where char_length(t) > 40)
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
    or v_objective_kind is distinct from v_old.objective_kind
    or v_objective is distinct from v_old.objective
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
      brand_id, title, objective, objective_kind, briefing, internal_notes, assignee_id, tags,
      production_due_date, caption, call_to_action, working_media, plan_required, plan_summary,
      plan_media, editorial_status, created_by
    )
    values (
      v_brand, v_title, v_objective, v_objective_kind, v_briefing, v_notes, v_assignee, v_tags, v_due,
      v_caption, v_cta, v_media, v_plan_required, v_plan_summary, v_plan_media,
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
    set title = v_title, objective = v_objective, objective_kind = v_objective_kind,
        briefing = v_briefing, internal_notes = v_notes, assignee_id = v_assignee, tags = v_tags,
        production_due_date = v_due, caption = v_caption, call_to_action = v_cta,
        working_media = v_media, plan_summary = v_plan_summary, plan_media = v_plan_media,
        version = version + 1
    where id = v_id
    returning version into v_version;
    perform public.audit_write(v_org, v_brand, 'content.updated', 'content_item', v_id, '{}'::jsonb);
  end if;

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
                and i.editorial_status not in ('approved', 'published') then 'production_overdue' end,
              case when exists (
                select 1 from public.content_channels r
                where r.content_item_id = i.id and r.publication_status = 'planned'
                  and r.planned_at < now()
              ) then 'planned_date_passed' end,
              case when v_approvals and exists (
                select 1 from public.approval_requests q
                where q.item_id = i.id and q.status = 'pending'
                  and cardinality(public.brand_approver_ids(q.brand_id)) = 0
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
    'approval.requested',
    'approval.decided',
    'approval.superseded',
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
    'organization.updated',
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

create or replace function public.content_item_is_ready(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_items i
    where i.id = p_item and i.cancelled_at is null and i.editorial_status in ('approved', 'published')
  )
$$;

create or replace function public.media_storage_used()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    perform public.assert_action('media.view');
  end if;
  return coalesce(
    (select sum(
        case when v.original_purged_at is null then v.size_bytes else 0 end + v.derivative_bytes
      )::bigint
     from public.media_versions v where v.status <> 'failed'),
    0
  );
end;
$$;

create or replace function public.media_storage_keys()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('media.delete');
  return coalesce(
    (select jsonb_agg(jsonb_build_object('key', k.key, 'status', v.status))
     from public.media_versions v
     cross join lateral unnest(array[
       case when v.original_purged_at is null then v.storage_key end, v.thumb_key, v.display_key
     ]) as k(key)
     where k.key is not null),
    '[]'::jsonb
  );
end;
$$;

create function public.publish_content(p_item uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_version int;
  v_queued int;
begin
  perform public.assert_action('content.publish_manual');
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if v_item.version <> p_expected_version then
    raise exception 'conflict';
  end if;
  if v_item.cancelled_at is not null or v_item.editorial_status <> 'approved'
    or v_item.approved_revision_id is null then
    raise exception 'not_approved';
  end if;
  if exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status not in ('published_manually', 'cancelled')
  ) or not exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status = 'published_manually'
  ) then
    raise exception 'channels_not_published';
  end if;

  update public.content_items
  set editorial_status = 'published', version = version + 1
  where id = p_item
  returning version into v_version;

  with item_revisions as (
    select r.id from public.content_revisions r where r.item_id = p_item
  ),
  mine as (
    select m.media_version_id as version_id
    from public.content_revision_media m
    join item_revisions r on r.id = m.revision_id
    union
    select (e ->> 'media_version_id')::uuid
    from jsonb_array_elements(coalesce(v_item.working_media, '[]'::jsonb)) e
    union
    select (e ->> 'media_version_id')::uuid
    from jsonb_array_elements(coalesce(v_item.plan_media, '[]'::jsonb)) e
  ),
  kept as (
    select m.media_version_id as version_id
    from public.content_revision_media m
    where m.revision_id = v_item.approved_revision_id
  ),
  queued as (
    update public.media_versions v
    set purge_requested_at = now(),
        purge_keep_preview = exists (select 1 from kept k where k.version_id = v.id)
    where v.id in (select version_id from mine)
      and v.original_purged_at is null
      and v.purge_requested_at is null
      and v.status = 'available'
      and v.mime_type not like 'video/%'
      and v.public_published_at is null
      and not exists (
        select 1 from public.media_usages u
        where u.media_version_id = v.id
          and not (u.usage_type = 'content_revision'
            and u.usage_ref_id in (select id from item_revisions))
      )
      and not exists (
        select 1 from public.organizations o where o.logo_media_version_id = v.id
      )
      and not exists (
        select 1 from public.content_items o
        where o.id <> p_item
          and (o.working_media @> jsonb_build_array(jsonb_build_object('media_version_id', v.id))
            or o.plan_media @> jsonb_build_array(jsonb_build_object('media_version_id', v.id)))
      )
    returning v.id
  )
  select count(*) into v_queued from queued;

  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.published', 'content_item', p_item,
    jsonb_build_object('revision_id', v_item.approved_revision_id, 'purge_queued', v_queued)
  );
  return jsonb_build_object('id', p_item, 'version', v_version, 'queued', v_queued);
end;
$$;

create function public.media_purge_pending()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'keys', p.keys)), '[]'::jsonb)
  from (
    select v.id,
      array_remove(array[
        v.storage_key,
        case when v.purge_keep_preview then null else v.thumb_key end,
        case when v.purge_keep_preview then null else v.display_key end
      ], null) as keys
    from public.media_versions v
    where v.purge_requested_at is not null and v.original_purged_at is null
    order by v.purge_requested_at
    limit 200
  ) p
$$;

create function public.media_purge_confirm(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.media_versions v
  set original_purged_at = now(),
      purge_requested_at = null,
      thumb_key = case when v.purge_keep_preview then v.thumb_key else null end,
      display_key = case when v.purge_keep_preview then v.display_key else null end,
      derivative_bytes = case when v.purge_keep_preview then v.derivative_bytes else 0 end
  where v.id = any (p_ids) and v.purge_requested_at is not null and v.original_purged_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.publish_content(uuid, int) from public, anon;
grant execute on function public.publish_content(uuid, int) to authenticated;
revoke execute on function public.media_purge_pending(), public.media_purge_confirm(uuid[])
  from public, anon, authenticated;

commit;

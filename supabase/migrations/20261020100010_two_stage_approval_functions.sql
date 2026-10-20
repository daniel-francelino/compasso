begin;

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
  if v_plan_required and v_media <> '[]'::jsonb
    and (v_is_new or (v_old.plan_approved_revision_id is null and v_media is distinct from v_old.working_media)) then
    raise exception 'plan_not_approved';
  end if;

  if not v_is_new and v_old.editorial_status = 'approved' and (
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

create or replace function public.content_move(p_item uuid, p_to_status text, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.content_items;
  v_version int;
begin
  perform public.assert_action('content.update');
  select * into v_old from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if p_expected_version is null or p_expected_version <> v_old.version then
    raise exception 'conflict';
  end if;
  if p_to_status not in ('planning', 'in_production', 'internal_review')
    or not public.editorial_transition_allowed(v_old.editorial_status, p_to_status) then
    raise exception 'transition_not_allowed';
  end if;
  if p_to_status = 'planning'
    and (not v_old.plan_required or v_old.editorial_status not in ('draft', 'plan_changes_requested')) then
    raise exception 'transition_not_allowed';
  end if;
  if p_to_status = 'in_production' and v_old.editorial_status = 'draft' and v_old.plan_required then
    raise exception 'plan_not_approved';
  end if;
  update public.content_items
  set editorial_status = p_to_status, version = version + 1
  where id = p_item
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'content.updated', 'content_item', p_item,
    jsonb_build_object('from', v_old.editorial_status, 'to', p_to_status)
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;

drop function public.submit_for_approval(uuid, uuid, date, text, int);

create function public.submit_for_approval(
  p_item uuid,
  p_due_date date,
  p_message text,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_item public.content_items;
  v_brand public.brands;
  v_old public.approval_requests;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_stage text;
  v_media jsonb;
  v_snapshot jsonb;
  v_channels jsonb;
  v_names text;
  v_revision uuid;
  v_request uuid;
  v_recipients uuid[];
  v_no int;
  v_version int;
begin
  perform public.assert_action('content.submit');
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if p_expected_version is null or p_expected_version <> v_item.version then
    raise exception 'conflict';
  end if;
  v_stage := case
    when v_item.editorial_status in ('planning', 'plan_changes_requested', 'awaiting_plan_approval') then 'plan'
    when v_item.editorial_status in ('in_production', 'internal_review', 'awaiting_approval') then 'art'
    else null
  end;
  if v_item.cancelled_at is not null or v_stage is null then
    raise exception 'transition_not_allowed';
  end if;
  if v_stage = 'art' and v_item.plan_required and v_item.plan_approved_revision_id is null then
    raise exception 'plan_not_approved';
  end if;
  v_recipients := public.brand_approver_ids(v_item.brand_id);
  if cardinality(v_recipients) = 0 then
    raise exception 'approver_required';
  end if;
  if char_length(coalesce(v_message, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  select * into v_brand from public.brands b where b.id = v_item.brand_id;

  if not exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status <> 'cancelled'
  ) then
    raise exception 'channel_required';
  end if;
  if exists (
    select 1 from public.content_channels r
    join public.channels c on c.id = r.channel_id
    where r.content_item_id = p_item and r.publication_status <> 'cancelled'
      and c.archived_at is not null
  ) then
    raise exception 'channel_archived';
  end if;
  v_media := case when v_stage = 'plan' then v_item.plan_media else v_item.working_media end;
  perform public.content_check_media(v_item.brand_id, v_media);
  if v_stage = 'plan' and not exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status <> 'cancelled' and r.planned_at is not null
  ) then
    raise exception 'plan_incomplete';
  end if;
  if v_stage = 'art'
    and btrim(coalesce(v_item.caption ->> 'text', '')) = '' and jsonb_array_length(v_media) = 0 then
    raise exception 'invalid_input';
  end if;
  if p_due_date is not null and p_due_date < (now() at time zone v_brand.timezone)::date then
    raise exception 'invalid_input';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'row_id', r.id, 'id', c.id, 'platform', c.platform, 'profile_name', c.profile_name,
      'format', r.format, 'caption', r.caption, 'planned_at', r.planned_at,
      'planned_timezone', r.planned_timezone
    )
    order by r.position, r.created_at
  ),
  string_agg(c.profile_name, ', ' order by r.position, r.created_at)
  into v_channels, v_names
  from public.content_channels r
  join public.channels c on c.id = r.channel_id
  where r.content_item_id = p_item and r.publication_status <> 'cancelled';

  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.content_revisions r where r.item_id = p_item;

  v_snapshot := case
    when v_stage = 'plan' then jsonb_build_object(
      'stage', 'plan',
      'title', v_item.title,
      'objective_kind', v_item.objective_kind,
      'plan_summary', v_item.plan_summary,
      'caption', v_item.caption,
      'brand_timezone', v_brand.timezone,
      'channels', v_channels
    )
    else jsonb_build_object(
      'stage', 'art',
      'title', v_item.title,
      'caption', v_item.caption,
      'call_to_action', v_item.call_to_action,
      'brand_timezone', v_brand.timezone,
      'channels', v_channels
    )
  end;

  insert into public.content_revisions (item_id, brand_id, revision_no, snapshot, stage, created_by)
  values (p_item, v_item.brand_id, v_no, v_snapshot, v_stage, auth.uid())
  returning id into v_revision;

  insert into public.content_revision_media (revision_id, media_version_id, position, alt_text)
  select v_revision, (e.value ->> 'media_version_id')::uuid, (e.ordinality - 1)::int, e.value ->> 'alt_text'
  from jsonb_array_elements(v_media) with ordinality as e (value, ordinality);

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id, alt_text)
  select (e.value ->> 'media_version_id')::uuid, 'content_revision', v_revision, e.value ->> 'alt_text'
  from jsonb_array_elements(v_media) as e (value)
  on conflict do nothing;

  select * into v_old from public.approval_requests q
  where q.item_id = p_item and q.status = 'pending' for update;
  if found then
    update public.approval_requests set status = 'superseded', decided_at = now() where id = v_old.id;
    perform public.resolve_notifications('approval_request', v_old.id);
  end if;

  insert into public.approval_requests (
    brand_id, item_id, revision_id, stage, requested_by, due_date, message
  )
  values (v_item.brand_id, p_item, v_revision, v_stage, auth.uid(), p_due_date, v_message)
  returning id into v_request;

  update public.content_items
  set editorial_status = case when v_stage = 'plan' then 'awaiting_plan_approval' else 'awaiting_approval' end,
      current_revision_id = v_revision,
      approved_revision_id = case when v_stage = 'art' then null else approved_revision_id end,
      approval_due_date = p_due_date,
      version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    v_org, v_item.brand_id, 'content.submitted', 'content_item', p_item,
    jsonb_build_object('revision_no', v_no, 'request_id', v_request, 'stage', v_stage)
  );
  perform public.audit_write(
    v_org, v_item.brand_id, 'approval.requested', 'approval_request', v_request,
    jsonb_build_object('revision_id', v_revision, 'stage', v_stage)
  );

  if v_old.id is not null then
    perform public.audit_write(
      v_org, v_item.brand_id, 'approval.superseded', 'approval_request', v_old.id,
      jsonb_build_object('replaced_by', v_request)
    );
    perform public.notify_users(
      'approval.superseded', v_item.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
      'approval_request', v_old.id, 'approval.superseded:' || v_old.id,
      v_recipients
    );
  end if;

  perform public.notify_users(
    'approval.requested', v_item.brand_id,
    case when v_stage = 'plan' then 'Planejamento aguarda sua decisão' else 'Artes aguardam sua decisão' end,
    case when v_stage = 'plan'
      then format('O planejamento de «%s» (%s) aguarda sua decisão.', v_item.title, v_names)
      else format('As artes de «%s» (%s) aguardam sua decisão.', v_item.title, v_names)
    end,
    '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    v_recipients
  );

  return jsonb_build_object(
    'request_id', v_request, 'revision_id', v_revision, 'revision_no', v_no, 'version', v_version,
    'stage', v_stage
  );
end;
$$;

drop function public.reopen_content(uuid, text);

create function public.reopen_content(p_item uuid, p_reason text, p_scope text default 'art')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_old public.approval_requests;
  v_target text;
  v_version int;
begin
  perform public.assert_action('content.reopen');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  if p_scope is null or p_scope not in ('art', 'plan') then
    raise exception 'invalid_input';
  end if;
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status = 'published_manually'
  ) then
    raise exception 'transition_not_allowed';
  end if;
  if p_scope = 'art' and v_item.editorial_status not in ('approved', 'awaiting_approval') then
    raise exception 'transition_not_allowed';
  end if;
  if p_scope = 'plan' and (
    not v_item.plan_required
    or v_item.editorial_status not in (
      'awaiting_plan_approval', 'plan_approved', 'in_production', 'internal_review',
      'awaiting_approval', 'changes_requested', 'approved'
    )
  ) then
    raise exception 'transition_not_allowed';
  end if;
  v_target := case when p_scope = 'plan' then 'planning' else 'in_production' end;

  select * into v_old from public.approval_requests q
  where q.item_id = p_item and q.status = 'pending' for update;
  if found then
    update public.approval_requests set status = 'superseded', decided_at = now() where id = v_old.id;
    perform public.resolve_notifications('approval_request', v_old.id);
    perform public.audit_write(
      public.current_organization_id(), v_item.brand_id, 'approval.superseded', 'approval_request',
      v_old.id, jsonb_build_object('reason', 'reopened')
    );
    perform public.notify_users(
      'approval.superseded', v_item.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_item.brand_id || '/approvals/' || v_old.id,
      'approval_request', v_old.id, 'approval.superseded:' || v_old.id,
      public.brand_approver_ids(v_item.brand_id)
    );
  end if;

  update public.content_items
  set editorial_status = v_target,
      approved_revision_id = null,
      plan_approved_revision_id = case when p_scope = 'plan' then null else plan_approved_revision_id end,
      version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.reopened', 'content_item', p_item,
    jsonb_build_object('reason', v_reason, 'from', v_item.editorial_status, 'scope', p_scope)
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;

create or replace function public.cancel_request(p_request uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_item public.content_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_item_id uuid;
begin
  perform public.assert_action('content.submit');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select q.item_id into v_item_id from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_item from public.content_items i where i.id = v_item_id for update;
  perform public.assert_brand_access(v_item.brand_id);
  select * into v_request from public.approval_requests q where q.id = p_request for update;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  update public.approval_requests
  set status = 'cancelled', cancelled_reason = v_reason, decided_at = now()
  where id = p_request;
  perform public.resolve_notifications('approval_request', p_request);
  if v_item.editorial_status = 'awaiting_approval' then
    update public.content_items
    set editorial_status = 'in_production', version = version + 1
    where id = v_item_id;
  elsif v_item.editorial_status = 'awaiting_plan_approval' then
    update public.content_items
    set editorial_status = 'planning', version = version + 1
    where id = v_item_id;
  end if;
  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.cancelled', 'approval_request',
    p_request, jsonb_build_object('reason', v_reason)
  );
end;
$$;

create or replace function public.send_approval_reminder(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_item public.content_items;
  v_names text;
  v_recipients uuid[];
begin
  perform public.assert_action('content.submit');
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_request.brand_id);
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  v_recipients := public.brand_approver_ids(v_request.brand_id);
  if cardinality(v_recipients) = 0 then
    raise exception 'approver_required';
  end if;
  select * into v_item from public.content_items i where i.id = v_request.item_id;
  select string_agg(c ->> 'profile_name', ', ') into v_names
  from public.content_revisions r, jsonb_array_elements(r.snapshot -> 'channels') c
  where r.id = v_request.revision_id;
  perform public.notify_users(
    'approval.requested', v_request.brand_id,
    case when v_request.stage = 'plan' then 'Planejamento aguarda sua decisão' else 'Artes aguardam sua decisão' end,
    case when v_request.stage = 'plan'
      then format('O planejamento de «%s» (%s) aguarda sua decisão.', v_item.title, v_names)
      else format('As artes de «%s» (%s) aguardam sua decisão.', v_item.title, v_names)
    end,
    '/portal/brands/' || v_request.brand_id || '/approvals/' || p_request,
    'approval_request', p_request,
    'approval.requested:' || p_request || ':reminder:' || to_char(now(), 'YYYYMMDDHH24'),
    v_recipients
  );
  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.reminder_sent', 'approval_request',
    p_request, '{}'::jsonb
  );
end;
$$;

create or replace function public.reschedule_channel(
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
  v_recipients uuid[];
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

  if v_item.plan_required and v_item.editorial_status in (
    'awaiting_plan_approval', 'plan_approved', 'in_production', 'internal_review',
    'awaiting_approval', 'changes_requested', 'approved'
  ) then
    raise exception 'plan_locked';
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
  v_recipients := public.brand_approver_ids(v_row.brand_id);
  if cardinality(v_recipients) = 0 then
    raise exception 'approver_required';
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
    brand_id, item_id, revision_id, stage, requested_by, due_date
  )
  values (v_row.brand_id, v_item.id, v_revision, 'art', auth.uid(), v_due)
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
    jsonb_build_object('revision_id', v_revision, 'stage', 'art')
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
      v_recipients
    );
  end if;

  perform public.notify_users(
    'approval.requested', v_row.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_names),
    '/portal/brands/' || v_row.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    v_recipients
  );

  return jsonb_build_object(
    'id', p_channel_row, 'version', v_version, 'resubmitted', true, 'request_id', v_request,
    'revision_no', v_no
  );
end;
$$;

create or replace function public.portal_request_row(p_request public.approval_requests)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'item_id', q.item_id,
    'revision_id', r.id,
    'stage', q.stage,
    'status', q.status,
    'title', r.snapshot ->> 'title',
    'channels', coalesce(r.snapshot -> 'channels', '[]'::jsonb),
    'brand_timezone', r.snapshot ->> 'brand_timezone',
    'revision_no', r.revision_no,
    'due_date', q.due_date,
    'requested_at', q.requested_at,
    'decided_at', q.decided_at,
    'can_decide', q.status = 'pending'
      and i.current_revision_id = r.id
      and public.has_action('approvals.decide')
      and public.approver_is_valid(q.brand_id, auth.uid()),
    'decided_by_name', (
      select p.full_name
      from public.approval_decisions d
      join public.profiles p on p.id = d.decided_by
      where d.request_id = q.id
    ),
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
        where m.revision_id = r.id
      ),
      '[]'::jsonb
    )
  )
  from public.approval_requests q
  join public.content_revisions r on r.id = q.revision_id and r.item_id = q.item_id and r.brand_id = q.brand_id
  join public.content_items i on i.id = q.item_id and i.brand_id = q.brand_id
  where q.id = p_request.id
    and q.revision_id = p_request.revision_id
    and q.brand_id = p_request.brand_id
    and public.has_action('portal.view')
    and public.is_external_brand_member(q.brand_id)
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
    'stage', v_request.stage,
    'plan_summary', v_revision.snapshot ->> 'plan_summary',
    'objective_kind', v_revision.snapshot ->> 'objective_kind',
    'can_decide', v_request.status = 'pending'
      and v_item.current_revision_id = v_request.revision_id
      and public.has_action('approvals.decide')
      and public.approver_is_valid(v_request.brand_id, auth.uid()),
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
  v_expected text;
  v_status text;
begin
  perform public.assert_action('approvals.decide');
  select q.item_id, q.brand_id into v_probe from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_probe.brand_id) then
    raise exception 'not_found';
  end if;

  select * into v_item from public.content_items i where i.id = v_probe.item_id for update;
  select * into v_request from public.approval_requests q where q.id = p_request for update;

  if not public.approver_is_valid(v_request.brand_id, auth.uid()) then
    raise exception 'denied';
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
  v_expected := case when v_request.stage = 'plan' then 'awaiting_plan_approval' else 'awaiting_approval' end;
  if v_item.editorial_status <> v_expected then
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

  v_status := case
    when v_request.stage = 'plan' and p_outcome = 'approved' then 'plan_approved'
    when v_request.stage = 'plan' then 'plan_changes_requested'
    else p_outcome
  end;

  update public.content_items
  set editorial_status = v_status,
      plan_approved_revision_id = case
        when v_request.stage = 'plan' and p_outcome = 'approved' then v_request.revision_id
        else plan_approved_revision_id
      end,
      approved_revision_id = case
        when v_request.stage = 'art' and p_outcome = 'approved' then v_request.revision_id
        when v_request.stage = 'art' then null
        else approved_revision_id
      end,
      version = version + 1
  where id = v_request.item_id;

  select * into v_brand from public.brands b where b.id = v_request.brand_id;
  select string_agg(c ->> 'profile_name', ', ') into v_names
  from public.content_revisions r, jsonb_array_elements(r.snapshot -> 'channels') c
  where r.id = v_request.revision_id;

  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.decided', 'approval_request',
    p_request,
    jsonb_build_object('outcome', p_outcome, 'revision_id', v_request.revision_id, 'stage', v_request.stage)
  );
  perform public.resolve_notifications('approval_request', p_request);

  select array_agg(distinct u) into v_recipients
  from unnest(array[v_request.requested_by, v_item.assignee_id]) u
  where u is not null;
  if v_recipients is not null then
    perform public.notify_users(
      'approval.decided', v_request.brand_id, 'Aprovação concluída',
      case
        when v_request.stage = 'plan' and p_outcome = 'approved'
          then format('%s aprovou o planejamento de «%s».', v_brand.name, v_item.title)
        when v_request.stage = 'plan'
          then format('%s pediu alterações no planejamento de «%s».', v_brand.name, v_item.title)
        when p_outcome = 'approved'
          then format('%s aprovou «%s» (%s).', v_brand.name, v_item.title, v_names)
        else format('%s pediu alterações em «%s».', v_brand.name, v_item.title)
      end,
      '/admin/marketing/approvals/' || p_request,
      'approval_request', p_request, 'approval.decided:' || p_request, v_recipients
    );
  end if;
  return jsonb_build_object('status', p_outcome, 'stage', v_request.stage);
end;
$$;

create or replace function public.portal_list_pending(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.portal_assert_member(p_brand);
  return coalesce(
    (
      select jsonb_agg(public.portal_request_row(q) order by q.due_date nulls last, q.requested_at)
      from public.approval_requests q
      where q.brand_id = p_brand and q.status = 'pending'
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.portal_record_view(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_request.brand_id) then
    raise exception 'not_found';
  end if;
  if public.approver_is_valid(v_request.brand_id, auth.uid())
    and v_request.viewed_at is null and v_request.status = 'pending' then
    update public.approval_requests set viewed_at = now() where id = p_request;
  end if;
end;
$$;

create or replace function public.portal_list_brands()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'client_name', c.name,
          'pending_count', case
            when public.approver_is_valid(b.id, auth.uid()) then (
              select count(*)::int from public.approval_requests q
              where q.brand_id = b.id and q.status = 'pending'
            )
            else 0
          end
        )
        order by b.name
      )
      from public.brands b
      join public.clients c on c.id = b.client_id
      where b.archived_at is null and public.is_external_brand_member(b.id)
    ),
    '[]'::jsonb
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

revoke execute on function public.submit_for_approval(uuid, date, text, int),
  public.reopen_content(uuid, text, text) from public, anon;
grant execute on function public.submit_for_approval(uuid, date, text, int),
  public.reopen_content(uuid, text, text) to authenticated;

commit;

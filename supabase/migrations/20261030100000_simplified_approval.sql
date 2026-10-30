begin;

update public.approval_requests q
set status = 'superseded', decided_at = now()
from public.content_items i
where q.item_id = i.id and q.status = 'pending' and q.stage = 'plan'
  and i.editorial_status = 'awaiting_plan_approval';

alter table public.content_items drop constraint content_items_editorial_status_check;

update public.content_items
set editorial_status = case editorial_status
    when 'draft' then 'planning'
    when 'awaiting_plan_approval' then 'planning'
    when 'plan_changes_requested' then 'changes_requested'
    when 'plan_approved' then 'in_production'
    when 'internal_review' then 'in_production'
    else editorial_status
  end,
  plan_approved_revision_id = null
where editorial_status in (
    'draft', 'awaiting_plan_approval', 'plan_changes_requested', 'plan_approved', 'internal_review'
  ) or plan_approved_revision_id is not null;

alter table public.content_items add constraint content_items_editorial_status_check check (
  editorial_status in (
    'planning', 'in_production', 'awaiting_approval', 'changes_requested', 'approved', 'published',
    'cancelled'
  )
);
alter table public.content_items alter column editorial_status set default 'planning';

create or replace function public.editorial_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select case p_from
    when 'planning' then p_to in ('in_production', 'awaiting_approval', 'approved', 'cancelled')
    when 'in_production' then p_to in ('planning', 'awaiting_approval', 'approved', 'cancelled')
    when 'changes_requested' then p_to in (
      'planning', 'in_production', 'awaiting_approval', 'approved', 'cancelled'
    )
    when 'awaiting_approval' then p_to in (
      'planning', 'in_production', 'approved', 'changes_requested', 'cancelled'
    )
    when 'approved' then p_to in ('planning', 'in_production', 'published', 'cancelled')
    else false
  end
$fn$;

create function public.content_submit_stage(p_item public.content_items)
returns text
language sql
immutable
set search_path = ''
as $fn$
  select case
    when btrim(coalesce(p_item.caption ->> 'text', '')) <> ''
      or jsonb_array_length(p_item.working_media) > 0 then 'art'
    else 'plan'
  end
$fn$;

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
  if p_to_status not in ('planning', 'in_production')
    or v_old.editorial_status = 'awaiting_approval'
    or (v_old.editorial_status = 'approved' and v_old.approved_revision_id is not null)
    or not public.editorial_transition_allowed(v_old.editorial_status, p_to_status) then
    raise exception 'transition_not_allowed';
  end if;
  update public.content_items
  set editorial_status = p_to_status, approved_revision_id = null, version = version + 1
  where id = p_item
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'content.updated', 'content_item', p_item,
    jsonb_build_object('from', v_old.editorial_status, 'to', p_to_status)
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;;

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
      'planning', auth.uid()
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
$$;;

create or replace function public.submit_for_approval(
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
  v_frozen jsonb;
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
  if v_item.cancelled_at is not null or v_item.editorial_status not in (
    'planning', 'in_production', 'changes_requested', 'awaiting_approval'
  ) then
    raise exception 'transition_not_allowed';
  end if;
  v_stage := public.content_submit_stage(v_item);
  if v_stage = 'plan' and v_item.plan_summary is null and jsonb_array_length(v_item.plan_media) = 0 then
    raise exception 'invalid_input';
  end if;
  v_recipients := public.brand_approver_ids(v_item.brand_id);
  if cardinality(v_recipients) = 0 then
    raise exception 'approver_required';
  end if;
  if char_length(coalesce(v_message, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  select * into v_brand from public.brands b where b.id = v_item.brand_id;

  if p_due_date is not null and p_due_date < (now() at time zone v_brand.timezone)::date then
    raise exception 'invalid_input';
  end if;
  v_frozen := public.content_freeze_revision(v_item, v_stage);
  v_revision := (v_frozen ->> 'revision_id')::uuid;
  v_no := (v_frozen ->> 'revision_no')::int;
  v_names := v_frozen ->> 'channel_names';

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
  set editorial_status = 'awaiting_approval',
      current_revision_id = v_revision,
      approved_revision_id = null,
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
    'Conteúdo aguarda sua decisão',
    format('«%s» (%s) aguarda sua decisão.', v_item.title, v_names),
    '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    v_recipients
  );

  return jsonb_build_object(
    'request_id', v_request, 'revision_id', v_revision, 'revision_no', v_no, 'version', v_version,
    'stage', v_stage
  );
end;
$$;;

drop function public.approve_on_behalf(uuid, text, text, int);

create function public.approve_on_behalf(
  p_item uuid,
  p_reason text,
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_pending public.approval_requests;
  v_had_pending boolean;
  v_frozen jsonb;
  v_revision uuid;
  v_request uuid;
  v_no int;
  v_stage text;
  v_recipients uuid[];
  v_version int;
begin
  perform public.assert_action('approvals.override');
  if char_length(coalesce(v_reason, '')) > 500 then
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
  if v_item.editorial_status not in (
    'planning', 'in_production', 'changes_requested', 'awaiting_approval'
  ) then
    raise exception 'transition_not_allowed';
  end if;
  v_stage := public.content_submit_stage(v_item);
  if v_stage = 'plan' and v_item.plan_summary is null and jsonb_array_length(v_item.plan_media) = 0 then
    raise exception 'invalid_input';
  end if;

  select * into v_pending from public.approval_requests q
  where q.item_id = p_item and q.status = 'pending' for update;
  v_had_pending := found;

  if v_had_pending then
    v_request := v_pending.id;
    v_revision := v_pending.revision_id;
    v_stage := v_pending.stage;
    select r.revision_no into v_no from public.content_revisions r where r.id = v_revision;
    update public.approval_requests set status = 'approved', decided_at = now() where id = v_request;
  else
    v_frozen := public.content_freeze_revision(v_item, v_stage);
    v_revision := (v_frozen ->> 'revision_id')::uuid;
    v_no := (v_frozen ->> 'revision_no')::int;
    insert into public.approval_requests (brand_id, item_id, revision_id, stage, requested_by, status, decided_at)
    values (v_item.brand_id, p_item, v_revision, v_stage, auth.uid(), 'approved', now())
    returning id into v_request;
  end if;

  insert into public.approval_decisions (request_id, revision_id, decided_by, outcome, on_behalf, reason)
  values (v_request, v_revision, auth.uid(), 'approved', true, v_reason);

  update public.content_items
  set editorial_status = 'approved',
      current_revision_id = v_revision,
      approved_revision_id = case when v_stage = 'art' then v_revision else null end,
      version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    v_org, v_item.brand_id, 'approval.approved_by_team', 'approval_request', v_request,
    jsonb_build_object(
      'stage', v_stage, 'revision_no', v_no, 'had_pending', v_had_pending, 'reason_given', v_reason is not null
    )
  );

  if v_had_pending then
    perform public.resolve_notifications('approval_request', v_request);
    v_recipients := public.brand_approver_ids(v_item.brand_id);
    if cardinality(v_recipients) > 0 then
      perform public.notify_users(
        'approval.approved_by_team', v_item.brand_id, 'A equipe aprovou',
        format('A equipe aprovou «%s».', v_item.title),
        '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
        'approval_request', v_request, 'approval.approved_by_team:' || v_request, v_recipients
      );
    end if;
  end if;

  return jsonb_build_object(
    'request_id', v_request, 'revision_id', v_revision, 'version', v_version, 'stage', v_stage
  );
end;
$$;;

revoke execute on function public.approve_on_behalf(uuid, text, int) from public, anon;
grant execute on function public.approve_on_behalf(uuid, text, int) to authenticated;

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
      approved_revision_id = case
        when v_request.stage = 'art' and p_outcome = 'approved' then v_request.revision_id
        else null
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
$$;;

drop function public.reopen_content(uuid, text, text);

create function public.reopen_content(p_item uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_old public.approval_requests;
  v_version int;
begin
  perform public.assert_action('content.reopen');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
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
  if v_item.editorial_status not in ('approved', 'awaiting_approval', 'changes_requested') then
    raise exception 'transition_not_allowed';
  end if;

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
  set editorial_status = 'in_production',
      approved_revision_id = null,
      version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.reopened', 'content_item', p_item,
    jsonb_build_object('reason', v_reason, 'from', v_item.editorial_status)
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;;

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
$$;;

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
    'Conteúdo aguarda sua decisão',
    format('«%s» (%s) aguarda sua decisão.', v_item.title, v_names),
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
$$;;


commit;

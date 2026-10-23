begin;

alter table public.approval_decisions
  add column on_behalf boolean not null default false,
  add column reason text check (reason is null or char_length(reason) <= 500);

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('approvals.override', 'approvals', 'Approve on the client''s behalf', false, false, '{content.submit}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, 'approvals.override' from public.roles r where r.key = 'manager'
on conflict do nothing;

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
values (
  'approval.approved_by_team', 'A equipe aprovou', 'approvals.decide', 'info', null, false, true,
  false, true
)
on conflict (kind) do nothing;

create or replace function public.editorial_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $fn$
  select case p_from
    when 'draft' then p_to in ('planning', 'in_production', 'plan_approved', 'approved', 'cancelled')
    when 'planning' then p_to in ('awaiting_plan_approval', 'plan_approved', 'cancelled')
    when 'awaiting_plan_approval' then p_to in (
      'plan_approved', 'plan_changes_requested', 'planning', 'cancelled'
    )
    when 'plan_changes_requested' then p_to in (
      'planning', 'awaiting_plan_approval', 'plan_approved', 'cancelled'
    )
    when 'plan_approved' then p_to in ('in_production', 'planning', 'approved', 'cancelled')
    when 'in_production' then p_to in (
      'internal_review', 'awaiting_approval', 'approved', 'planning', 'cancelled'
    )
    when 'internal_review' then p_to in (
      'awaiting_approval', 'in_production', 'approved', 'planning', 'cancelled'
    )
    when 'awaiting_approval' then p_to in (
      'approved', 'changes_requested', 'in_production', 'planning', 'cancelled'
    )
    when 'changes_requested' then p_to in ('in_production', 'approved', 'planning', 'cancelled')
    when 'approved' then p_to in ('in_production', 'planning', 'published', 'cancelled')
    else false
  end
$fn$;

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

create function public.content_freeze_revision(v_item public.content_items, v_stage text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand public.brands;
  v_media jsonb;
  v_snapshot jsonb;
  v_channels jsonb;
  v_names text;
  v_revision uuid;
  v_no int;
begin
  select * into v_brand from public.brands b where b.id = v_item.brand_id;

  if not exists (
    select 1 from public.content_channels r
    where r.content_item_id = v_item.id and r.publication_status <> 'cancelled'
  ) then
    raise exception 'channel_required';
  end if;
  if exists (
    select 1 from public.content_channels r
    join public.channels c on c.id = r.channel_id
    where r.content_item_id = v_item.id and r.publication_status <> 'cancelled'
      and c.archived_at is not null
  ) then
    raise exception 'channel_archived';
  end if;
  v_media := case when v_stage = 'plan' then v_item.plan_media else v_item.working_media end;
  perform public.content_check_media(v_item.brand_id, v_media);
  if v_stage = 'plan' and not exists (
    select 1 from public.content_channels r
    where r.content_item_id = v_item.id and r.publication_status <> 'cancelled' and r.planned_at is not null
  ) then
    raise exception 'plan_incomplete';
  end if;
  if v_stage = 'art'
    and btrim(coalesce(v_item.caption ->> 'text', '')) = '' and jsonb_array_length(v_media) = 0 then
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
  where r.content_item_id = v_item.id and r.publication_status <> 'cancelled';

  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.content_revisions r where r.item_id = v_item.id;

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
  values (v_item.id, v_item.brand_id, v_no, v_snapshot, v_stage, auth.uid())
  returning id into v_revision;

  insert into public.content_revision_media (revision_id, media_version_id, position, alt_text)
  select v_revision, (e.value ->> 'media_version_id')::uuid, (e.ordinality - 1)::int, e.value ->> 'alt_text'
  from jsonb_array_elements(v_media) with ordinality as e (value, ordinality);

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id, alt_text)
  select (e.value ->> 'media_version_id')::uuid, 'content_revision', v_revision, e.value ->> 'alt_text'
  from jsonb_array_elements(v_media) as e (value)
  on conflict do nothing;

  return jsonb_build_object('revision_id', v_revision, 'revision_no', v_no, 'channel_names', v_names);
end;
$$;

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

create function public.approve_on_behalf(
  p_item uuid,
  p_stage text,
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
  v_status text;
  v_recipients uuid[];
  v_version int;
begin
  perform public.assert_action('approvals.override');
  if p_stage is null or p_stage not in ('plan', 'art') or char_length(coalesce(v_reason, '')) > 500 then
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
  if p_stage = 'plan' and (
    not v_item.plan_required
    or v_item.editorial_status not in ('draft', 'planning', 'awaiting_plan_approval', 'plan_changes_requested')
  ) then
    raise exception 'transition_not_allowed';
  end if;
  if p_stage = 'art' and v_item.plan_required and v_item.plan_approved_revision_id is null then
    raise exception 'plan_not_approved';
  end if;
  if p_stage = 'art' and v_item.editorial_status not in (
    'draft', 'plan_approved', 'in_production', 'internal_review', 'awaiting_approval', 'changes_requested'
  ) then
    raise exception 'transition_not_allowed';
  end if;

  select * into v_pending from public.approval_requests q
  where q.item_id = p_item and q.stage = p_stage and q.status = 'pending' for update;
  v_had_pending := found;

  if v_had_pending then
    v_request := v_pending.id;
    v_revision := v_pending.revision_id;
    select r.revision_no into v_no from public.content_revisions r where r.id = v_revision;
    update public.approval_requests set status = 'approved', decided_at = now() where id = v_request;
  else
    v_frozen := public.content_freeze_revision(v_item, p_stage);
    v_revision := (v_frozen ->> 'revision_id')::uuid;
    v_no := (v_frozen ->> 'revision_no')::int;
    insert into public.approval_requests (brand_id, item_id, revision_id, stage, requested_by, status, decided_at)
    values (v_item.brand_id, p_item, v_revision, p_stage, auth.uid(), 'approved', now())
    returning id into v_request;
  end if;

  insert into public.approval_decisions (request_id, revision_id, decided_by, outcome, on_behalf, reason)
  values (v_request, v_revision, auth.uid(), 'approved', true, v_reason);

  v_status := case when p_stage = 'plan' then 'plan_approved' else 'approved' end;
  update public.content_items
  set editorial_status = v_status,
      current_revision_id = v_revision,
      plan_approved_revision_id = case when p_stage = 'plan' then v_revision else plan_approved_revision_id end,
      approved_revision_id = case when p_stage = 'art' then v_revision else approved_revision_id end,
      version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    v_org, v_item.brand_id, 'approval.approved_by_team', 'approval_request', v_request,
    jsonb_build_object(
      'stage', p_stage, 'revision_no', v_no, 'had_pending', v_had_pending, 'reason_given', v_reason is not null
    )
  );

  if v_had_pending then
    perform public.resolve_notifications('approval_request', v_request);
    v_recipients := public.brand_approver_ids(v_item.brand_id);
    if cardinality(v_recipients) > 0 then
      perform public.notify_users(
        'approval.approved_by_team', v_item.brand_id, 'A equipe aprovou',
        format(
          'A equipe aprovou «%s» (%s).', v_item.title,
          case when p_stage = 'plan' then 'Planejamento' else 'Artes' end
        ),
        '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
        'approval_request', v_request, 'approval.approved_by_team:' || v_request, v_recipients
      );
    end if;
  end if;

  return jsonb_build_object(
    'request_id', v_request, 'revision_id', v_revision, 'version', v_version, 'stage', p_stage
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
    'objective_kind', r.snapshot ->> 'objective_kind',
    'plan_summary', r.snapshot -> 'plan_summary',
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
      where d.request_id = q.id and not d.on_behalf
    ),
    'decided_on_behalf', coalesce(
      (select d.on_behalf from public.approval_decisions d where d.request_id = q.id),
      false
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
    'plan_summary', v_revision.snapshot -> 'plan_summary',
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
        'decided_by_name', case
          when v_decision.on_behalf then null
          else (select p.full_name from public.profiles p where p.id = v_decision.decided_by)
        end,
        'decided_on_behalf', v_decision.on_behalf
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

revoke execute on function public.content_freeze_revision(public.content_items, text)
  from public, anon, authenticated;
revoke execute on function public.approve_on_behalf(uuid, text, text, int) from public, anon;
grant execute on function public.approve_on_behalf(uuid, text, text, int) to authenticated;

commit;

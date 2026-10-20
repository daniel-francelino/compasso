begin;

alter table public.content_items
  add column plan_required boolean not null default false,
  add column plan_summary text check (plan_summary is null or char_length(plan_summary) <= 4000),
  add column plan_media jsonb not null default '[]' check (
    jsonb_typeof(plan_media) = 'array' and jsonb_array_length(plan_media) <= 10
  ),
  add column plan_approved_revision_id uuid;

alter table public.content_items alter column plan_required drop default;

alter table public.content_items
  add foreign key (plan_approved_revision_id, id) references public.content_revisions (id, item_id);

alter table public.content_items drop constraint content_items_editorial_status_check;
alter table public.content_items add constraint content_items_editorial_status_check check (
  editorial_status in (
    'draft', 'planning', 'awaiting_plan_approval', 'plan_changes_requested', 'plan_approved',
    'in_production', 'internal_review', 'awaiting_approval', 'changes_requested', 'approved',
    'cancelled'
  )
);

alter table public.content_revisions
  add column stage text not null default 'art' check (stage in ('plan', 'art'));

alter table public.approval_requests
  add column stage text not null default 'art' check (stage in ('plan', 'art'));
alter table public.approval_requests alter column approver_user_id drop not null;

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
    when 'approved' then p_to in ('in_production', 'planning', 'cancelled')
    else false
  end
$fn$;

create or replace function public.approval_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'record_immutable';
  end if;
  if new.brand_id <> old.brand_id or new.item_id <> old.item_id
    or new.revision_id <> old.revision_id or new.stage <> old.stage
    or new.approver_user_id is distinct from old.approver_user_id
    or new.requested_at <> old.requested_at or new.requested_by is distinct from old.requested_by
    or new.due_date is distinct from old.due_date or new.message is distinct from old.message then
    raise exception 'record_immutable';
  end if;
  if old.status <> 'pending' and (new.status <> old.status or new.decided_at is distinct from old.decided_at) then
    raise exception 'request_not_pending';
  end if;
  return new;
end;
$fn$;

create function public.brand_approver_ids(p_brand uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(array_agg(m.user_id order by m.user_id), '{}'::uuid[])
  from public.brand_members m
  where m.brand_id = p_brand and public.approver_is_valid(p_brand, m.user_id)
$fn$;

create function public.plan_approval_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select (s.value ->> 'requirePlanApproval')::boolean
     from public.organization_settings s where s.key = 'policies.approvals'),
    true
  )
$fn$;

create function public.content_plan_signature(p_item uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('channel_id', r.channel_id, 'format', r.format, 'planned_at', r.planned_at)
      order by r.position, r.created_at
    ),
    '[]'::jsonb
  )
  from public.content_channels r
  where r.content_item_id = p_item and r.publication_status <> 'cancelled'
$fn$;

revoke execute on function public.brand_approver_ids(uuid), public.plan_approval_required(),
  public.content_plan_signature(uuid) from public, anon, authenticated;

commit;

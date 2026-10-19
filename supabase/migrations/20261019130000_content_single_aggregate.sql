begin;

do $$
begin
  if exists (select 1 from public.content_revisions)
    or exists (select 1 from public.approval_requests)
    or exists (select 1 from public.approval_decisions)
    or exists (select 1 from public.comments)
    or exists (
      select 1 from public.content_variants v group by v.content_item_id having count(*) > 1
    ) then
    raise exception 'content_single_aggregate: unsupported data, see docs/modules/content.md';
  end if;
end
$$;

alter table public.content_items
  add column objective_kind text check (
    objective_kind is null or objective_kind in (
      'awareness', 'engagement', 'traffic', 'leads', 'sales', 'community', 'other'
    )
  ),
  add column caption jsonb check (caption is null or jsonb_typeof(caption) = 'object'),
  add column call_to_action text check (call_to_action is null or char_length(call_to_action) <= 300),
  add column working_media jsonb not null default '[]' check (
    jsonb_typeof(working_media) = 'array' and jsonb_array_length(working_media) <= 20
  ),
  add column editorial_status text not null default 'draft' check (editorial_status in (
    'draft', 'in_production', 'internal_review', 'awaiting_approval', 'changes_requested',
    'approved', 'cancelled'
  )),
  add column approval_due_date date,
  add column current_revision_id uuid,
  add column approved_revision_id uuid;

update public.content_items i
set caption = v.caption, call_to_action = v.call_to_action, working_media = v.working_media,
    editorial_status = v.editorial_status, approval_due_date = v.approval_due_date
from public.content_variants v
where v.content_item_id = i.id;

update public.content_items set editorial_status = 'cancelled' where cancelled_at is not null;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conrelid::regclass as table_name, c.conname
    from pg_catalog.pg_constraint c
    where c.confrelid = 'public.content_variants'::regclass and c.contype = 'f'
  loop
    execute format('alter table %s drop constraint %I', v_constraint.table_name, v_constraint.conname);
  end loop;
end
$$;

alter table public.content_revisions rename column variant_id to item_id;
alter table public.approval_requests rename column variant_id to item_id;
alter table public.comments rename column variant_id to item_id;

alter index public.approval_one_pending_per_variant rename to approval_one_pending_per_item;
alter index public.approval_requests_variant_idx rename to approval_requests_item_idx;
alter index public.comments_variant_idx rename to comments_item_idx;

alter table public.content_revisions
  add foreign key (item_id, brand_id) references public.content_items (id, brand_id);
alter table public.approval_requests
  add foreign key (item_id, brand_id) references public.content_items (id, brand_id);
alter table public.comments
  add foreign key (item_id, brand_id) references public.content_items (id, brand_id);
alter table public.content_items
  add foreign key (current_revision_id, id) references public.content_revisions (id, item_id),
  add foreign key (approved_revision_id, id) references public.content_revisions (id, item_id);

create index content_items_status_idx on public.content_items (brand_id, editorial_status)
  where cancelled_at is null;

drop trigger content_variants_guard on public.content_variants;
drop trigger content_variants_set_updated_at on public.content_variants;
drop function public.content_variants_guard();

alter table public.content_variants rename to content_channels;
alter table public.content_channels
  drop column editorial_status,
  drop column approval_due_date,
  drop column call_to_action,
  drop column working_media,
  drop column current_revision_id,
  drop column approved_revision_id;
alter table public.content_channels add column position int not null default 0;
update public.content_channels set caption = null;

alter index public.content_variants_planned_idx rename to content_channels_planned_idx;
alter index public.content_variants_channel_idx rename to content_channels_channel_idx;
alter index public.content_variants_item_idx rename to content_channels_item_idx;
alter policy content_variants_read on public.content_channels rename to content_channels_read;

create trigger content_channels_set_updated_at before update on public.content_channels
for each row execute function public.set_updated_at();

create function public.content_channels_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brand_id <> old.brand_id or new.content_item_id <> old.content_item_id then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

create trigger content_channels_guard before update on public.content_channels
for each row execute function public.content_channels_guard();

create or replace function public.content_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brand_id <> old.brand_id then
    raise exception 'invalid_input';
  end if;
  if new.editorial_status <> old.editorial_status
    and not public.editorial_transition_allowed(old.editorial_status, new.editorial_status) then
    raise exception 'transition_not_allowed';
  end if;
  return new;
end;
$$;

create or replace function public.approval_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'record_immutable';
  end if;
  if new.brand_id <> old.brand_id or new.item_id <> old.item_id
    or new.revision_id <> old.revision_id or new.approver_user_id <> old.approver_user_id
    or new.requested_at <> old.requested_at or new.requested_by is distinct from old.requested_by
    or new.due_date is distinct from old.due_date or new.message is distinct from old.message then
    raise exception 'record_immutable';
  end if;
  if old.status <> 'pending' and (new.status <> old.status or new.decided_at is distinct from old.decided_at) then
    raise exception 'request_not_pending';
  end if;
  return new;
end;
$$;

create or replace function public.comments_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'record_immutable';
  end if;
  if old.deleted_at is not null
    or new.deleted_at is null
    or new.id <> old.id or new.brand_id <> old.brand_id or new.item_id <> old.item_id
    or new.revision_id is distinct from old.revision_id or new.author_id <> old.author_id
    or new.visibility <> old.visibility or new.body <> old.body
    or new.created_at <> old.created_at then
    raise exception 'record_immutable';
  end if;
  return new;
end;
$$;

create or replace function public.channel_is_used(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.content_channels c where c.channel_id = p_channel)
$$;

revoke execute on function public.content_channels_guard() from public, anon, authenticated;

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
select 'content.publish_due', k.title, k.required_action, k.severity, k.default_lead_days,
  k.schedulable, k.portal, k.default_email, k.available
from public.notification_kinds k
where k.kind = 'variant.publish_due';

update public.notifications
set kind = 'content.publish_due', ref_type = 'content_channel'
where kind = 'variant.publish_due';

update public.notification_preferences set kind = 'content.publish_due' where kind = 'variant.publish_due';

delete from public.notification_kinds where kind = 'variant.publish_due';

update public.notifications n
set link = '/admin/marketing/content/' || c.content_item_id
from public.content_channels c
where n.ref_type = 'content_channel' and n.ref_id = c.id;

update public.notifications set ref_type = 'content_channel' where ref_type = 'content_variant';

commit;

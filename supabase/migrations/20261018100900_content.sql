begin;

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  title text not null check (char_length(title) between 2 and 140),
  objective text check (objective is null or char_length(objective) <= 2000),
  briefing jsonb check (briefing is null or jsonb_typeof(briefing) = 'object'),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  assignee_id uuid references public.profiles (id),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  production_due_date date,
  version int not null default 1,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);

create index content_items_brand_idx on public.content_items (brand_id, cancelled_at, production_due_date);
create index content_items_assignee_idx on public.content_items (assignee_id) where cancelled_at is null;

create table public.content_variants (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  content_item_id uuid not null,
  channel_id uuid not null,
  format text not null check (format in (
    'image', 'carousel', 'video', 'text', 'story', 'reel', 'article', 'other'
  )),
  editorial_status text not null default 'draft' check (editorial_status in (
    'draft', 'in_production', 'internal_review', 'awaiting_approval', 'changes_requested',
    'approved', 'cancelled'
  )),
  publication_status text not null default 'unplanned' check (publication_status in (
    'unplanned', 'planned', 'published_manually', 'cancelled'
  )),
  planned_at timestamptz,
  planned_timezone text,
  approval_due_date date,
  caption jsonb check (caption is null or jsonb_typeof(caption) = 'object'),
  call_to_action text check (call_to_action is null or char_length(call_to_action) <= 300),
  working_media jsonb not null default '[]' check (
    jsonb_typeof(working_media) = 'array' and jsonb_array_length(working_media) <= 20
  ),
  current_revision_id uuid,
  approved_revision_id uuid,
  published_at timestamptz,
  published_url text check (published_url is null or published_url ~ '^https://'),
  published_note text check (published_note is null or char_length(published_note) <= 1000),
  published_evidence_media_version_id uuid references public.media_versions (id),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_item_id, brand_id) references public.content_items (id, brand_id),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id),
  unique (id, brand_id),
  check (planned_at is null or planned_timezone is not null),
  check (publication_status <> 'planned' or planned_at is not null),
  check (publication_status <> 'published_manually' or approved_revision_id is not null)
);

create index content_variants_planned_idx on public.content_variants (brand_id, planned_at);
create index content_variants_status_idx on public.content_variants (brand_id, editorial_status);
create index content_variants_channel_idx on public.content_variants (channel_id);
create index content_variants_item_idx on public.content_variants (content_item_id);

create table public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null,
  brand_id uuid not null,
  revision_no int not null check (revision_no >= 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (variant_id, brand_id) references public.content_variants (id, brand_id),
  unique (variant_id, revision_no),
  unique (id, variant_id)
);

alter table public.content_variants
  add foreign key (current_revision_id, id) references public.content_revisions (id, variant_id),
  add foreign key (approved_revision_id, id) references public.content_revisions (id, variant_id);

create table public.content_revision_media (
  revision_id uuid not null references public.content_revisions (id),
  media_version_id uuid not null references public.media_versions (id) on delete restrict,
  position int not null check (position >= 0),
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  primary key (revision_id, position)
);

create index content_revision_media_version_idx on public.content_revision_media (media_version_id);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  variant_id uuid not null,
  revision_id uuid not null,
  approver_user_id uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in (
    'pending', 'approved', 'changes_requested', 'superseded', 'cancelled'
  )),
  requested_by uuid references public.profiles (id),
  requested_at timestamptz not null default now(),
  due_date date,
  message text check (message is null or char_length(message) <= 1000),
  viewed_at timestamptz,
  decided_at timestamptz,
  cancelled_reason text check (cancelled_reason is null or char_length(cancelled_reason) <= 500),
  foreign key (revision_id, variant_id) references public.content_revisions (id, variant_id),
  foreign key (variant_id, brand_id) references public.content_variants (id, brand_id)
);

create unique index approval_one_pending_per_variant on public.approval_requests (variant_id)
  where status = 'pending';
create index approval_requests_brand_idx on public.approval_requests (brand_id, status, due_date);
create index approval_requests_approver_idx on public.approval_requests (approver_user_id, status);
create index approval_requests_variant_idx on public.approval_requests (variant_id, requested_at desc);

create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests (id),
  revision_id uuid not null references public.content_revisions (id),
  decided_by uuid not null references public.profiles (id),
  outcome text not null check (outcome in ('approved', 'changes_requested')),
  comment text check (comment is null or char_length(comment) <= 4000),
  decided_at timestamptz not null default now(),
  check (outcome <> 'changes_requested' or char_length(btrim(coalesce(comment, ''))) >= 5)
);

create unique index approval_decision_once on public.approval_decisions (request_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  variant_id uuid not null,
  revision_id uuid,
  author_id uuid not null references public.profiles (id),
  visibility text not null check (visibility in ('internal', 'external')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (variant_id, brand_id) references public.content_variants (id, brand_id),
  foreign key (revision_id, variant_id) references public.content_revisions (id, variant_id)
);

create index comments_variant_idx on public.comments (variant_id, created_at);

alter table public.content_items enable row level security;
alter table public.content_variants enable row level security;
alter table public.content_revisions enable row level security;
alter table public.content_revision_media enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.comments enable row level security;

create trigger content_items_set_updated_at before update on public.content_items
for each row execute function public.set_updated_at();
create trigger content_variants_set_updated_at before update on public.content_variants
for each row execute function public.set_updated_at();

create function public.editorial_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'draft' then p_to in ('in_production', 'cancelled')
    when 'in_production' then p_to in ('internal_review', 'awaiting_approval', 'cancelled')
    when 'internal_review' then p_to in ('awaiting_approval', 'in_production', 'cancelled')
    when 'awaiting_approval' then p_to in ('approved', 'changes_requested', 'in_production', 'cancelled')
    when 'changes_requested' then p_to in ('in_production', 'cancelled')
    when 'approved' then p_to in ('in_production', 'cancelled')
    else false
  end
$$;

create function public.content_variants_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brand_id <> old.brand_id or new.content_item_id <> old.content_item_id then
    raise exception 'invalid_input';
  end if;
  if new.editorial_status <> old.editorial_status
    and not public.editorial_transition_allowed(old.editorial_status, new.editorial_status) then
    raise exception 'transition_not_allowed';
  end if;
  return new;
end;
$$;

create trigger content_variants_guard before update on public.content_variants
for each row execute function public.content_variants_guard();

create function public.content_items_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brand_id <> old.brand_id then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

create trigger content_items_guard before update on public.content_items
for each row execute function public.content_items_guard();

create function public.immutable_record_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'record_immutable';
end;
$$;

create trigger content_revisions_immutable before update or delete on public.content_revisions
for each row execute function public.immutable_record_guard();
create trigger content_revision_media_immutable before update or delete on public.content_revision_media
for each row execute function public.immutable_record_guard();
create trigger approval_decisions_immutable before update or delete on public.approval_decisions
for each row execute function public.immutable_record_guard();

create function public.approval_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'record_immutable';
  end if;
  if new.brand_id <> old.brand_id or new.variant_id <> old.variant_id
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

create trigger approval_requests_guard before update or delete on public.approval_requests
for each row execute function public.approval_requests_guard();

create function public.comments_guard()
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
    or new.id <> old.id or new.brand_id <> old.brand_id or new.variant_id <> old.variant_id
    or new.revision_id is distinct from old.revision_id or new.author_id <> old.author_id
    or new.visibility <> old.visibility or new.body <> old.body
    or new.created_at <> old.created_at then
    raise exception 'record_immutable';
  end if;
  return new;
end;
$$;

create trigger comments_guard before update or delete on public.comments
for each row execute function public.comments_guard();

create policy content_items_read on public.content_items for select
  using (public.has_action('content.view') and public.can_access_brand(brand_id));

create policy content_variants_read on public.content_variants for select
  using (public.has_action('content.view') and public.can_access_brand(brand_id));

create policy content_revisions_read on public.content_revisions for select
  using (
    (public.has_action('content.view') or public.has_action('approvals.view'))
    and public.can_access_brand(brand_id)
  );

create policy content_revision_media_read on public.content_revision_media for select
  using (
    exists (
      select 1 from public.content_revisions r
      where r.id = content_revision_media.revision_id
        and (public.has_action('content.view') or public.has_action('approvals.view'))
        and public.can_access_brand(r.brand_id)
    )
  );

create policy approval_requests_read on public.approval_requests for select
  using (public.has_action('approvals.view') and public.can_access_brand(brand_id));

create policy approval_decisions_read on public.approval_decisions for select
  using (
    exists (
      select 1 from public.approval_requests q
      where q.id = approval_decisions.request_id
        and public.has_action('approvals.view')
        and public.can_access_brand(q.brand_id)
    )
  );

create policy comments_read on public.comments for select
  using (
    deleted_at is null
    and public.can_access_brand(brand_id)
    and (
      (visibility = 'internal' and public.has_action('content.view'))
      or (visibility = 'external' and (public.has_action('approvals.view') or public.has_action('content.view')))
    )
  );

revoke all on public.content_items, public.content_variants, public.content_revisions,
  public.content_revision_media, public.approval_requests, public.approval_decisions,
  public.comments from anon, authenticated;
grant select on public.content_items, public.content_variants, public.content_revisions,
  public.content_revision_media, public.approval_requests, public.approval_decisions,
  public.comments to authenticated;

revoke execute on function public.editorial_transition_allowed(text, text),
  public.content_variants_guard(), public.content_items_guard(), public.immutable_record_guard(),
  public.approval_requests_guard(), public.comments_guard() from public, anon, authenticated;

create or replace function public.channel_is_used(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.content_variants v where v.channel_id = p_channel)
$$;

create or replace function public.brand_has_history(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.content_items i where i.brand_id = p_brand)
    or exists (select 1 from public.media_assets a where a.brand_id = p_brand)
$$;

update public.notification_kinds
set available = true
where kind in ('approval.requested', 'approval.decided', 'approval.superseded', 'comment.created');

commit;

begin;

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  scope text not null check (scope in ('site', 'brand')),
  brand_id uuid references public.brands (id),
  display_name text not null check (char_length(display_name) between 1 and 200),
  tags text[] not null default '{}',
  current_version_id uuid,
  size_bytes bigint not null default 0,
  version int not null default 1,
  trashed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'brand') = (brand_id is not null))
);

create index media_assets_scope_idx on public.media_assets (organization_id, scope, brand_id)
  where trashed_at is null;
create index media_assets_trashed_idx on public.media_assets (trashed_at) where trashed_at is not null;
create index media_assets_name_idx on public.media_assets (lower(display_name));

create table public.media_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets (id),
  version_no int not null,
  storage_key text not null unique,
  thumb_key text,
  display_key text,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  derivative_bytes bigint not null default 0,
  width int,
  height int,
  duration_ms int,
  checksum text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'available', 'failed')),
  failure_reason text,
  public_published_at timestamptz,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (asset_id, version_no)
);

create index media_versions_asset_idx on public.media_versions (asset_id);
create index media_versions_status_idx on public.media_versions (status);

alter table public.media_assets
  add constraint media_assets_current_version_fkey
  foreign key (current_version_id) references public.media_versions (id);

alter table public.organizations
  add constraint organizations_logo_media_version_fkey
  foreign key (logo_media_version_id) references public.media_versions (id);

create table public.media_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.media_versions (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  purpose text not null,
  reserved_bytes bigint not null,
  status text not null default 'open' check (status in ('open', 'confirmed', 'expired', 'failed')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (author_id, idempotency_key)
);

create index media_upload_sessions_open_idx on public.media_upload_sessions (expires_at)
  where status = 'open';

create table public.media_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  scope text not null check (scope in ('site', 'brand')),
  brand_id uuid references public.brands (id),
  parent_id uuid references public.media_collections (id),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  check ((scope = 'brand') = (brand_id is not null))
);

create unique index media_collections_unique_name on public.media_collections (
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  scope,
  coalesce(brand_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
);

create table public.media_collection_items (
  collection_id uuid not null references public.media_collections (id) on delete cascade,
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  primary key (collection_id, asset_id)
);

create index media_collection_items_asset_idx on public.media_collection_items (asset_id);

create table public.media_usages (
  id uuid primary key default gen_random_uuid(),
  media_version_id uuid not null references public.media_versions (id) on delete restrict,
  usage_type text not null check (usage_type in (
    'content_revision', 'site_page_revision', 'case_study', 'brand_identity', 'publication_evidence'
  )),
  usage_ref_id uuid not null,
  alt_text text,
  created_at timestamptz not null default now(),
  unique (media_version_id, usage_type, usage_ref_id)
);

create index media_usages_ref_idx on public.media_usages (usage_type, usage_ref_id);

alter table public.media_assets enable row level security;
alter table public.media_versions enable row level security;
alter table public.media_upload_sessions enable row level security;
alter table public.media_collections enable row level security;
alter table public.media_collection_items enable row level security;
alter table public.media_usages enable row level security;

create trigger media_assets_set_updated_at before update on public.media_assets
for each row execute function public.set_updated_at();

create function public.media_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.asset_id is distinct from old.asset_id
     or new.version_no is distinct from old.version_no
     or new.storage_key is distinct from old.storage_key
     or new.original_filename is distinct from old.original_filename
     or new.mime_type is distinct from old.mime_type
     or new.size_bytes is distinct from old.size_bytes then
    raise exception 'media_version_immutable';
  end if;
  if old.status = 'available' and (
    new.checksum is distinct from old.checksum
    or new.width is distinct from old.width
    or new.height is distinct from old.height
    or new.status is distinct from old.status and new.status <> 'available'
  ) then
    raise exception 'media_version_immutable';
  end if;
  return new;
end;
$$;

create trigger media_versions_immutable before update on public.media_versions
for each row execute function public.media_versions_immutable();

create function public.media_collections_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_depth int := 1;
  v_cursor uuid := new.parent_id;
  v_parent public.media_collections;
begin
  while v_cursor is not null loop
    select * into v_parent from public.media_collections c where c.id = v_cursor;
    if not found or v_cursor = new.id then
      raise exception 'invalid_input';
    end if;
    if v_parent.scope <> new.scope or v_parent.brand_id is distinct from new.brand_id then
      raise exception 'invalid_input';
    end if;
    v_depth := v_depth + 1;
    v_cursor := v_parent.parent_id;
  end loop;
  if v_depth > 3 then
    raise exception 'invalid_input';
  end if;
  return new;
end;
$$;

create trigger media_collections_guard before insert or update on public.media_collections
for each row execute function public.media_collections_guard();

create policy media_assets_read on public.media_assets for select
  using (
    public.has_action('media.view')
    and (
      (scope = 'brand' and public.can_access_brand(brand_id))
      or (scope = 'site' and public.has_action('site.view'))
    )
  );

create policy media_versions_read on public.media_versions for select
  using (exists (select 1 from public.media_assets a where a.id = media_versions.asset_id));

create policy media_usages_read on public.media_usages for select
  using (exists (
    select 1
    from public.media_versions v
    join public.media_assets a on a.id = v.asset_id
    where v.id = media_usages.media_version_id
  ));

create policy media_collections_read on public.media_collections for select
  using (
    public.has_action('media.view')
    and (
      (scope = 'brand' and public.can_access_brand(brand_id))
      or (scope = 'site' and public.has_action('site.view'))
    )
  );

create policy media_collection_items_read on public.media_collection_items for select
  using (exists (
    select 1 from public.media_collections c where c.id = media_collection_items.collection_id
  ));

create policy media_upload_sessions_read on public.media_upload_sessions for select
  using (author_id = auth.uid());

revoke all on public.media_assets, public.media_versions, public.media_upload_sessions,
  public.media_collections, public.media_collection_items, public.media_usages
  from anon, authenticated;
grant select on public.media_assets, public.media_versions, public.media_upload_sessions,
  public.media_collections, public.media_collection_items, public.media_usages to authenticated;

update public.notification_kinds set available = true where kind = 'media.upload_failed';

commit;

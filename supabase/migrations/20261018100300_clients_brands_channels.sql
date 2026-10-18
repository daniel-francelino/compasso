begin;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (char_length(name) between 2 and 120),
  owner_user_id uuid references public.profiles (id),
  internal_notes text,
  tags text[] not null default '{}',
  version int not null default 1,
  archived_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create index clients_org_archived_idx on public.clients (organization_id, archived_at);
create index clients_name_idx on public.clients (lower(name));

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email extensions.citext,
  phone text,
  role_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index client_one_primary_contact on public.client_contacts (client_id)
  where is_primary;
create index client_contacts_client_idx on public.client_contacts (client_id);
create index client_contacts_email_idx on public.client_contacts (email);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  name text not null check (char_length(name) between 2 and 120),
  description text,
  target_audience text,
  tone_of_voice text,
  objectives text,
  references_notes text,
  visual_identity jsonb not null default '{}' check (jsonb_typeof(visual_identity) = 'object'),
  timezone text not null,
  version int not null default 1,
  archived_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, organization_id) references public.clients (id, organization_id),
  unique (id, organization_id)
);

create unique index brands_unique_name_per_client on public.brands (client_id, lower(name));
create index brands_org_client_idx on public.brands (organization_id, client_id);

create table public.brand_members (
  brand_id uuid not null references public.brands (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('internal', 'external')),
  can_decide boolean not null default false,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (brand_id, user_id),
  check (kind = 'external' or not can_decide)
);

create index brand_members_user_idx on public.brand_members (user_id, brand_id)
  where status = 'active';

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  platform text not null check (platform in (
    'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'pinterest', 'threads',
    'email', 'blog', 'other'
  )),
  profile_name text not null check (char_length(profile_name) between 1 and 120),
  profile_url text check (profile_url is null or profile_url ~ '^https://'),
  external_id text,
  notes text,
  version int not null default 1,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);

create unique index channels_unique_active on public.channels (brand_id, platform, lower(profile_name))
  where archived_at is null;
create index channels_brand_active_idx on public.channels (brand_id) where archived_at is null;

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.brands enable row level security;
alter table public.brand_members enable row level security;
alter table public.channels enable row level security;

create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger client_contacts_set_updated_at before update on public.client_contacts
for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands
for each row execute function public.set_updated_at();
create trigger channels_set_updated_at before update on public.channels
for each row execute function public.set_updated_at();

create function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.organizations o limit 1
$$;

create function public.can_access_brand(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.brand_members m
    join public.profiles p on p.id = m.user_id
    where m.brand_id = p_brand
      and m.user_id = auth.uid()
      and m.kind = 'internal'
      and m.status = 'active'
      and p.status = 'approved'
      and p.kind = 'internal'
  )
$$;

create function public.is_external_brand_member(p_brand uuid, p_must_decide boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_members m
    join public.profiles p on p.id = m.user_id
    where m.brand_id = p_brand
      and m.user_id = auth.uid()
      and m.kind = 'external'
      and m.status = 'active'
      and p.status = 'approved'
      and p.kind = 'external'
      and (not p_must_decide or m.can_decide)
  )
$$;

create function public.can_view_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.clients c
    where c.id = p_client and (c.created_by = auth.uid() or c.owner_user_id = auth.uid())
  ) or exists (
    select 1
    from public.brands b
    join public.brand_members m on m.brand_id = b.id
    where b.client_id = p_client and public.can_access_brand(b.id)
  )
$$;

create function public.assert_action(p_action text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_action(p_action) then
    raise exception 'denied';
  end if;
end;
$$;

create function public.assert_brand_access(p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_access_brand(p_brand) or not exists (
    select 1 from public.brands b where b.id = p_brand
  ) then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.channel_is_used(p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create function public.brand_has_history(p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select false
$$;

create function public.brand_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select p.kind into v_kind from public.profiles p where p.id = new.user_id;
  if v_kind is distinct from new.kind then
    raise exception 'member_kind_mismatch';
  end if;
  return new;
end;
$$;

create trigger brand_members_guard
before insert or update on public.brand_members
for each row execute function public.brand_members_guard();

create policy clients_read on public.clients for select
  using (public.has_action('clients.view') and public.can_view_client(id));

create policy client_contacts_read on public.client_contacts for select
  using (public.has_action('clients.view') and public.can_view_client(client_id));

create policy brands_read on public.brands for select
  using (public.has_action('brands.view') and public.can_access_brand(id));

create policy brand_members_read on public.brand_members for select
  using (public.has_action('brands.view') and public.can_access_brand(brand_id));

create policy channels_read on public.channels for select
  using (public.has_action('channels.view') and public.can_access_brand(brand_id));

drop policy audit_events_read on public.audit_events;
create policy audit_events_read on public.audit_events for select
  using (
    public.has_action('audit.view')
    and (brand_id is null or public.can_access_brand(brand_id))
  );

revoke all on public.clients, public.client_contacts, public.brands, public.brand_members,
  public.channels from anon, authenticated;
grant select on public.clients, public.client_contacts, public.brands, public.brand_members,
  public.channels to authenticated;

commit;

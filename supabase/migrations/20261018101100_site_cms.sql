begin;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null,
  settings jsonb not null default '{}' check (jsonb_typeof(settings) = 'object'),
  settings_version int not null default 1,
  published_settings jsonb check (published_settings is null or jsonb_typeof(published_settings) = 'object'),
  published_settings_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index sites_one_per_organization on public.sites (organization_id);

create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id),
  kind text not null check (kind in (
    'home', 'about', 'services', 'portfolio', 'case_study', 'contact', 'blog_post', 'generic'
  )),
  slug text not null check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$' or slug = ''
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  draft_content jsonb not null default '{}' check (jsonb_typeof(draft_content) = 'object'),
  published_revision_id uuid,
  is_system boolean not null default false,
  version int not null default 1,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table public.site_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages (id),
  revision_no int not null check (revision_no >= 1),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  note text check (note is null or char_length(note) <= 500),
  published_by uuid references public.profiles (id),
  published_at timestamptz not null default now(),
  live_from timestamptz,
  cancelled_at timestamptz,
  source_revision_id uuid references public.site_page_revisions (id),
  unique (page_id, revision_no)
);

alter table public.site_pages
  add foreign key (published_revision_id) references public.site_page_revisions (id);

create table public.site_entries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id),
  kind text not null check (kind in ('service', 'testimonial')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  sort_order int not null default 0,
  visible boolean not null default true,
  version int not null default 1,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create index site_entries_kind_idx on public.site_entries (site_id, kind, sort_order);

create table public.site_case_study_authorizations (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.site_pages (id),
  brand_id uuid not null references public.brands (id),
  authorized_by uuid not null references public.profiles (id),
  authorized_at timestamptz not null default now(),
  consent_note text not null check (char_length(consent_note) between 5 and 1000),
  withdrawn_at timestamptz,
  withdrawn_by uuid references public.profiles (id)
);

create unique index case_study_one_active_authorization
  on public.site_case_study_authorizations (page_id) where withdrawn_at is null;

create table public.site_redirects (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id),
  from_path text not null check (from_path ~ '^/[^ ]*$'),
  to_path text not null check (to_path ~ '^/[^ ]*$' or to_path ~ '^https://[^ ]+$'),
  permanent boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (site_id, from_path),
  check (from_path <> to_path)
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id),
  name text not null check (char_length(name) between 1 and 120),
  email text check (email is null or email = lower(email)),
  phone text check (phone is null or char_length(phone) <= 40),
  message text not null check (char_length(message) between 1 and 4000),
  source_slug text,
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'answered', 'discarded')),
  internal_note text check (internal_note is null or char_length(internal_note) <= 1000),
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create index contact_messages_status_idx on public.contact_messages (site_id, status, created_at desc);

alter table public.sites enable row level security;
alter table public.site_pages enable row level security;
alter table public.site_page_revisions enable row level security;
alter table public.site_entries enable row level security;
alter table public.site_case_study_authorizations enable row level security;
alter table public.site_redirects enable row level security;
alter table public.contact_messages enable row level security;

create policy sites_read on public.sites for select using (public.has_action('site.view'));
create policy site_pages_read on public.site_pages for select using (public.has_action('site.view'));
create policy site_page_revisions_read on public.site_page_revisions for select
  using (public.has_action('site.view'));
create policy site_entries_read on public.site_entries for select using (public.has_action('site.view'));
create policy site_case_study_authorizations_read on public.site_case_study_authorizations
  for select using (public.has_action('site.view'));
create policy site_redirects_read on public.site_redirects for select
  using (public.has_action('site.view'));
create policy contact_messages_read on public.contact_messages for select
  using (public.has_action('site.view'));

create trigger site_pages_set_updated_at before update on public.site_pages
for each row execute function public.set_updated_at();
create trigger site_entries_set_updated_at before update on public.site_entries
for each row execute function public.set_updated_at();

create function public.site_page_revisions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'record_immutable';
end;
$$;

create trigger site_page_revisions_immutable before update or delete on public.site_page_revisions
for each row execute function public.site_page_revisions_guard();

create function public.site_pages_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system or old.published_revision_id is not null then
      raise exception 'page_system_protected';
    end if;
    return old;
  end if;
  if new.site_id <> old.site_id or new.is_system <> old.is_system or new.kind <> old.kind then
    raise exception 'invalid_input';
  end if;
  if old.is_system and new.slug <> old.slug then
    raise exception 'page_system_protected';
  end if;
  return new;
end;
$$;

create trigger site_pages_guard before update or delete on public.site_pages
for each row execute function public.site_pages_guard();

revoke all on public.sites, public.site_pages, public.site_page_revisions, public.site_entries,
  public.site_case_study_authorizations, public.site_redirects, public.contact_messages
  from anon, authenticated;
grant select on public.sites, public.site_pages, public.site_page_revisions, public.site_entries,
  public.site_case_study_authorizations, public.site_redirects, public.contact_messages
  to authenticated;
grant select, insert, update, delete on public.sites, public.site_pages, public.site_page_revisions,
  public.site_entries, public.site_case_study_authorizations, public.site_redirects,
  public.contact_messages to service_role;

revoke execute on function public.site_page_revisions_guard(), public.site_pages_guard()
  from public, anon, authenticated;

insert into public.roles (key, name, description, is_system, portal_only) values
  ('site_editor', 'Editor do site', 'Edits the site without publishing it', false, false)
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, seed.action_key
from public.roles r
join (values
  ('site_editor', 'site.view'), ('site_editor', 'site.edit'), ('site_editor', 'media.view'),
  ('site_editor', 'media.upload')
) as seed (role_key, action_key) on seed.role_key = r.key
on conflict do nothing;

update public.notification_kinds set available = true
where kind in ('site.published', 'site.contact_message');

commit;

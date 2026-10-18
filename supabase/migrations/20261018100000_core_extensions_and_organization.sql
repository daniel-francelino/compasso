begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  tax_id text,
  default_timezone text not null default 'America/Sao_Paulo',
  logo_media_version_id uuid,
  contact_email text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_single on public.organizations ((true));

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create table public.organization_settings (
  key text primary key,
  value jsonb not null,
  version int not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.organization_settings enable row level security;

create trigger organization_settings_set_updated_at
before update on public.organization_settings
for each row execute function public.set_updated_at();

insert into public.organizations (name)
select 'Compasso'
where not exists (select 1 from public.organizations);

commit;

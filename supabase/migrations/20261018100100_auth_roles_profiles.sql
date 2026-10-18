begin;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  portal_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.actions (
  key text primary key,
  module text not null,
  description text not null,
  admin_only boolean not null default false,
  portal boolean not null default false,
  requires text[] not null default '{}'
);

create table public.role_actions (
  role_id uuid not null references public.roles (id) on delete cascade,
  action_key text not null references public.actions (key) on delete cascade,
  primary key (role_id, action_key)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email extensions.citext not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  kind text not null default 'internal' check (kind in ('internal', 'external')),
  role_id uuid references public.roles (id),
  locale text not null default 'pt-BR' check (locale in ('pt-BR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or role_id is not null)
);

create index profiles_role_id_idx on public.profiles (role_id);

create table public.profile_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  profile_id uuid not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index profile_audit_profile_idx on public.profile_audit (profile_id, created_at desc);

create table public.role_audit (
  id bigint generated always as identity primary key,
  actor_id uuid,
  role_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index role_audit_role_idx on public.role_audit (role_id, created_at desc);

alter table public.organization_settings
  add constraint organization_settings_updated_by_fkey
  foreign key (updated_by) references public.profiles (id);

alter table public.roles enable row level security;
alter table public.actions enable row level security;
alter table public.role_actions enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_audit enable row level security;
alter table public.role_audit enable row level security;

create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.status = 'approved'
      and r.key = 'owner'
      and r.is_system
  )
$$;

create function public.has_action(p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles p
    join public.role_actions ra on ra.role_id = p.role_id
    where p.id = auth.uid()
      and p.status = 'approved'
      and ra.action_key = p_action
  )
$$;

create function public.my_actions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then array(select a.key from public.actions a order by a.key)
    else array(
      select ra.action_key
      from public.profiles p
      join public.role_actions ra on ra.role_id = p.role_id
      where p.id = auth.uid() and p.status = 'approved'
      order by ra.action_key
    )
  end
$$;

create function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.roles;
  v_was_owner boolean;
  v_is_owner boolean;
  v_other_owner boolean;
begin
  if tg_op = 'DELETE' then
    select exists (
      select 1 from public.roles r where r.id = old.role_id and r.key = 'owner' and r.is_system
    ) into v_was_owner;
    select exists (
      select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where r.key = 'owner' and r.is_system and p.status = 'approved' and p.id <> old.id
    ) into v_other_owner;
    if v_was_owner and old.status = 'approved' and not v_other_owner then
      raise exception 'last_owner';
    end if;
    return old;
  end if;

  if new.role_id is not null then
    select * into v_role from public.roles r where r.id = new.role_id;
    if v_role.portal_only <> (new.kind = 'external') then
      raise exception 'role_not_assignable';
    end if;
  end if;

  if tg_op = 'INSERT' then
    return new;
  end if;

  if v_actor is not null
     and v_actor = new.id
     and (new.status is distinct from old.status
          or new.role_id is distinct from old.role_id
          or new.kind is distinct from old.kind) then
    raise exception 'self_change_forbidden';
  end if;

  if v_actor is not null
     and new.role_id is distinct from old.role_id
     and not public.is_admin()
     and (
       v_role.is_system
       or exists (
         select 1
         from public.role_actions ra
         join public.actions a on a.key = ra.action_key
         where ra.role_id = new.role_id and a.admin_only
       )
     ) then
    raise exception 'role_not_assignable';
  end if;

  select exists (
    select 1 from public.roles r where r.id = old.role_id and r.key = 'owner' and r.is_system
  ) into v_was_owner;
  select exists (
    select 1 from public.roles r where r.id = new.role_id and r.key = 'owner' and r.is_system
  ) into v_is_owner;
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where r.key = 'owner' and r.is_system and p.status = 'approved' and p.id <> old.id
  ) into v_other_owner;

  if v_was_owner
     and old.status = 'approved'
     and not (v_is_owner and new.status = 'approved')
     and not v_other_owner then
    raise exception 'last_owner';
  end if;

  return new;
end;
$$;

create trigger profiles_guard
before insert or update or delete on public.profiles
for each row execute function public.profiles_guard();

create function public.profiles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profile_audit (actor_id, profile_id, action, new_value)
    values (
      auth.uid(),
      new.id,
      'created',
      jsonb_build_object('status', new.status, 'kind', new.kind, 'role_id', new.role_id)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.profile_audit (actor_id, profile_id, action, old_value, new_value)
    values (
      auth.uid(), new.id, 'status_changed',
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status)
    );
  end if;
  if new.role_id is distinct from old.role_id then
    insert into public.profile_audit (actor_id, profile_id, action, old_value, new_value)
    values (
      auth.uid(), new.id, 'role_changed',
      jsonb_build_object('role_id', old.role_id), jsonb_build_object('role_id', new.role_id)
    );
  end if;
  if new.kind is distinct from old.kind then
    insert into public.profile_audit (actor_id, profile_id, action, old_value, new_value)
    values (
      auth.uid(), new.id, 'kind_changed',
      jsonb_build_object('kind', old.kind), jsonb_build_object('kind', new.kind)
    );
  end if;
  return new;
end;
$$;

create trigger profiles_audit
after insert or update on public.profiles
for each row execute function public.profiles_audit();

create function public.roles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'role_system_protected';
    end if;
    if exists (select 1 from public.profiles p where p.role_id = old.id) then
      raise exception 'role_in_use';
    end if;
    return old;
  end if;

  if old.is_system then
    raise exception 'role_system_protected';
  end if;
  if new.is_system <> old.is_system then
    raise exception 'role_system_protected';
  end if;
  if new.portal_only is distinct from old.portal_only then
    if exists (select 1 from public.profiles p where p.role_id = old.id) then
      raise exception 'role_in_use';
    end if;
    if new.portal_only and exists (
      select 1
      from public.role_actions ra
      join public.actions a on a.key = ra.action_key
      where ra.role_id = old.id and not a.portal
    ) then
      raise exception 'portal_role_internal_action';
    end if;
  end if;
  return new;
end;
$$;

create trigger roles_guard
before update or delete on public.roles
for each row execute function public.roles_guard();

create function public.roles_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.role_audit (actor_id, role_id, action, new_value)
    values (auth.uid(), new.id, 'created', to_jsonb(new));
    return new;
  end if;
  if tg_op = 'DELETE' then
    insert into public.role_audit (actor_id, role_id, action, old_value)
    values (auth.uid(), null, 'deleted', to_jsonb(old));
    return old;
  end if;
  insert into public.role_audit (actor_id, role_id, action, old_value, new_value)
  values (auth.uid(), new.id, 'updated', to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger roles_audit
after insert or update or delete on public.roles
for each row execute function public.roles_audit();

create function public.role_actions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.roles;
  v_action public.actions;
begin
  select * into v_role from public.roles r where r.id = new.role_id;
  select * into v_action from public.actions a where a.key = new.action_key;

  if v_role.is_system then
    raise exception 'role_system_protected';
  end if;
  if v_action.admin_only then
    raise exception 'admin_only_action';
  end if;
  if v_role.portal_only and not v_action.portal then
    raise exception 'portal_role_internal_action';
  end if;
  return new;
end;
$$;

create trigger role_actions_guard
before insert or update on public.role_actions
for each row execute function public.role_actions_guard();

create function public.role_actions_requires_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid := coalesce(new.role_id, old.role_id);
begin
  if exists (
    select 1
    from public.role_actions ra
    join public.actions a on a.key = ra.action_key
    cross join lateral unnest(a.requires) as needed(key)
    where ra.role_id = v_role
      and not exists (
        select 1
        from public.role_actions other
        where other.role_id = v_role and other.action_key = needed.key
      )
  ) then
    raise exception 'action_requires_read';
  end if;
  return null;
end;
$$;

create constraint trigger role_actions_requires_check
after insert or update or delete on public.role_actions
deferrable initially deferred
for each row execute function public.role_actions_requires_check();

create function public.role_actions_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.role_audit (actor_id, role_id, action, old_value)
    values (auth.uid(), old.role_id, 'actions_changed', jsonb_build_object('removed', old.action_key));
    return old;
  end if;
  insert into public.role_audit (actor_id, role_id, action, new_value)
  values (auth.uid(), new.role_id, 'actions_changed', jsonb_build_object('added', new.action_key));
  return new;
end;
$$;

create trigger role_actions_audit
after insert or delete on public.role_actions
for each row execute function public.role_actions_audit();

create policy organizations_read on public.organizations for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.kind = 'internal'
  ));

create policy organization_settings_read on public.organization_settings for select
  using (public.has_action('settings.manage'));

create policy actions_read on public.actions for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.kind = 'internal'
  ));

create policy roles_read on public.roles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'approved' and p.kind = 'internal'
    )
    or id = (select p.role_id from public.profiles p where p.id = auth.uid())
  );

create policy role_actions_read on public.role_actions for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved' and p.kind = 'internal'
  ));

create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.has_action('users.view'));

create policy profiles_update_own on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profile_audit_read on public.profile_audit for select
  using (public.has_action('users.view'));

create policy role_audit_read on public.role_audit for select
  using (public.has_action('roles.manage'));

revoke all on public.organizations, public.organization_settings, public.roles, public.actions,
  public.role_actions, public.profiles, public.profile_audit, public.role_audit
  from anon, authenticated;

grant select on public.organizations, public.organization_settings, public.roles, public.actions,
  public.role_actions, public.profiles, public.profile_audit, public.role_audit
  to authenticated;

grant update (full_name, locale) on public.profiles to authenticated;

revoke execute on function public.is_admin(), public.has_action(text), public.my_actions()
  from public, anon;

grant execute on function public.is_admin(), public.has_action(text), public.my_actions()
  to authenticated;

insert into public.actions (key, module, description, admin_only, portal, requires) values
  ('clients.view', 'clients', 'View clients', false, false, '{}'),
  ('clients.create', 'clients', 'Create clients', false, false, '{clients.view}'),
  ('clients.update', 'clients', 'Edit clients', false, false, '{clients.view}'),
  ('clients.delete', 'clients', 'Delete clients', false, false, '{clients.view}'),
  ('brands.view', 'brands', 'View brands', false, false, '{}'),
  ('brands.create', 'brands', 'Create brands', false, false, '{brands.view}'),
  ('brands.update', 'brands', 'Edit brands', false, false, '{brands.view}'),
  ('brands.delete', 'brands', 'Delete brands', false, false, '{brands.view}'),
  ('brands.manage_members', 'brands', 'Manage brand members', false, false, '{brands.update}'),
  ('channels.view', 'channels', 'View channels', false, false, '{}'),
  ('channels.create', 'channels', 'Create channels', false, false, '{channels.view}'),
  ('channels.update', 'channels', 'Edit channels', false, false, '{channels.view}'),
  ('channels.delete', 'channels', 'Delete channels', false, false, '{channels.view}'),
  ('content.view', 'content', 'View content', false, false, '{}'),
  ('content.create', 'content', 'Create content', false, false, '{content.view,channels.view}'),
  ('content.update', 'content', 'Edit content', false, false, '{content.view,channels.view}'),
  ('content.delete', 'content', 'Delete content', false, false, '{content.view}'),
  ('content.submit', 'content', 'Send content for approval', false, false, '{content.update}'),
  ('content.cancel', 'content', 'Cancel content', false, false, '{content.view}'),
  ('content.reopen', 'content', 'Reopen content', false, false, '{content.update}'),
  ('content.publish_manual', 'content', 'Mark content as published manually', false, false, '{content.view}'),
  ('approvals.view', 'approvals', 'View approvals', false, false, '{}'),
  ('approvals.decide', 'approvals', 'Decide approvals in the portal', false, true, '{portal.view}'),
  ('comments.create_internal', 'comments', 'Write internal comments', false, false, '{}'),
  ('comments.create_external', 'comments', 'Write comments in the portal', false, true, '{portal.view}'),
  ('portal.view', 'portal', 'Use the client portal', false, true, '{}'),
  ('calendar.view', 'calendar', 'View the calendar', false, false, '{}'),
  ('calendar.manage', 'calendar', 'Reschedule from the calendar', false, false, '{calendar.view}'),
  ('media.view', 'media', 'View the media library', false, false, '{}'),
  ('media.upload', 'media', 'Upload media', false, false, '{media.view}'),
  ('media.update', 'media', 'Edit media', false, false, '{media.view}'),
  ('media.delete', 'media', 'Delete media', false, false, '{media.view}'),
  ('media.publish', 'media', 'Publish media to the public site', false, false, '{media.update}'),
  ('site.view', 'site', 'View the site and CMS', false, false, '{}'),
  ('site.edit', 'site', 'Edit site pages', false, false, '{site.view}'),
  ('site.settings', 'site', 'Edit site settings', false, false, '{site.view}'),
  ('site.structure', 'site', 'Change the site structure', false, false, '{site.edit}'),
  ('site.publish', 'site', 'Publish the site', false, false, '{site.view}'),
  ('notifications.configure', 'notifications', 'Configure notification defaults', false, false, '{}'),
  ('audit.view', 'audit', 'View and export the audit trail', false, false, '{}'),
  ('invitations.create', 'invitations', 'Invite people', false, false, '{users.view}'),
  ('users.view', 'users', 'View users', false, false, '{}'),
  ('users.approve', 'users', 'Approve access', false, false, '{users.view}'),
  ('users.manage', 'users', 'Manage users', true, false, '{users.view}'),
  ('roles.manage', 'roles', 'Manage roles', true, false, '{}'),
  ('settings.manage', 'settings', 'Manage organization settings', true, false, '{}')
on conflict (key) do nothing;

insert into public.roles (key, name, description, is_system, portal_only) values
  ('owner', 'Proprietário', 'Full access to everything', true, false),
  ('manager', 'Gestor', 'Runs clients, brands, content and the calendar', false, false),
  ('collaborator', 'Colaborador', 'Creates and edits content', false, false),
  ('external_approver', 'Aprovador externo', 'Approves content in the portal', false, true),
  ('external_commenter', 'Comentarista externo', 'Comments in the portal', false, true)
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, seed.action_key
from public.roles r
join (values
  ('manager', 'clients.view'), ('manager', 'clients.create'), ('manager', 'clients.update'),
  ('manager', 'clients.delete'), ('manager', 'brands.view'), ('manager', 'brands.create'), ('manager', 'brands.update'),
  ('manager', 'brands.manage_members'), ('manager', 'channels.view'),
  ('manager', 'channels.create'), ('manager', 'channels.update'), ('manager', 'channels.delete'),
  ('manager', 'content.view'), ('manager', 'content.create'), ('manager', 'content.update'),
  ('manager', 'content.submit'), ('manager', 'content.cancel'), ('manager', 'content.reopen'),
  ('manager', 'content.publish_manual'), ('manager', 'approvals.view'),
  ('manager', 'comments.create_internal'), ('manager', 'calendar.view'),
  ('manager', 'calendar.manage'), ('manager', 'media.view'), ('manager', 'media.upload'),
  ('manager', 'media.update'), ('manager', 'invitations.create'), ('manager', 'users.view'),
  ('collaborator', 'clients.view'), ('collaborator', 'brands.view'),
  ('collaborator', 'channels.view'), ('collaborator', 'content.view'),
  ('collaborator', 'content.create'), ('collaborator', 'content.update'),
  ('collaborator', 'approvals.view'), ('collaborator', 'comments.create_internal'),
  ('collaborator', 'calendar.view'), ('collaborator', 'media.view'),
  ('collaborator', 'media.upload'),
  ('external_approver', 'portal.view'), ('external_approver', 'approvals.decide'),
  ('external_approver', 'comments.create_external'),
  ('external_commenter', 'portal.view'), ('external_commenter', 'comments.create_external')
) as seed (role_key, action_key) on seed.role_key = r.key
on conflict do nothing;

commit;

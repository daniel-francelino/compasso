begin;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  email extensions.citext not null,
  role_id uuid not null references public.roles (id),
  grants jsonb not null default '[]' check (jsonb_typeof(grants) = 'array'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  invited_by uuid references public.profiles (id),
  accepted_by uuid references public.profiles (id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_org_status_idx on public.invitations (organization_id, status);
create index invitations_email_idx on public.invitations (email);

alter table public.invitations enable row level security;

create policy invitations_read on public.invitations for select
  using (public.has_action('users.view'));

revoke all on public.invitations from anon, authenticated;
grant select (
  id, organization_id, email, role_id, grants, status, expires_at, invited_by, accepted_by,
  accepted_at, revoked_at, created_at
) on public.invitations to authenticated;

create function public.invitation_create(
  p_email text,
  p_role uuid,
  p_grants jsonb,
  p_token_hash text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role public.roles;
  v_grant jsonb;
  v_brand uuid;
  v_id uuid;
  v_previous uuid;
begin
  perform public.assert_action('invitations.create');
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '30 days'
     or jsonb_typeof(coalesce(p_grants, '[]'::jsonb)) <> 'array' then
    raise exception 'invalid_input';
  end if;

  select * into v_role from public.roles r where r.id = p_role;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.is_admin() and (
    v_role.is_system or exists (
      select 1 from public.role_actions ra
      join public.actions a on a.key = ra.action_key
      where ra.role_id = p_role and a.admin_only
    )
  ) then
    raise exception 'role_not_assignable';
  end if;

  if exists (select 1 from public.profiles p where p.email = v_email) then
    raise exception 'invalid_input';
  end if;
  if v_role.portal_only and jsonb_array_length(coalesce(p_grants, '[]'::jsonb)) = 0 then
    raise exception 'invalid_input';
  end if;

  if jsonb_array_length(coalesce(p_grants, '[]'::jsonb)) > 0 then
    perform public.assert_action('brands.manage_members');
  end if;
  for v_grant in select * from jsonb_array_elements(coalesce(p_grants, '[]'::jsonb)) loop
    v_brand := nullif(v_grant ->> 'brand_id', '')::uuid;
    if v_brand is null then
      raise exception 'invalid_input';
    end if;
    perform public.assert_brand_access(v_brand);
    if coalesce((v_grant ->> 'can_decide')::boolean, false) and not v_role.portal_only then
      raise exception 'invalid_input';
    end if;
  end loop;

  for v_previous in
    update public.invitations
    set status = 'revoked', revoked_at = now()
    where email = v_email and status = 'pending'
    returning id
  loop
    perform public.audit_write(v_org, null, 'invitation.revoked', 'invitation', v_previous,
      jsonb_build_object('reason', 'replaced'));
  end loop;

  insert into public.invitations (organization_id, email, role_id, grants, token_hash, expires_at, invited_by)
  values (v_org, v_email, p_role, coalesce(p_grants, '[]'::jsonb), p_token_hash, p_expires_at, auth.uid())
  returning id into v_id;

  perform public.audit_write(v_org, null, 'invitation.created', 'invitation', v_id,
    jsonb_build_object('role_id', p_role));
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.invitation_revoke(p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('invitations.create');
  update public.invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation and status = 'pending';
  if not found then
    raise exception 'not_found';
  end if;
  perform public.audit_write(public.current_organization_id(), null, 'invitation.revoked',
    'invitation', p_invitation, '{}'::jsonb);
end;
$$;

create function public.accept_invitation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_auth_email text;
  v_full_name text;
  v_inv public.invitations;
  v_role public.roles;
  v_kind text;
  v_grant jsonb;
  v_brand uuid;
begin
  if v_user is null then
    raise exception 'denied';
  end if;

  select * into v_inv from public.invitations i where i.token_hash = p_token_hash for update;
  if not found or v_inv.status <> 'pending' or v_inv.expires_at <= now() then
    raise exception 'invitation_invalid';
  end if;

  select u.email, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1))
  into v_auth_email, v_full_name
  from auth.users u where u.id = v_user;
  if lower(v_auth_email) <> lower(v_inv.email::text) then
    raise exception 'invitation_email_mismatch';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user) then
    raise exception 'invitation_invalid';
  end if;

  select * into v_role from public.roles r where r.id = v_inv.role_id;
  v_kind := case when v_role.portal_only then 'external' else 'internal' end;

  insert into public.profiles (id, full_name, email, status, kind, role_id)
  values (v_user, left(v_full_name, 120), lower(v_auth_email), 'approved', v_kind, v_inv.role_id);

  for v_grant in select * from jsonb_array_elements(v_inv.grants) loop
    v_brand := (v_grant ->> 'brand_id')::uuid;
    insert into public.brand_members (brand_id, user_id, kind, can_decide, granted_by)
    values (v_brand, v_user, v_kind, v_kind = 'external' and coalesce((v_grant ->> 'can_decide')::boolean, false), v_inv.invited_by)
    on conflict (brand_id, user_id) do nothing;
  end loop;

  update public.invitations
  set status = 'accepted', accepted_by = v_user, accepted_at = now()
  where id = v_inv.id;

  perform public.audit_write(v_inv.organization_id, null, 'invitation.accepted', 'invitation', v_inv.id,
    jsonb_build_object('role_id', v_inv.role_id));
  perform public.notify_users(
    'invitation.accepted', null, 'Convite aceito',
    left(v_full_name, 120) || ' aceitou o convite e já pode acessar.',
    '/admin/settings/users', 'invitation', v_inv.id, 'invitation.accepted:' || v_inv.id,
    array[v_inv.invited_by]
  );
  perform public.resolve_notifications('invitation', v_inv.id);
  return jsonb_build_object('profile_id', v_user, 'kind', v_kind);
end;
$$;

create function public.notify_scan_invitations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv record;
begin
  update public.invitations set status = 'expired' where status = 'pending' and expires_at <= now();

  for v_inv in
    select i.id, i.invited_by
    from public.invitations i
    where i.status = 'pending'
      and i.invited_by is not null
      and i.expires_at <= now() + make_interval(days => coalesce((public.notification_lead_days(i.invited_by, 'invitation.expiring'))[1], 1))
  loop
    perform public.notify_users(
      'invitation.expiring', null, 'Convite perto de expirar',
      'Um convite que você enviou expira em breve.', '/admin/settings/users',
      'invitation', v_inv.id, 'invitation.expiring:' || v_inv.id, array[v_inv.invited_by]
    );
  end loop;
end;
$$;

update public.notification_kinds set available = true where kind = 'invitation.expiring';

revoke execute on function public.invitation_create(text, uuid, jsonb, text, timestamptz),
  public.invitation_revoke(uuid), public.accept_invitation(text), public.notify_scan_invitations()
  from public, anon;
revoke execute on function public.notify_scan_invitations() from authenticated;
grant execute on function public.invitation_create(text, uuid, jsonb, text, timestamptz),
  public.invitation_revoke(uuid), public.accept_invitation(text) to authenticated;

commit;

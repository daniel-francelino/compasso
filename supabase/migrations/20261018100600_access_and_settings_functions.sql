begin;

create function public.profile_set_access(p_profile uuid, p_status text, p_role uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles;
begin
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then
    raise exception 'invalid_input';
  end if;
  select * into v_old from public.profiles p where p.id = p_profile for update;
  if not found then
    raise exception 'not_found';
  end if;

  if not public.has_action('users.manage') then
    if not (
      public.has_action('users.approve')
      and v_old.status = 'pending'
      and p_status in ('approved', 'rejected')
    ) then
      raise exception 'denied';
    end if;
  end if;

  update public.profiles
  set status = p_status, role_id = coalesce(p_role, role_id)
  where id = p_profile;
end;
$$;

create function public.role_save(p_role jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_role ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p_role ->> 'name', ''));
  v_description text := nullif(btrim(coalesce(p_role ->> 'description', '')), '');
  v_portal boolean := coalesce((p_role ->> 'portal_only')::boolean, false);
  v_actions text[] := array(
    select distinct jsonb_array_elements_text(coalesce(p_role -> 'actions', '[]'::jsonb))
  );
  v_key text;
  v_unknown text;
begin
  perform public.assert_action('roles.manage');
  if char_length(v_name) not between 2 and 60 then
    raise exception 'invalid_input';
  end if;
  select a into v_unknown from unnest(v_actions) a
  where not exists (select 1 from public.actions x where x.key = a) limit 1;
  if v_unknown is not null then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    v_key := regexp_replace(lower(translate(v_name,
      'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '_', 'g');
    v_key := btrim(v_key, '_');
    if v_key = '' or exists (select 1 from public.roles r where r.key = v_key) then
      v_key := coalesce(nullif(v_key, ''), 'role') || '_' || substr(gen_random_uuid()::text, 1, 6);
    end if;
    insert into public.roles (key, name, description, portal_only)
    values (v_key, v_name, v_description, v_portal)
    returning id into v_id;
  else
    update public.roles
    set name = v_name, description = v_description, portal_only = v_portal
    where id = v_id;
    if not found then
      raise exception 'not_found';
    end if;
  end if;

  delete from public.role_actions where role_id = v_id and action_key <> all (v_actions);
  insert into public.role_actions (role_id, action_key)
  select v_id, a from unnest(v_actions) a
  on conflict do nothing;

  set constraints all immediate;
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.role_delete(p_role uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('roles.manage');
  delete from public.roles where id = p_role;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.organization_save(p_organization jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations;
  v_expected int := nullif(p_organization ->> 'expected_version', '')::int;
  v_name text := btrim(coalesce(p_organization ->> 'name', ''));
  v_timezone text := btrim(coalesce(p_organization ->> 'default_timezone', ''));
  v_email text := nullif(btrim(coalesce(p_organization ->> 'contact_email', '')), '');
  v_version int;
begin
  perform public.assert_action('settings.manage');
  if char_length(v_name) not between 2 and 120
     or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = v_timezone)
     or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_input';
  end if;
  select * into v_org from public.organizations o for update;
  if v_expected is null or v_expected <> v_org.version then
    raise exception 'conflict';
  end if;
  update public.organizations
  set name = v_name,
      legal_name = nullif(btrim(coalesce(p_organization ->> 'legal_name', '')), ''),
      tax_id = nullif(btrim(coalesce(p_organization ->> 'tax_id', '')), ''),
      default_timezone = v_timezone,
      contact_email = v_email,
      version = version + 1
  where id = v_org.id
  returning version into v_version;
  perform public.audit_write(v_org.id, null, 'organization.updated', 'organization', v_org.id,
    jsonb_build_object('fields', jsonb_build_array('name', 'legal_name', 'tax_id', 'default_timezone', 'contact_email')));
  return jsonb_build_object('id', v_org.id, 'version', v_version);
end;
$$;

create function public.organization_setting_save(p_key text, p_value jsonb, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.organization_settings;
  v_version int;
begin
  perform public.assert_action('settings.manage');
  if p_key not in (
    'policies.approvals', 'policies.calendar', 'policies.uploads', 'policies.urls',
    'policies.retention', 'policies.invitations', 'policies.security', 'policies.email'
  ) or jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid_input';
  end if;

  select * into v_current from public.organization_settings s where s.key = p_key for update;
  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'conflict';
    end if;
    insert into public.organization_settings (key, value, updated_by)
    values (p_key, p_value, auth.uid())
    returning version into v_version;
  else
    if p_expected_version is distinct from v_current.version then
      raise exception 'conflict';
    end if;
    update public.organization_settings
    set value = p_value, version = version + 1, updated_by = auth.uid()
    where key = p_key
    returning version into v_version;
  end if;

  perform public.audit_write(public.current_organization_id(), null, 'settings.policy_changed',
    'organization_setting', null, jsonb_build_object('key', p_key));
  return jsonb_build_object('key', p_key, 'version', v_version);
end;
$$;

create function public.audit_list(p_filters jsonb, p_page int, p_export boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_size int := case when p_export then 5000 else 50 end;
  v_offset int := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  v_from timestamptz := nullif(v_filters ->> 'from', '')::timestamptz;
  v_to timestamptz := nullif(v_filters ->> 'to', '')::timestamptz;
  v_actor uuid := nullif(v_filters ->> 'actor_id', '')::uuid;
  v_brand uuid := nullif(v_filters ->> 'brand_id', '')::uuid;
  v_domain text := nullif(btrim(coalesce(v_filters ->> 'domain', '')), '');
  v_entity text := nullif(btrim(coalesce(v_filters ->> 'entity_type', '')), '');
  v_entity_id uuid := nullif(v_filters ->> 'entity_id', '')::uuid;
  v_total int;
  v_rows jsonb;
begin
  perform public.assert_action('audit.view');

  select count(*)::int into v_total
  from public.audit_events e
  where (e.brand_id is null or public.can_access_brand(e.brand_id))
      and (v_from is null or e.occurred_at >= v_from)
      and (v_to is null or e.occurred_at < v_to)
      and (v_actor is null or e.actor_id = v_actor)
      and (v_brand is null or e.brand_id = v_brand)
      and (v_domain is null or e.action like v_domain || '.%')
      and (v_entity is null or e.entity_type = v_entity)
      and (v_entity_id is null or e.entity_id = v_entity_id);

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.occurred_at desc, r.id desc), '[]'::jsonb)
  into v_rows
  from (
    select e.id, e.occurred_at, e.actor_id, p.full_name as actor_name, e.actor_kind, e.action,
           e.entity_type, e.entity_id, e.brand_id, b.name as brand_name, e.metadata, e.request_id
    from public.audit_events e
    left join public.profiles p on p.id = e.actor_id
    left join public.brands b on b.id = e.brand_id
    where (e.brand_id is null or public.can_access_brand(e.brand_id))
      and (v_from is null or e.occurred_at >= v_from)
      and (v_to is null or e.occurred_at < v_to)
      and (v_actor is null or e.actor_id = v_actor)
      and (v_brand is null or e.brand_id = v_brand)
      and (v_domain is null or e.action like v_domain || '.%')
      and (v_entity is null or e.entity_type = v_entity)
      and (v_entity_id is null or e.entity_id = v_entity_id)
    order by e.occurred_at desc, e.id desc
    offset v_offset limit v_size
  ) r;

  if p_export then
    perform public.audit_write(public.current_organization_id(), null, 'audit.exported', 'audit_event',
      null, jsonb_build_object('total', v_total));
  end if;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke execute on function public.profile_set_access(uuid, text, uuid), public.role_save(jsonb),
  public.role_delete(uuid), public.organization_save(jsonb),
  public.organization_setting_save(text, jsonb, int), public.audit_list(jsonb, int, boolean)
  from public, anon;
grant execute on function public.profile_set_access(uuid, text, uuid), public.role_save(jsonb),
  public.role_delete(uuid), public.organization_save(jsonb),
  public.organization_setting_save(text, jsonb, int), public.audit_list(jsonb, int, boolean)
  to authenticated;

commit;

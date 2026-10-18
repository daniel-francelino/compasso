begin;

create function public.client_save(p_client jsonb, p_create_brand boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_client ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p_client ->> 'name', ''));
  v_owner uuid := nullif(p_client ->> 'owner_user_id', '')::uuid;
  v_notes text := nullif(btrim(coalesce(p_client ->> 'internal_notes', '')), '');
  v_tags text[] := coalesce(
    array(select btrim(t) from jsonb_array_elements_text(coalesce(p_client -> 'tags', '[]'::jsonb)) t
          where btrim(t) <> ''),
    '{}'
  );
  v_expected int := nullif(p_client ->> 'expected_version', '')::int;
  v_org uuid := public.current_organization_id();
  v_actor uuid := auth.uid();
  v_old public.clients;
  v_version int;
  v_brand uuid;
  v_timezone text;
begin
  if char_length(v_name) not between 2 and 120 then
    raise exception 'invalid_input';
  end if;
  if v_owner is not null and not exists (
    select 1 from public.profiles p
    where p.id = v_owner and p.status = 'approved' and p.kind = 'internal'
  ) then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    perform public.assert_action('clients.create');
    if p_create_brand then
      perform public.assert_action('brands.create');
    end if;
    insert into public.clients (organization_id, name, owner_user_id, internal_notes, tags, created_by)
    values (v_org, v_name, coalesce(v_owner, v_actor), v_notes, v_tags, v_actor)
    returning id, version into v_id, v_version;
    perform public.audit_write(v_org, null, 'client.created', 'client', v_id, '{}'::jsonb);

    if p_create_brand then
      select o.default_timezone into v_timezone from public.organizations o where o.id = v_org;
      insert into public.brands (organization_id, client_id, name, timezone, created_by)
      values (v_org, v_id, v_name, v_timezone, v_actor)
      returning id into v_brand;
      insert into public.brand_members (brand_id, user_id, kind, granted_by)
      select v_brand, v_actor, 'internal', v_actor
      where exists (select 1 from public.profiles p where p.id = v_actor and p.kind = 'internal');
      perform public.audit_write(v_org, v_brand, 'brand.created', 'brand', v_brand, '{}'::jsonb);
    end if;
    return jsonb_build_object('id', v_id, 'version', v_version, 'brand_id', v_brand);
  end if;

  perform public.assert_action('clients.update');
  if not public.can_view_client(v_id) then
    raise exception 'not_found';
  end if;
  select * into v_old from public.clients c where c.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;

  update public.clients
  set name = v_name,
      owner_user_id = v_owner,
      internal_notes = v_notes,
      tags = v_tags,
      version = version + 1
  where id = v_id
  returning version into v_version;

  perform public.audit_write(
    v_org, null, 'client.updated', 'client', v_id,
    jsonb_build_object('fields', jsonb_build_array('name', 'internal_notes', 'tags'))
  );
  if v_owner is distinct from v_old.owner_user_id then
    perform public.audit_write(v_org, null, 'client.owner_changed', 'client', v_id, '{}'::jsonb);
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version, 'brand_id', null);
end;
$$;

create function public.client_set_archived(
  p_client uuid,
  p_archived boolean,
  p_archive_brands boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_version int;
  v_brand record;
begin
  perform public.assert_action('clients.update');
  if not public.can_view_client(p_client) then
    raise exception 'not_found';
  end if;

  update public.clients
  set archived_at = case when p_archived then now() else null end,
      version = version + 1
  where id = p_client
  returning version into v_version;
  if not found then
    raise exception 'not_found';
  end if;

  perform public.audit_write(
    v_org, null,
    case when p_archived then 'client.archived' else 'client.reactivated' end,
    'client', p_client, '{}'::jsonb
  );

  if p_archived and p_archive_brands then
    perform public.assert_action('brands.update');
    for v_brand in
      select b.id from public.brands b
      where b.client_id = p_client and b.archived_at is null and public.can_access_brand(b.id)
    loop
      update public.brands set archived_at = now(), version = version + 1 where id = v_brand.id;
      perform public.audit_write(v_org, v_brand.id, 'brand.archived', 'brand', v_brand.id, '{}'::jsonb);
    end loop;
  end if;
  return jsonb_build_object('id', p_client, 'version', v_version);
end;
$$;

create function public.client_delete(p_client uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('clients.delete');
  if not public.can_view_client(p_client) then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.brands b where b.client_id = p_client) then
    raise exception 'client_has_brands';
  end if;
  delete from public.clients where id = p_client;
  perform public.audit_write(
    public.current_organization_id(), null, 'client.deleted', 'client', p_client, '{}'::jsonb
  );
end;
$$;

create function public.client_contact_save(p_contact jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_contact ->> 'id', '')::uuid;
  v_client uuid := nullif(p_contact ->> 'client_id', '')::uuid;
  v_name text := btrim(coalesce(p_contact ->> 'name', ''));
  v_email text := nullif(btrim(coalesce(p_contact ->> 'email', '')), '');
  v_phone text := nullif(btrim(coalesce(p_contact ->> 'phone', '')), '');
  v_title text := nullif(btrim(coalesce(p_contact ->> 'role_title', '')), '');
  v_primary boolean := coalesce((p_contact ->> 'is_primary')::boolean, false);
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('clients.update');
  if v_id is not null then
    select c.client_id into v_client from public.client_contacts c where c.id = v_id;
  end if;
  if v_client is null or not public.can_view_client(v_client) then
    raise exception 'not_found';
  end if;
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_input';
  end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'contact_email_invalid';
  end if;

  if v_primary then
    update public.client_contacts set is_primary = false
    where client_id = v_client and is_primary and id is distinct from v_id;
  end if;

  if v_id is null then
    insert into public.client_contacts (client_id, name, email, phone, role_title, is_primary)
    values (v_client, v_name, v_email, v_phone, v_title, v_primary)
    returning id into v_id;
    perform public.audit_write(v_org, null, 'contact.created', 'client_contact', v_id, '{}'::jsonb);
  else
    update public.client_contacts
    set name = v_name, email = v_email, phone = v_phone, role_title = v_title, is_primary = v_primary
    where id = v_id;
    perform public.audit_write(v_org, null, 'contact.updated', 'client_contact', v_id, '{}'::jsonb);
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.client_contact_delete(p_contact uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid;
begin
  perform public.assert_action('clients.update');
  select c.client_id into v_client from public.client_contacts c where c.id = p_contact;
  if v_client is null or not public.can_view_client(v_client) then
    raise exception 'not_found';
  end if;
  delete from public.client_contacts where id = p_contact;
  perform public.audit_write(
    public.current_organization_id(), null, 'contact.deleted', 'client_contact', p_contact, '{}'::jsonb
  );
end;
$$;

create function public.brand_save(p_brand jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_brand ->> 'id', '')::uuid;
  v_client uuid := nullif(p_brand ->> 'client_id', '')::uuid;
  v_name text := btrim(coalesce(p_brand ->> 'name', ''));
  v_timezone text := nullif(btrim(coalesce(p_brand ->> 'timezone', '')), '');
  v_identity jsonb := coalesce(p_brand -> 'visual_identity', '{}'::jsonb);
  v_expected int := nullif(p_brand ->> 'expected_version', '')::int;
  v_org uuid := public.current_organization_id();
  v_actor uuid := auth.uid();
  v_old public.brands;
  v_version int;
begin
  if char_length(v_name) not between 2 and 120 or jsonb_typeof(v_identity) <> 'object' then
    raise exception 'invalid_input';
  end if;
  if v_timezone is not null and not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = v_timezone
  ) then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    perform public.assert_action('brands.create');
    perform public.assert_action('clients.view');
    if v_client is null or not public.can_view_client(v_client) then
      raise exception 'not_found';
    end if;
    if v_timezone is null then
      select o.default_timezone into v_timezone from public.organizations o where o.id = v_org;
    end if;
    begin
      insert into public.brands (
        organization_id, client_id, name, description, target_audience, tone_of_voice,
        objectives, references_notes, visual_identity, timezone, created_by
      )
      values (
        v_org, v_client, v_name,
        nullif(btrim(coalesce(p_brand ->> 'description', '')), ''),
        nullif(btrim(coalesce(p_brand ->> 'target_audience', '')), ''),
        nullif(btrim(coalesce(p_brand ->> 'tone_of_voice', '')), ''),
        nullif(btrim(coalesce(p_brand ->> 'objectives', '')), ''),
        nullif(btrim(coalesce(p_brand ->> 'references_notes', '')), ''),
        v_identity, v_timezone, v_actor
      )
      returning id, version into v_id, v_version;
    exception when unique_violation then
      raise exception 'brand_name_taken';
    end;
    insert into public.brand_members (brand_id, user_id, kind, granted_by)
    select v_id, v_actor, 'internal', v_actor
    where exists (select 1 from public.profiles p where p.id = v_actor and p.kind = 'internal');
    perform public.audit_write(v_org, v_id, 'brand.created', 'brand', v_id, '{}'::jsonb);
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  perform public.assert_action('brands.update');
  perform public.assert_brand_access(v_id);
  select * into v_old from public.brands b where b.id = v_id for update;
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;
  v_timezone := coalesce(v_timezone, v_old.timezone);

  begin
    update public.brands
    set name = v_name,
        description = nullif(btrim(coalesce(p_brand ->> 'description', '')), ''),
        target_audience = nullif(btrim(coalesce(p_brand ->> 'target_audience', '')), ''),
        tone_of_voice = nullif(btrim(coalesce(p_brand ->> 'tone_of_voice', '')), ''),
        objectives = nullif(btrim(coalesce(p_brand ->> 'objectives', '')), ''),
        references_notes = nullif(btrim(coalesce(p_brand ->> 'references_notes', '')), ''),
        visual_identity = v_identity,
        timezone = v_timezone,
        version = version + 1
    where id = v_id
    returning version into v_version;
  exception when unique_violation then
    raise exception 'brand_name_taken';
  end;

  perform public.audit_write(v_org, v_id, 'brand.updated', 'brand', v_id, '{}'::jsonb);
  if v_timezone <> v_old.timezone then
    perform public.audit_write(
      v_org, v_id, 'brand.timezone_changed', 'brand', v_id,
      jsonb_build_object('from', v_old.timezone, 'to', v_timezone)
    );
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.brand_set_archived(p_brand uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
begin
  perform public.assert_action('brands.update');
  perform public.assert_brand_access(p_brand);
  update public.brands
  set archived_at = case when p_archived then now() else null end, version = version + 1
  where id = p_brand
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), p_brand,
    case when p_archived then 'brand.archived' else 'brand.reactivated' end,
    'brand', p_brand, '{}'::jsonb
  );
  return jsonb_build_object('id', p_brand, 'version', v_version);
end;
$$;

create function public.brand_delete(p_brand uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('brands.delete');
  perform public.assert_brand_access(p_brand);
  if public.brand_has_history(p_brand)
     or exists (select 1 from public.channels c where c.brand_id = p_brand) then
    raise exception 'brand_not_empty';
  end if;
  delete from public.brands where id = p_brand;
  perform public.audit_write(v_org, null, 'brand.deleted', 'brand', p_brand, '{}'::jsonb);
end;
$$;

create function public.brand_member_set(
  p_brand uuid,
  p_user uuid,
  p_kind text,
  p_can_decide boolean,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_old public.brand_members;
  v_profile public.profiles;
begin
  perform public.assert_action('brands.manage_members');
  perform public.assert_brand_access(p_brand);
  if p_kind not in ('internal', 'external') or p_status not in ('active', 'revoked') then
    raise exception 'invalid_input';
  end if;
  select * into v_profile from public.profiles p where p.id = p_user and p.status = 'approved';
  if not found then
    raise exception 'not_found';
  end if;
  if v_profile.kind <> p_kind then
    raise exception 'member_kind_mismatch';
  end if;

  select * into v_old from public.brand_members m
  where m.brand_id = p_brand and m.user_id = p_user for update;

  insert into public.brand_members (brand_id, user_id, kind, can_decide, status, granted_by, revoked_at)
  values (
    p_brand, p_user, p_kind, p_kind = 'external' and p_can_decide, p_status, auth.uid(),
    case when p_status = 'revoked' then now() else null end
  )
  on conflict (brand_id, user_id) do update
  set can_decide = excluded.can_decide,
      status = excluded.status,
      revoked_at = excluded.revoked_at,
      granted_by = excluded.granted_by,
      granted_at = case when v_old.status = 'revoked' and excluded.status = 'active'
                        then now() else public.brand_members.granted_at end;

  if not exists (
    select 1 from public.brand_members m
    where m.brand_id = p_brand and m.kind = 'internal' and m.status = 'active'
  ) and exists (select 1 from public.brand_members m where m.brand_id = p_brand and m.kind = 'internal') then
    raise exception 'last_internal_member';
  end if;

  if v_old.user_id is null or (v_old.status = 'revoked' and p_status = 'active') then
    perform public.audit_write(v_org, p_brand, 'brand.member_added', 'brand_member', null,
      jsonb_build_object('user_id', p_user, 'kind', p_kind));
  elsif p_status = 'revoked' and v_old.status = 'active' then
    perform public.audit_write(v_org, p_brand, 'brand.member_revoked', 'brand_member', null,
      jsonb_build_object('user_id', p_user));
  elsif v_old.can_decide is distinct from (p_kind = 'external' and p_can_decide) then
    perform public.audit_write(v_org, p_brand, 'brand.member_can_decide_changed', 'brand_member', null,
      jsonb_build_object('user_id', p_user, 'can_decide', p_can_decide));
  end if;
end;
$$;

create function public.channel_save(p_channel jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_channel ->> 'id', '')::uuid;
  v_brand uuid := nullif(p_channel ->> 'brand_id', '')::uuid;
  v_platform text := p_channel ->> 'platform';
  v_name text := btrim(coalesce(p_channel ->> 'profile_name', ''));
  v_url text := nullif(btrim(coalesce(p_channel ->> 'profile_url', '')), '');
  v_external text := nullif(btrim(coalesce(p_channel ->> 'external_id', '')), '');
  v_notes text := nullif(btrim(coalesce(p_channel ->> 'notes', '')), '');
  v_expected int := nullif(p_channel ->> 'expected_version', '')::int;
  v_org uuid := public.current_organization_id();
  v_old public.channels;
  v_version int;
begin
  if v_platform is null or v_platform not in (
    'instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'x', 'pinterest', 'threads',
    'email', 'blog', 'other'
  ) then
    raise exception 'invalid_input';
  end if;
  if v_platform in ('instagram', 'tiktok', 'x', 'threads') and v_name <> '' then
    v_name := '@' || ltrim(v_name, '@');
  end if;
  if char_length(v_name) not between 1 and 120 or (v_url is not null and v_url !~ '^https://') then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    perform public.assert_action('channels.create');
    perform public.assert_brand_access(v_brand);
    begin
      insert into public.channels (brand_id, platform, profile_name, profile_url, external_id, notes)
      values (v_brand, v_platform, v_name, v_url, v_external, v_notes)
      returning id, version into v_id, v_version;
    exception when unique_violation then
      raise exception 'channel_duplicate';
    end;
    perform public.audit_write(v_org, v_brand, 'channel.created', 'channel', v_id, '{}'::jsonb);
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  perform public.assert_action('channels.update');
  select * into v_old from public.channels c where c.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;
  if v_platform <> v_old.platform and public.channel_is_used(v_id) then
    raise exception 'platform_change_forbidden';
  end if;

  begin
    update public.channels
    set platform = v_platform, profile_name = v_name, profile_url = v_url, external_id = v_external,
        notes = v_notes, version = version + 1
    where id = v_id
    returning version into v_version;
  exception when unique_violation then
    raise exception 'channel_duplicate';
  end;
  perform public.audit_write(v_org, v_old.brand_id, 'channel.updated', 'channel', v_id, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.channel_set_archived(p_channel uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
  v_version int;
begin
  perform public.assert_action('channels.update');
  select c.brand_id into v_brand from public.channels c where c.id = p_channel;
  if v_brand is null then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_brand);
  begin
    update public.channels
    set archived_at = case when p_archived then now() else null end, version = version + 1
    where id = p_channel
    returning version into v_version;
  exception when unique_violation then
    raise exception 'channel_duplicate';
  end;
  perform public.audit_write(
    public.current_organization_id(), v_brand,
    case when p_archived then 'channel.archived' else 'channel.reactivated' end,
    'channel', p_channel, '{}'::jsonb
  );
  return jsonb_build_object('id', p_channel, 'version', v_version);
end;
$$;

create function public.channel_delete(p_channel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  perform public.assert_action('channels.delete');
  select c.brand_id into v_brand from public.channels c where c.id = p_channel;
  if v_brand is null then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_brand);
  if public.channel_is_used(p_channel) then
    raise exception 'channel_in_use';
  end if;
  delete from public.channels where id = p_channel;
  perform public.audit_write(
    public.current_organization_id(), v_brand, 'channel.deleted', 'channel', p_channel, '{}'::jsonb
  );
end;
$$;

revoke execute on function public.can_access_brand(uuid),
  public.is_external_brand_member(uuid, boolean), public.can_view_client(uuid),
  public.assert_action(text), public.assert_brand_access(uuid),
  public.current_organization_id(), public.channel_is_used(uuid),
  public.brand_has_history(uuid),
  public.client_save(jsonb, boolean), public.client_set_archived(uuid, boolean, boolean),
  public.client_delete(uuid), public.client_contact_save(jsonb), public.client_contact_delete(uuid),
  public.brand_save(jsonb), public.brand_set_archived(uuid, boolean), public.brand_delete(uuid),
  public.brand_member_set(uuid, uuid, text, boolean, text), public.channel_save(jsonb),
  public.channel_set_archived(uuid, boolean), public.channel_delete(uuid)
  from public, anon;

grant execute on function public.can_access_brand(uuid),
  public.is_external_brand_member(uuid, boolean), public.can_view_client(uuid),
  public.client_save(jsonb, boolean), public.client_set_archived(uuid, boolean, boolean),
  public.client_delete(uuid), public.client_contact_save(jsonb), public.client_contact_delete(uuid),
  public.brand_save(jsonb), public.brand_set_archived(uuid, boolean), public.brand_delete(uuid),
  public.brand_member_set(uuid, uuid, text, boolean, text), public.channel_save(jsonb),
  public.channel_set_archived(uuid, boolean), public.channel_delete(uuid)
  to authenticated;

revoke execute on function public.assert_action(text), public.assert_brand_access(uuid),
  public.current_organization_id(), public.channel_is_used(uuid),
  public.brand_has_history(uuid) from authenticated;

commit;

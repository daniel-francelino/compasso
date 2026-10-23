begin;

alter table public.media_assets drop constraint media_assets_scope_check;
alter table public.media_assets add constraint media_assets_scope_check
  check (scope in ('site', 'brand', 'profile'));
alter table public.media_assets add column owner_id uuid references public.profiles (id);
alter table public.media_assets add constraint media_assets_owner_check
  check ((scope = 'profile') = (owner_id is not null));
create index media_assets_owner_idx on public.media_assets (owner_id) where owner_id is not null;

alter table public.media_usages drop constraint media_usages_usage_type_check;
alter table public.media_usages add constraint media_usages_usage_type_check check (usage_type in (
  'content_revision', 'site_page_revision', 'case_study', 'brand_identity', 'publication_evidence',
  'profile_avatar'
));

alter table public.profiles
  add column avatar_media_version_id uuid references public.media_versions (id);
create index profiles_avatar_idx on public.profiles (avatar_media_version_id)
  where avatar_media_version_id is not null;

drop policy media_assets_read on public.media_assets;
create policy media_assets_read on public.media_assets for select
  using (
    (scope = 'profile' and owner_id = auth.uid())
    or (
      public.has_action('media.view')
      and (
        (scope = 'brand' and public.can_access_brand(brand_id))
        or (scope = 'site' and public.has_action('site.view'))
        or scope = 'profile'
      )
    )
  );

create or replace function public.media_assert_asset_access(p_asset uuid)
returns public.media_assets
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets;
begin
  select * into v_asset from public.media_assets a where a.id = p_asset;
  if not found then
    raise exception 'not_found';
  end if;
  if v_asset.scope = 'profile' then
    raise exception 'not_found';
  elsif v_asset.scope = 'brand' then
    perform public.assert_brand_access(v_asset.brand_id);
  elsif not public.has_action('site.view') then
    raise exception 'not_found';
  end if;
  return v_asset;
end;
$$;

create or replace function public.media_request_upload(
  p_scope text,
  p_brand uuid,
  p_filename text,
  p_size bigint,
  p_mime text,
  p_idempotency_key text,
  p_asset uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := auth.uid();
  v_asset public.media_assets;
  v_scope text := p_scope;
  v_brand uuid := p_brand;
  v_owner uuid;
  v_kind text;
  v_limit_mb int;
  v_quota_mb int;
  v_name text;
  v_base text;
  v_ext text;
  v_n int := 0;
  v_version_no int := 1;
  v_key text := gen_random_uuid()::text;
  v_thumb text;
  v_display text;
  v_version uuid;
  v_session uuid;
  v_existing public.media_upload_sessions;
  v_existing_version public.media_versions;
begin
  if p_scope is distinct from 'profile' or p_asset is not null then
    perform public.assert_action('media.upload');
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'invalid_input';
  end if;

  select * into v_existing from public.media_upload_sessions s
  where s.author_id = v_actor and s.idempotency_key = p_idempotency_key;
  if found then
    select * into v_existing_version from public.media_versions v where v.id = v_existing.version_id;
    if v_existing.status <> 'open' then
      raise exception 'invalid_input';
    end if;
    return jsonb_build_object(
      'session_id', v_existing.id, 'asset_id', v_existing_version.asset_id,
      'version_id', v_existing_version.id, 'storage_key', v_existing_version.storage_key,
      'thumb_key', v_existing_version.thumb_key, 'display_key', v_existing_version.display_key,
      'kind', case when p_mime like 'image/%' then 'image' when p_mime like 'video/%' then 'video' else 'document' end
    );
  end if;

  if p_asset is not null then
    perform public.assert_action('media.update');
    v_asset := public.media_assert_asset_access(p_asset);
    v_scope := v_asset.scope;
    v_brand := v_asset.brand_id;
  elsif v_scope = 'brand' then
    perform public.assert_brand_access(v_brand);
    if exists (select 1 from public.brands b where b.id = v_brand and b.archived_at is not null) then
      raise exception 'invalid_input';
    end if;
  elsif v_scope = 'site' then
    perform public.assert_action('site.view');
    v_brand := null;
  elsif v_scope = 'profile' then
    if not exists (select 1 from public.profiles p where p.id = v_actor and p.status = 'approved') then
      raise exception 'denied';
    end if;
    v_brand := null;
    v_owner := v_actor;
  else
    raise exception 'invalid_input';
  end if;

  v_kind := case p_mime
    when 'image/jpeg' then 'image'
    when 'image/png' then 'image'
    when 'image/webp' then 'image'
    when 'video/mp4' then 'video'
    when 'application/pdf' then 'document'
    else null
  end;
  if v_kind is null then
    raise exception 'upload_type_not_allowed';
  end if;
  if p_size is null or p_size <= 0 then
    raise exception 'invalid_input';
  end if;
  if v_scope = 'profile' and v_kind <> 'image' then
    raise exception 'upload_type_not_allowed';
  end if;
  if v_scope = 'profile' and p_size > 5242880 then
    raise exception 'upload_too_large';
  end if;

  v_limit_mb := case v_kind
    when 'image' then public.media_policy_mb('maxImageMb', 25)
    when 'video' then public.media_policy_mb('maxVideoMb', 100)
    else public.media_policy_mb('maxDocumentMb', 50)
  end;
  if p_size > v_limit_mb::bigint * 1048576 then
    raise exception 'upload_too_large';
  end if;

  v_quota_mb := public.media_policy_mb('quotaMb', 5120);
  if v_scope <> 'profile' then
    if public.media_storage_used() + p_size + 4194304 > v_quota_mb::bigint * 1048576 then
      raise exception 'quota_exceeded';
    end if;
  end if;

  if p_asset is null then
    v_base := regexp_replace(left(btrim(regexp_replace(coalesce(p_filename, ''), '[\\/\r\n]', '_', 'g')), 190), '^\.+', '');
    if v_base = '' then
      v_base := 'arquivo';
    end if;
    v_ext := coalesce(substring(v_base from '\.[A-Za-z0-9]{1,8}$'), '');
    v_base := left(v_base, char_length(v_base) - char_length(v_ext));
    v_name := v_base || v_ext;
    while exists (
      select 1 from public.media_assets a
      where a.organization_id = v_org and a.scope = v_scope
        and a.brand_id is not distinct from v_brand
        and a.owner_id is not distinct from v_owner
        and a.trashed_at is null and lower(a.display_name) = lower(v_name)
    ) loop
      v_n := v_n + 1;
      v_name := v_base || ' (' || v_n || ')' || v_ext;
    end loop;

    insert into public.media_assets (organization_id, scope, brand_id, owner_id, display_name, created_by)
    values (v_org, v_scope, v_brand, v_owner, v_name, v_actor)
    returning * into v_asset;
  else
    select coalesce(max(v.version_no), 0) + 1 into v_version_no
    from public.media_versions v where v.asset_id = v_asset.id;
  end if;

  v_thumb := case when v_kind in ('image', 'video') then v_key || '-thumb' end;
  v_display := case when v_kind = 'image' then v_key || '-display' end;

  insert into public.media_versions (
    asset_id, version_no, storage_key, thumb_key, display_key, original_filename, mime_type,
    size_bytes, uploaded_by
  )
  values (
    v_asset.id, v_version_no, v_key, v_thumb, v_display, left(coalesce(p_filename, 'arquivo'), 200),
    p_mime, p_size, v_actor
  )
  returning id into v_version;

  insert into public.media_upload_sessions (
    version_id, author_id, purpose, reserved_bytes, idempotency_key, expires_at
  )
  values (
    v_version, v_actor, case when p_asset is null then 'new_asset' else 'new_version' end,
    p_size + 4194304, p_idempotency_key, now() + interval '24 hours'
  )
  returning id into v_session;

  return jsonb_build_object(
    'session_id', v_session, 'asset_id', v_asset.id, 'version_id', v_version,
    'storage_key', v_key, 'thumb_key', v_thumb, 'display_key', v_display, 'kind', v_kind
  );
end;
$$;

create or replace function public.media_confirm_upload(
  p_version uuid,
  p_checksum text,
  p_width int,
  p_height int,
  p_duration int,
  p_derivative_bytes bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.media_upload_sessions;
  v_version public.media_versions;
  v_asset public.media_assets;
begin
  if not exists (
    select 1
    from public.media_versions pv
    join public.media_assets pa on pa.id = pv.asset_id
    where pv.id = p_version and pa.scope = 'profile' and pa.owner_id = auth.uid()
  ) then
    perform public.assert_action('media.upload');
  end if;
  select * into v_session from public.media_upload_sessions s
  where s.version_id = p_version and s.author_id = auth.uid() for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_session.status = 'confirmed' then
    select * into v_version from public.media_versions v where v.id = p_version;
    return jsonb_build_object('asset_id', v_version.asset_id, 'version_id', p_version);
  end if;
  if v_session.status <> 'open' or v_session.expires_at <= now() then
    raise exception 'media_not_available';
  end if;

  select * into v_version from public.media_versions v where v.id = p_version for update;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$'
     or (p_width is not null and p_height is not null and p_width::bigint * p_height > 40000000)
     or coalesce(p_derivative_bytes, 0) < 0 then
    raise exception 'upload_content_mismatch';
  end if;

  update public.media_versions
  set status = 'available', checksum = p_checksum, width = p_width, height = p_height,
      duration_ms = p_duration, derivative_bytes = coalesce(p_derivative_bytes, 0)
  where id = p_version;
  update public.media_upload_sessions set status = 'confirmed' where id = v_session.id;

  select * into v_asset from public.media_assets a where a.id = v_version.asset_id for update;
  if v_asset.current_version_id is null then
    update public.media_assets
    set current_version_id = p_version, size_bytes = v_version.size_bytes, version = version + 1
    where id = v_asset.id;
  end if;
  return jsonb_build_object('asset_id', v_asset.id, 'version_id', p_version);
end;
$$;

create or replace function public.can_view_media_asset(p_asset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media_assets a
    where a.id = p_asset
      and (
        (a.scope = 'profile' and a.owner_id = auth.uid())
        or (
          public.has_action('media.view')
          and (
            (a.scope = 'brand' and public.can_access_brand(a.brand_id))
            or (a.scope = 'site' and public.has_action('site.view'))
            or a.scope = 'profile'
          )
        )
      )
  )
$$;

create function public.profile_set_avatar(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old uuid;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and p.status = 'approved'
  ) then
    raise exception 'denied';
  end if;
  select p.avatar_media_version_id into v_old from public.profiles p where p.id = v_actor for update;

  if p_version is not null and not exists (
    select 1
    from public.media_versions v
    join public.media_assets a on a.id = v.asset_id
    where v.id = p_version
      and a.scope = 'profile'
      and a.owner_id = v_actor
      and a.trashed_at is null
      and v.status = 'available'
      and v.mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ) then
    raise exception 'avatar_invalid';
  end if;

  if v_old is not null and v_old is distinct from p_version then
    delete from public.media_usages
    where media_version_id = v_old and usage_type = 'profile_avatar' and usage_ref_id = v_actor;
    update public.media_assets
    set trashed_at = now()
    where id = (select v.asset_id from public.media_versions v where v.id = v_old)
      and trashed_at is null;
  end if;
  if p_version is not null then
    insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
    values (p_version, 'profile_avatar', v_actor)
    on conflict do nothing;
  end if;

  update public.profiles set avatar_media_version_id = p_version where id = v_actor;
  return jsonb_build_object('id', v_actor);
end;
$$;

create function public.person_avatar_keys(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles me where me.id = auth.uid() and me.status = 'approved'
  ) then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_object_agg(p.id::text, v.thumb_key)
      from public.profiles p
      join public.media_versions v on v.id = p.avatar_media_version_id
      join public.roles r on r.id = p.role_id
      where p.id = any (coalesce(p_ids, '{}'))
        and v.status = 'available'
        and v.thumb_key is not null
        and (
          p.id = auth.uid()
          or (r.key = 'owner' and r.is_system)
          or public.has_action('users.view')
          or exists (
            select 1 from public.brand_members m
            where m.user_id = p.id and m.status = 'active'
              and (public.can_access_brand(m.brand_id) or public.is_external_brand_member(m.brand_id))
          )
        )
    ),
    '{}'::jsonb
  );
end;
$$;

revoke execute on function public.profile_set_avatar(uuid) from public, anon;
revoke execute on function public.person_avatar_keys(uuid[]) from public, anon;
grant execute on function public.profile_set_avatar(uuid) to authenticated;
grant execute on function public.person_avatar_keys(uuid[]) to authenticated;

commit;

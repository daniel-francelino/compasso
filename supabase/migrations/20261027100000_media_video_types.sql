begin;

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
    when 'video/x-m4v' then 'video'
    when 'video/quicktime' then 'video'
    when 'video/3gpp' then 'video'
    when 'video/3gpp2' then 'video'
    when 'video/webm' then 'video'
    when 'video/x-matroska' then 'video'
    when 'video/x-msvideo' then 'video'
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

commit;

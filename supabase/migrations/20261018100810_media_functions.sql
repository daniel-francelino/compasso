begin;

create function public.media_policy_mb(p_name text, p_default int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value ->> p_name)::int from public.organization_settings s where s.key = 'policies.uploads'),
    p_default
  )
$$;

create function public.media_version_in_use(p_version uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.media_usages u where u.media_version_id = p_version)
$$;

create function public.media_storage_used()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    perform public.assert_action('media.view');
  end if;
  return coalesce(
    (select sum(v.size_bytes + v.derivative_bytes)::bigint
     from public.media_versions v where v.status <> 'failed'),
    0
  );
end;
$$;

create function public.media_assert_asset_access(p_asset uuid)
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
  if v_asset.scope = 'brand' then
    perform public.assert_brand_access(v_asset.brand_id);
  elsif not public.has_action('site.view') then
    raise exception 'not_found';
  end if;
  return v_asset;
end;
$$;

create function public.media_request_upload(
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
  perform public.assert_action('media.upload');
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

  v_limit_mb := case v_kind
    when 'image' then public.media_policy_mb('maxImageMb', 25)
    when 'video' then public.media_policy_mb('maxVideoMb', 100)
    else public.media_policy_mb('maxDocumentMb', 50)
  end;
  if p_size > v_limit_mb::bigint * 1048576 then
    raise exception 'upload_too_large';
  end if;

  v_quota_mb := public.media_policy_mb('quotaMb', 5120);
  if public.media_storage_used() + p_size + 4194304 > v_quota_mb::bigint * 1048576 then
    raise exception 'quota_exceeded';
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
        and a.trashed_at is null and lower(a.display_name) = lower(v_name)
    ) loop
      v_n := v_n + 1;
      v_name := v_base || ' (' || v_n || ')' || v_ext;
    end loop;

    insert into public.media_assets (organization_id, scope, brand_id, display_name, created_by)
    values (v_org, v_scope, v_brand, v_name, v_actor)
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

create function public.media_confirm_upload(
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
  perform public.assert_action('media.upload');
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

create function public.media_mark_failed(p_version uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.media_upload_sessions;
  v_version public.media_versions;
  v_asset public.media_assets;
  v_keys jsonb;
  v_remaining int;
begin
  select * into v_session from public.media_upload_sessions s
  where s.version_id = p_version and s.author_id = auth.uid() for update;
  if not found or v_session.status <> 'open' then
    raise exception 'not_found';
  end if;
  select * into v_version from public.media_versions v where v.id = p_version;
  select * into v_asset from public.media_assets a where a.id = v_version.asset_id;
  v_keys := to_jsonb(array_remove(array[v_version.storage_key, v_version.thumb_key, v_version.display_key], null));

  update public.media_versions set status = 'failed', failure_reason = left(p_reason, 200) where id = p_version;
  update public.media_upload_sessions set status = 'failed' where id = v_session.id;

  select count(*) into v_remaining from public.media_versions v
  where v.asset_id = v_asset.id and v.status <> 'failed';
  if v_remaining = 0 and v_asset.current_version_id is null then
    delete from public.media_upload_sessions s where s.version_id in (
      select v.id from public.media_versions v where v.asset_id = v_asset.id
    );
    delete from public.media_versions where asset_id = v_asset.id;
    delete from public.media_assets where id = v_asset.id;
  end if;

  perform public.notify_users(
    'media.upload_failed', v_asset.brand_id, 'Falha no envio de arquivo',
    'Não foi possível validar «' || left(v_version.original_filename, 80) || '».',
    '/admin/library', 'media_version', p_version, 'media.upload_failed:' || p_version,
    array[auth.uid()]
  );
  return jsonb_build_object('keys', v_keys);
end;
$$;

create function public.media_update(p_asset jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_asset ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p_asset ->> 'display_name', ''));
  v_expected int := nullif(p_asset ->> 'expected_version', '')::int;
  v_tags text[] := array(
    select distinct lower(left(btrim(t), 40))
    from jsonb_array_elements_text(coalesce(p_asset -> 'tags', '[]'::jsonb)) t
    where btrim(t) <> ''
  );
  v_asset public.media_assets;
  v_version int;
begin
  perform public.assert_action('media.update');
  v_asset := public.media_assert_asset_access(v_id);
  if char_length(v_name) not between 1 and 200 or cardinality(v_tags) > 20 then
    raise exception 'invalid_input';
  end if;
  if v_expected is null or v_expected <> v_asset.version then
    raise exception 'conflict';
  end if;
  update public.media_assets
  set display_name = v_name, tags = v_tags, version = version + 1
  where id = v_id
  returning version into v_version;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.media_set_trashed(p_asset uuid, p_trashed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version int;
begin
  perform public.assert_action('media.delete');
  perform public.media_assert_asset_access(p_asset);
  update public.media_assets
  set trashed_at = case when p_trashed then now() else null end, version = version + 1
  where id = p_asset
  returning version into v_version;
  return jsonb_build_object('id', p_asset, 'version', v_version);
end;
$$;

create function public.media_delete_permanently(p_asset uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets;
  v_keys jsonb;
  v_versions int;
begin
  perform public.assert_action('media.delete');
  v_asset := public.media_assert_asset_access(p_asset);
  if v_asset.trashed_at is null then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1 from public.media_versions v
    where v.asset_id = p_asset and (public.media_version_in_use(v.id) or v.public_published_at is not null)
  ) then
    raise exception 'media_in_use';
  end if;

  select to_jsonb(coalesce(array_agg(k), '{}')), count(distinct v.id)
  into v_keys, v_versions
  from public.media_versions v
  cross join lateral unnest(array[v.storage_key, v.thumb_key, v.display_key]) as k
  where v.asset_id = p_asset and k is not null;

  begin
    update public.media_assets set current_version_id = null where id = p_asset;
    delete from public.media_upload_sessions s where s.version_id in (
      select v.id from public.media_versions v where v.asset_id = p_asset
    );
    delete from public.media_versions where asset_id = p_asset;
    delete from public.media_assets where id = p_asset;
  exception when foreign_key_violation then
    raise exception 'media_in_use';
  end;

  perform public.audit_write(v_asset.organization_id, v_asset.brand_id, 'media.deleted_permanently',
    'media_asset', p_asset, jsonb_build_object('versions', v_versions));
  return jsonb_build_object('keys', v_keys);
end;
$$;

create function public.media_replace_version(p_asset uuid, p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.media_assets;
  v_version public.media_versions;
  v_new int;
begin
  perform public.assert_action('media.update');
  perform public.assert_action('media.upload');
  v_asset := public.media_assert_asset_access(p_asset);
  select * into v_version from public.media_versions v where v.id = p_version and v.asset_id = p_asset;
  if not found or v_version.status <> 'available' or v_asset.current_version_id = p_version then
    raise exception 'conflict';
  end if;
  update public.media_assets
  set current_version_id = p_version, size_bytes = v_version.size_bytes, version = version + 1
  where id = p_asset
  returning version into v_new;
  perform public.audit_write(v_asset.organization_id, v_asset.brand_id, 'media.version_replaced',
    'media_asset', p_asset, jsonb_build_object('version_no', v_version.version_no));
  return jsonb_build_object('id', p_asset, 'version', v_new);
end;
$$;

create function public.media_collection_save(p_collection jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_collection ->> 'id', '')::uuid;
  v_scope text := p_collection ->> 'scope';
  v_brand uuid := nullif(p_collection ->> 'brand_id', '')::uuid;
  v_parent uuid := nullif(p_collection ->> 'parent_id', '')::uuid;
  v_name text := btrim(coalesce(p_collection ->> 'name', ''));
  v_current public.media_collections;
begin
  perform public.assert_action('media.update');
  if char_length(v_name) not between 1 and 80 then
    raise exception 'invalid_input';
  end if;

  if v_id is not null then
    select * into v_current from public.media_collections c where c.id = v_id;
    if not found then
      raise exception 'not_found';
    end if;
    v_scope := v_current.scope;
    v_brand := v_current.brand_id;
  end if;

  if v_scope = 'brand' then
    perform public.assert_brand_access(v_brand);
  elsif v_scope = 'site' then
    perform public.assert_action('site.view');
    v_brand := null;
  else
    raise exception 'invalid_input';
  end if;

  begin
    if v_id is null then
      insert into public.media_collections (organization_id, scope, brand_id, parent_id, name)
      values (public.current_organization_id(), v_scope, v_brand, v_parent, v_name)
      returning id into v_id;
    else
      update public.media_collections
      set name = v_name, parent_id = coalesce(v_parent, parent_id)
      where id = v_id;
    end if;
  exception when unique_violation then
    raise exception 'invalid_input';
  end;
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.media_collection_delete(p_collection uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.media_collections;
begin
  perform public.assert_action('media.delete');
  select * into v_collection from public.media_collections c where c.id = p_collection;
  if not found then
    raise exception 'not_found';
  end if;
  if v_collection.scope = 'brand' then
    perform public.assert_brand_access(v_collection.brand_id);
  else
    perform public.assert_action('site.view');
  end if;
  if exists (select 1 from public.media_collection_items i where i.collection_id = p_collection)
     or exists (select 1 from public.media_collections c where c.parent_id = p_collection) then
    raise exception 'invalid_input';
  end if;
  delete from public.media_collections where id = p_collection;
end;
$$;

create function public.media_collection_move_items(p_collection uuid, p_assets uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_collection public.media_collections;
begin
  perform public.assert_action('media.update');
  if cardinality(p_assets) not between 1 and 200 then
    raise exception 'invalid_input';
  end if;
  if p_collection is not null then
    select * into v_collection from public.media_collections c where c.id = p_collection;
    if not found then
      raise exception 'not_found';
    end if;
    if v_collection.scope = 'brand' then
      perform public.assert_brand_access(v_collection.brand_id);
    else
      perform public.assert_action('site.view');
    end if;
    if exists (
      select 1 from public.media_assets a
      where a.id = any (p_assets)
        and (a.scope <> v_collection.scope or a.brand_id is distinct from v_collection.brand_id)
    ) or (
      select count(*) from public.media_assets a where a.id = any (p_assets)
    ) <> cardinality(p_assets) then
      raise exception 'invalid_input';
    end if;
  end if;

  delete from public.media_collection_items i
  where i.asset_id = any (p_assets)
    and exists (select 1 from public.media_assets a where a.id = i.asset_id and public.can_view_media_asset(a.id));
  if p_collection is not null then
    insert into public.media_collection_items (collection_id, asset_id)
    select p_collection, a from unnest(p_assets) a
    on conflict do nothing;
  end if;
end;
$$;

create function public.can_view_media_asset(p_asset uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media_assets a
    where a.id = p_asset
      and public.has_action('media.view')
      and (
        (a.scope = 'brand' and public.can_access_brand(a.brand_id))
        or (a.scope = 'site' and public.has_action('site.view'))
      )
  )
$$;

create function public.media_expire_sessions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[] := '{}';
  v_row record;
begin
  for v_row in
    select s.id as session_id, v.id as version_id, v.asset_id, v.storage_key, v.thumb_key, v.display_key,
           a.current_version_id
    from public.media_upload_sessions s
    join public.media_versions v on v.id = s.version_id
    join public.media_assets a on a.id = v.asset_id
    where s.status = 'open' and s.expires_at <= now()
    for update of s
  loop
    v_keys := v_keys || array_remove(array[v_row.storage_key, v_row.thumb_key, v_row.display_key], null);
    update public.media_upload_sessions set status = 'expired' where id = v_row.session_id;
    update public.media_versions set status = 'failed', failure_reason = 'expired' where id = v_row.version_id;
    if v_row.current_version_id is null and not exists (
      select 1 from public.media_versions v2 where v2.asset_id = v_row.asset_id and v2.status <> 'failed'
    ) then
      delete from public.media_upload_sessions s where s.version_id in (
        select v3.id from public.media_versions v3 where v3.asset_id = v_row.asset_id
      );
      delete from public.media_versions where asset_id = v_row.asset_id;
      delete from public.media_assets where id = v_row.asset_id;
    end if;
  end loop;
  return jsonb_build_object('keys', to_jsonb(v_keys));
end;
$$;

revoke execute on function public.media_policy_mb(text, int), public.media_version_in_use(uuid),
  public.media_storage_used(), public.media_assert_asset_access(uuid),
  public.media_request_upload(text, uuid, text, bigint, text, text, uuid),
  public.media_confirm_upload(uuid, text, int, int, int, bigint),
  public.media_mark_failed(uuid, text), public.media_update(jsonb),
  public.media_set_trashed(uuid, boolean), public.media_delete_permanently(uuid),
  public.media_replace_version(uuid, uuid), public.media_collection_save(jsonb),
  public.media_collection_delete(uuid), public.media_collection_move_items(uuid, uuid[]),
  public.can_view_media_asset(uuid), public.media_expire_sessions()
  from public, anon;

grant execute on function public.media_storage_used(),
  public.media_request_upload(text, uuid, text, bigint, text, text, uuid),
  public.media_confirm_upload(uuid, text, int, int, int, bigint),
  public.media_mark_failed(uuid, text), public.media_update(jsonb),
  public.media_set_trashed(uuid, boolean), public.media_delete_permanently(uuid),
  public.media_replace_version(uuid, uuid), public.media_collection_save(jsonb),
  public.media_collection_delete(uuid), public.media_collection_move_items(uuid, uuid[])
  to authenticated;

revoke execute on function public.media_policy_mb(text, int), public.media_version_in_use(uuid),
  public.media_assert_asset_access(uuid), public.can_view_media_asset(uuid),
  public.media_expire_sessions() from authenticated;

commit;

begin;

alter table public.media_assets add column hidden boolean not null default false;

drop function public.media_request_upload(text, uuid, text, bigint, text, text, uuid);

create function public.media_request_upload(
  p_scope text,
  p_brand uuid,
  p_filename text,
  p_size bigint,
  p_mime text,
  p_idempotency_key text,
  p_asset uuid default null,
  p_hidden boolean default false
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
  if p_hidden is null or (p_hidden and (p_scope is distinct from 'brand' or p_asset is not null)) then
    raise exception 'invalid_input';
  end if;
  if p_hidden then
    perform public.assert_action('design.update');
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

    insert into public.media_assets (organization_id, scope, brand_id, owner_id, display_name, created_by, hidden)
    values (v_org, v_scope, v_brand, v_owner, v_name, v_actor, p_hidden)
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

revoke execute on function
  public.media_request_upload(text, uuid, text, bigint, text, text, uuid, boolean)
from public, anon;
grant execute on function
  public.media_request_upload(text, uuid, text, bigint, text, text, uuid, boolean)
to authenticated;

create or replace function public.design_upgrade_document(p_document jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with v2 as (
    select case
      when p_document -> 'version' = '1'::jsonb then jsonb_build_object(
        'version', 2,
        'pages', jsonb_build_array(jsonb_build_object(
          'id', 'page-1',
          'background', coalesce(p_document -> 'background', 'null'::jsonb),
          'elements', coalesce(p_document -> 'elements', '[]'::jsonb)
        ))
      )
      else p_document
    end as doc
  )
  select case
    when doc -> 'version' = '2'::jsonb then jsonb_build_object(
      'version', 3,
      'pages', coalesce((
        select jsonb_agg(
          p.page || jsonb_build_object('elements', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'blendMode', 'normal', 'fillOpacity', 1, 'hidden', false, 'name', '',
                'parentId', null, 'clipToBelow', false, 'mask', null
              ) || e.element
              order by e.position
            )
            from jsonb_array_elements(p.page -> 'elements') with ordinality as e (element, position)
          ), '[]'::jsonb))
          order by p.position
        )
        from jsonb_array_elements(doc -> 'pages') with ordinality as p (page, position)
      ), '[]'::jsonb)
    )
    else doc
  end
  from v2
$$;

update public.designs
set draft_document = public.design_upgrade_document(draft_document)
where draft_document -> 'version' in ('1'::jsonb, '2'::jsonb);

create function public.design_assert_media(p_media jsonb, p_brand uuid, p_mime text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_media text;
begin
  if p_media is null or jsonb_typeof(p_media) <> 'string' then
    raise exception 'invalid_input';
  end if;
  v_media := p_media #>> '{}';
  if v_media !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists (
       select 1
       from public.media_versions mv
       join public.media_assets ma on ma.id = mv.asset_id
       where mv.id = v_media::uuid and ma.brand_id = p_brand and mv.mime_type like p_mime
     ) then
    raise exception 'invalid_input';
  end if;
end;
$$;

create or replace function public.design_assert_document(p_document jsonb, p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_version int;
  v_page jsonb;
  v_element jsonb;
  v_kind text;
  v_kinds text[];
  v_blends constant text[] := array[
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
    'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
  ];
  v_adjustments constant text[] := array[
    'brightness_contrast', 'levels', 'curves', 'hue_saturation', 'color_balance', 'black_white',
    'invert', 'threshold'
  ];
  v_key text;
  v_groups text[];
  v_parents jsonb;
  v_current text;
  v_depth int;
  v_mask jsonb;
  v_number numeric;
  v_total int := 0;
  v_max int;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
     or p_document -> 'version' not in ('2'::jsonb, '3'::jsonb)
     or coalesce(jsonb_typeof(p_document -> 'pages'), 'missing') <> 'array'
     or jsonb_array_length(p_document -> 'pages') < 1 then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_document::text) > 262144 or jsonb_array_length(p_document -> 'pages') > 10 then
    raise exception 'design_too_large';
  end if;
  v_version := (p_document ->> 'version')::int;
  v_max := case v_version when 2 then 100 else 200 end;
  v_kinds := case v_version
    when 2 then array['text', 'image', 'rect', 'ellipse', 'line']
    else array['text', 'image', 'rect', 'ellipse', 'line', 'raster', 'adjustment', 'group']
  end;

  for v_page in select p from jsonb_array_elements(p_document -> 'pages') p loop
    if jsonb_typeof(v_page) <> 'object'
       or coalesce(jsonb_typeof(v_page -> 'id'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(v_page -> 'elements'), 'missing') <> 'array'
       or coalesce(jsonb_typeof(v_page -> 'background'), 'missing') not in ('string', 'null') then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_page -> 'background') = 'string'
       and (v_page ->> 'background') !~ '^#[0-9a-f]{6}$' then
      raise exception 'invalid_input';
    end if;
    foreach v_key in array array['width', 'height'] loop
      continue when not (v_page ? v_key);
      if v_version < 3 or jsonb_typeof(v_page -> v_key) <> 'number' then
        raise exception 'invalid_input';
      end if;
      v_number := (v_page ->> v_key)::numeric;
      if v_number <> trunc(v_number) or v_number not between 64 and 4096 then
        raise exception 'invalid_input';
      end if;
    end loop;
    v_total := v_total + jsonb_array_length(v_page -> 'elements');
    if v_total > v_max then
      raise exception 'design_too_large';
    end if;

    for v_element in select e from jsonb_array_elements(v_page -> 'elements') e loop
      if jsonb_typeof(v_element) <> 'object'
         or coalesce(jsonb_typeof(v_element -> 'id'), 'missing') <> 'string'
         or not (coalesce(v_element ->> 'kind', '') = any (v_kinds)) then
        raise exception 'invalid_input';
      end if;
    end loop;

    select coalesce(array_agg(e ->> 'id') filter (where e ->> 'kind' = 'group'), '{}'),
           coalesce(jsonb_object_agg(e ->> 'id', coalesce(e -> 'parentId', 'null'::jsonb)), '{}'::jsonb)
    into v_groups, v_parents
    from jsonb_array_elements(v_page -> 'elements') e;

    for v_element in select e from jsonb_array_elements(v_page -> 'elements') e loop
      v_kind := v_element ->> 'kind';
      if v_kind = 'image' then
        perform public.design_assert_media(v_element -> 'mediaVersionId', p_brand, 'image/%');
      end if;
      continue when v_version < 3;

      if v_element ? 'blendMode'
         and (jsonb_typeof(v_element -> 'blendMode') <> 'string'
              or not ((v_element ->> 'blendMode') = any (v_blends))) then
        raise exception 'invalid_input';
      end if;
      if v_element ? 'fillOpacity'
         and (jsonb_typeof(v_element -> 'fillOpacity') <> 'number'
              or (v_element ->> 'fillOpacity')::numeric not between 0 and 1) then
        raise exception 'invalid_input';
      end if;
      if v_element ? 'name'
         and (jsonb_typeof(v_element -> 'name') <> 'string'
              or char_length(v_element ->> 'name') > 80) then
        raise exception 'invalid_input';
      end if;
      foreach v_key in array array['hidden', 'clipToBelow'] loop
        if v_element ? v_key and jsonb_typeof(v_element -> v_key) <> 'boolean' then
          raise exception 'invalid_input';
        end if;
      end loop;

      if coalesce(jsonb_typeof(v_element -> 'parentId'), 'null') not in ('string', 'null') then
        raise exception 'invalid_input';
      end if;
      v_current := v_element ->> 'parentId';
      v_depth := 0;
      while v_current is not null loop
        v_depth := v_depth + 1;
        if v_current = v_element ->> 'id' or v_depth > 8 or not (v_current = any (v_groups)) then
          raise exception 'invalid_input';
        end if;
        v_current := case jsonb_typeof(v_parents -> v_current)
          when 'string' then v_parents ->> v_current
          else null
        end;
      end loop;

      v_mask := coalesce(v_element -> 'mask', 'null'::jsonb);
      if jsonb_typeof(v_mask) <> 'null' then
        if jsonb_typeof(v_mask) <> 'object'
           or coalesce(jsonb_typeof(v_mask -> 'enabled'), 'boolean') <> 'boolean'
           or coalesce(jsonb_typeof(v_mask -> 'linked'), 'boolean') <> 'boolean' then
          raise exception 'invalid_input';
        end if;
        if coalesce(jsonb_typeof(v_mask -> 'mediaVersionId'), 'null') <> 'null' then
          perform public.design_assert_media(v_mask -> 'mediaVersionId', p_brand, 'image/png');
        end if;
      end if;

      if v_kind = 'raster' then
        if coalesce(jsonb_typeof(v_element -> 'pixelsVersionId'), 'null') <> 'null' then
          perform public.design_assert_media(v_element -> 'pixelsVersionId', p_brand, 'image/png');
        end if;
        foreach v_key in array array['pixelWidth', 'pixelHeight'] loop
          if coalesce(jsonb_typeof(v_element -> v_key), 'missing') <> 'number' then
            raise exception 'invalid_input';
          end if;
          v_number := (v_element ->> v_key)::numeric;
          if v_number <> trunc(v_number) or v_number not between 1 and 4096 then
            raise exception 'invalid_input';
          end if;
        end loop;
      elsif v_kind = 'adjustment' then
        if coalesce(jsonb_typeof(v_element -> 'adjustment'), 'missing') <> 'object'
           or not (coalesce(v_element -> 'adjustment' ->> 'type', '') = any (v_adjustments)) then
          raise exception 'invalid_input';
        end if;
      elsif v_kind = 'group' then
        foreach v_key in array array['collapsed', 'passThrough'] loop
          if v_element ? v_key and jsonb_typeof(v_element -> v_key) <> 'boolean' then
            raise exception 'invalid_input';
          end if;
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function public.design_save_version(p_design uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_document jsonb;
  v_no int;
  v_version_id uuid;
  v_version int;
begin
  perform public.assert_action('design.update');
  v_row := public.design_lock(p_design, p_expected_version);
  v_no := v_row.current_version_no + 1;
  v_document := public.design_upgrade_document(v_row.draft_document);
  perform public.design_assert_document(v_document, v_row.brand_id);

  insert into public.design_versions (design_id, brand_id, version_no, document, created_by)
  values (v_row.id, v_row.brand_id, v_no, v_document, auth.uid())
  returning id into v_version_id;

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
  select distinct mv.id, 'design_version', v_version_id
  from (
    select e ->> 'mediaVersionId' as ref
    from jsonb_array_elements(v_document -> 'pages') p, jsonb_array_elements(p -> 'elements') e
    where e ->> 'kind' = 'image'
    union
    select e ->> 'pixelsVersionId'
    from jsonb_array_elements(v_document -> 'pages') p, jsonb_array_elements(p -> 'elements') e
    where e ->> 'kind' = 'raster'
    union
    select e #>> '{mask,mediaVersionId}'
    from jsonb_array_elements(v_document -> 'pages') p, jsonb_array_elements(p -> 'elements') e
    where jsonb_typeof(e -> 'mask') = 'object'
  ) refs
  join public.media_versions mv on mv.id::text = refs.ref
  join public.media_assets ma on ma.id = mv.asset_id and ma.brand_id = v_row.brand_id
  on conflict do nothing;

  update public.designs
  set current_version_no = v_no, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.version_saved', 'design', v_row.id, jsonb_build_object('version_no', v_no));
  return jsonb_build_object('version', v_version, 'version_no', v_no);
end;
$$;

revoke execute on function public.design_upgrade_document(jsonb), public.design_assert_media(jsonb, uuid, text)
  from public, anon, authenticated;

commit;

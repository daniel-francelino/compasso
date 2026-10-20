begin;

create or replace function public.publish_content(p_item uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_version int;
  v_queued int;
begin
  perform public.assert_action('content.publish_manual');
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if v_item.version <> p_expected_version then
    raise exception 'conflict';
  end if;
  if v_item.cancelled_at is not null or v_item.editorial_status <> 'approved'
    or v_item.approved_revision_id is null then
    raise exception 'not_approved';
  end if;
  if exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status not in ('published_manually', 'cancelled')
  ) or not exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status = 'published_manually'
  ) then
    raise exception 'channels_not_published';
  end if;

  update public.content_items
  set editorial_status = 'published', version = version + 1
  where id = p_item
  returning version into v_version;

  with item_revisions as (
    select r.id from public.content_revisions r where r.item_id = p_item
  ),
  mine as (
    select m.media_version_id as version_id
    from public.content_revision_media m
    join item_revisions r on r.id = m.revision_id
    union
    select (e ->> 'media_version_id')::uuid
    from jsonb_array_elements(coalesce(v_item.working_media, '[]'::jsonb)) e
    union
    select (e ->> 'media_version_id')::uuid
    from jsonb_array_elements(coalesce(v_item.plan_media, '[]'::jsonb)) e
  ),
  kept as (
    select m.media_version_id as version_id
    from public.content_revision_media m
    where m.revision_id = v_item.approved_revision_id
  ),
  queued as (
    update public.media_versions v
    set purge_requested_at = now(),
        purge_keep_preview = exists (select 1 from kept k where k.version_id = v.id)
    where v.id in (select version_id from mine)
      and v.original_purged_at is null
      and v.purge_requested_at is null
      and v.status = 'available'
      and v.mime_type not like 'video/%'
      and v.public_published_at is null
      and (v.display_key is not null
        or not exists (select 1 from kept k where k.version_id = v.id))
      and not exists (
        select 1 from public.media_usages u
        where u.media_version_id = v.id
          and not (u.usage_type = 'content_revision'
            and u.usage_ref_id in (select id from item_revisions))
      )
      and not exists (
        select 1 from public.organizations o where o.logo_media_version_id = v.id
      )
      and not exists (
        select 1 from public.content_items o
        where o.id <> p_item
          and (o.working_media @> jsonb_build_array(jsonb_build_object('media_version_id', v.id))
            or o.plan_media @> jsonb_build_array(jsonb_build_object('media_version_id', v.id)))
      )
    returning v.id
  )
  select count(*) into v_queued from queued;

  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.published', 'content_item', p_item,
    jsonb_build_object('revision_id', v_item.approved_revision_id, 'purge_queued', v_queued)
  );
  return jsonb_build_object('id', p_item, 'version', v_version, 'queued', v_queued);
end;
$$;

create or replace function public.portal_media_urls(p_revision uuid, p_version_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select r.brand_id into v_brand from public.content_revisions r
  where r.id = p_revision and exists (select 1 from public.approval_requests q where q.revision_id = r.id);
  if v_brand is null or not public.is_external_brand_member(v_brand) then
    raise exception 'not_found';
  end if;
  if p_version_ids is null or cardinality(p_version_ids) = 0 or cardinality(p_version_ids) > 20 then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1 from unnest(p_version_ids) id
    where not exists (
      select 1 from public.content_revision_media m
      where m.revision_id = p_revision and m.media_version_id = id
    )
  ) then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'version_id', mv.id,
          'storage_key', case when mv.original_purged_at is null then mv.storage_key end,
          'thumb_key', mv.thumb_key,
          'display_key', mv.display_key, 'mime_type', mv.mime_type, 'name', mv.original_filename
        )
      )
      from public.media_versions mv
      where mv.id = any (p_version_ids)
    ),
    '[]'::jsonb
  );
end;
$$;

commit;

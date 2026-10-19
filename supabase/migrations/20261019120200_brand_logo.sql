begin;

alter table public.brands
  add column logo_media_version_id uuid references public.media_versions (id);

create index brands_logo_idx on public.brands (logo_media_version_id)
  where logo_media_version_id is not null;

create function public.brand_set_logo(p_brand uuid, p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
  v_version int;
begin
  perform public.assert_action('brands.update');
  perform public.assert_brand_access(p_brand);
  select b.logo_media_version_id into v_old from public.brands b where b.id = p_brand for update;

  if p_version is not null and not exists (
    select 1
    from public.media_versions v
    join public.media_assets a on a.id = v.asset_id
    where v.id = p_version
      and a.scope = 'brand'
      and a.brand_id = p_brand
      and a.trashed_at is null
      and v.status = 'available'
      and v.mime_type like 'image/%'
      and v.mime_type <> 'image/svg+xml'
  ) then
    raise exception 'logo_invalid';
  end if;

  if v_old is not null and v_old is distinct from p_version then
    delete from public.media_usages
    where media_version_id = v_old and usage_type = 'brand_identity' and usage_ref_id = p_brand;
  end if;
  if p_version is not null then
    insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
    values (p_version, 'brand_identity', p_brand)
    on conflict do nothing;
  end if;

  update public.brands
  set logo_media_version_id = p_version, version = version + 1
  where id = p_brand
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), p_brand, 'brand.updated', 'brand',
    p_brand, '{}'::jsonb);
  return jsonb_build_object('id', p_brand, 'version', v_version);
end;
$$;

create function public.brand_logo_keys(p_brands uuid[])
returns table (brand_id uuid, thumb_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, v.thumb_key
  from public.brands b
  join public.media_versions v on v.id = b.logo_media_version_id
  where b.id = any (p_brands)
    and public.has_action('brands.view')
    and public.can_access_brand(b.id)
    and v.thumb_key is not null
$$;

revoke execute on function public.brand_set_logo(uuid, uuid) from public, anon;
revoke execute on function public.brand_logo_keys(uuid[]) from public, anon;
grant execute on function public.brand_set_logo(uuid, uuid) to authenticated;
grant execute on function public.brand_logo_keys(uuid[]) to authenticated;

commit;

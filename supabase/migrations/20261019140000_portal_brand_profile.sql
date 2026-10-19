begin;

create or replace function public.portal_list_brands()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'client_name', c.name,
          'pending_count', (
            select count(*)::int from public.approval_requests q
            where q.brand_id = b.id and q.status = 'pending' and q.approver_user_id = auth.uid()
          )
        )
        order by b.name
      )
      from public.brands b
      join public.clients c on c.id = b.client_id
      where b.archived_at is null and public.is_external_brand_member(b.id)
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.portal_get_brand(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.portal_assert_member(p_brand);
  select jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'client_name', c.name,
    'description', b.description,
    'target_audience', b.target_audience,
    'tone_of_voice', b.tone_of_voice,
    'objectives', b.objectives,
    'timezone', b.timezone,
    'channels', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'platform', ch.platform,
            'profile_name', ch.profile_name,
            'profile_url', ch.profile_url
          )
          order by ch.platform, lower(ch.profile_name)
        )
        from public.channels ch
        where ch.brand_id = b.id and ch.archived_at is null
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.brands b
  join public.clients c on c.id = b.client_id
  where b.id = p_brand and b.archived_at is null;
  if v_result is null then
    raise exception 'not_found';
  end if;
  return v_result;
end;
$$;

create function public.portal_brand_logo_keys(p_brands uuid[])
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
    and public.has_action('portal.view')
    and public.is_external_brand_member(b.id)
    and v.thumb_key is not null
$$;

revoke execute on function public.portal_get_brand(uuid),
  public.portal_brand_logo_keys(uuid[]) from public, anon;
grant execute on function public.portal_get_brand(uuid),
  public.portal_brand_logo_keys(uuid[]) to authenticated;

commit;

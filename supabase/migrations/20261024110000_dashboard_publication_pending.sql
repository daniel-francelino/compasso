begin;

create function public.dashboard_publication_pending(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.publish_manual');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'item_id', x.item_id,
          'title', x.title,
          'brand_id', x.brand_id,
          'brand_name', x.brand_name,
          'pending_rows', x.pending_rows,
          'oldest_planned_at', x.oldest,
          'channels', x.channels
        )
        order by x.oldest, x.title
      )
      from (
        select
          i.id as item_id, i.title, b.id as brand_id, b.name as brand_name,
          count(r.id)::int as pending_rows,
          min(r.planned_at) as oldest,
          array_agg(distinct c.profile_name order by c.profile_name) as channels
        from public.content_items i
        join public.brands b on b.id = i.brand_id
        join public.content_channels r
          on r.content_item_id = i.id
          and r.publication_status = 'planned'
          and r.planned_at < now()
        join public.channels c on c.id = r.channel_id
        where i.cancelled_at is null
          and i.editorial_status = 'approved'
          and public.can_access_brand(i.brand_id)
          and (p_brands is null or i.brand_id = any (p_brands))
        group by i.id, i.title, b.id, b.name
        order by min(r.planned_at), i.title
        limit 50
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.dashboard_publication_pending(uuid[]) from public, anon;
grant execute on function public.dashboard_publication_pending(uuid[]) to authenticated;

commit;

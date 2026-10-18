begin;

create function public.dashboard_attention(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_approvals boolean;
begin
  if not (public.has_action('content.view') or public.has_action('approvals.view')) then
    raise exception 'denied';
  end if;
  v_approvals := public.has_action('approvals.view');

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'variant_id', att.variant_id, 'item_id', att.item_id, 'title', att.title,
          'brand_id', att.brand_id, 'brand_name', att.brand_name, 'channel', att.channel,
          'reasons', to_jsonb(att.reasons)
        )
        order by cardinality(att.reasons) desc, att.title
      )
      from (
        select
          v.id as variant_id, i.id as item_id, i.title, b.id as brand_id, b.name as brand_name,
          c.profile_name as channel,
          array_remove(
            array[
              case when v_approvals and exists (
                select 1 from public.approval_requests q
                where q.variant_id = v.id and q.status = 'pending' and q.due_date is not null
                  and q.due_date < (now() at time zone b.timezone)::date
              ) then 'approval_overdue' end,
              case when v.editorial_status = 'changes_requested' then 'changes_requested' end,
              case when i.production_due_date is not null
                and i.production_due_date < (now() at time zone b.timezone)::date
                and v.editorial_status <> 'approved' then 'production_overdue' end,
              case when v.publication_status = 'planned' and v.planned_at < now()
                then 'planned_date_passed' end,
              case when v_approvals and exists (
                select 1 from public.approval_requests q
                where q.variant_id = v.id and q.status = 'pending'
                  and not public.approver_is_valid(q.brand_id, q.approver_user_id)
              ) then 'approver_without_access' end
            ],
            null
          ) as reasons
        from public.content_variants v
        join public.content_items i on i.id = v.content_item_id
        join public.brands b on b.id = v.brand_id
        join public.channels c on c.id = v.channel_id
        where v.editorial_status <> 'cancelled' and i.cancelled_at is null
          and public.can_access_brand(v.brand_id)
          and (p_brands is null or v.brand_id = any (p_brands))
      ) att
      where cardinality(att.reasons) > 0
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.dashboard_status_counts(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.view');
  return coalesce(
    (
      select jsonb_object_agg(counted.status, counted.total)
      from (
        select v.editorial_status as status, count(*)::int as total
        from public.content_variants v
        join public.content_items i on i.id = v.content_item_id
        where i.cancelled_at is null and public.can_access_brand(v.brand_id)
          and (p_brands is null or v.brand_id = any (p_brands))
        group by v.editorial_status
      ) counted
    ),
    '{}'::jsonb
  );
end;
$$;

create function public.dashboard_my_items()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.view');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'item_id', mine.id, 'title', mine.title, 'brand_id', mine.brand_id,
          'brand_name', mine.brand_name, 'production_due_date', mine.production_due_date,
          'open_variants', mine.open_variants
        )
        order by mine.production_due_date nulls last, mine.title
      )
      from (
        select i.id, i.title, i.brand_id, b.name as brand_name, i.production_due_date,
          (
            select count(*)::int from public.content_variants v
            where v.content_item_id = i.id and v.editorial_status not in ('approved', 'cancelled')
          ) as open_variants
        from public.content_items i
        join public.brands b on b.id = i.brand_id
        where i.assignee_id = auth.uid() and i.cancelled_at is null
          and public.can_access_brand(i.brand_id)
        order by i.production_due_date nulls last, i.title
        limit 20
      ) mine
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.dashboard_attention(uuid[]), public.dashboard_status_counts(uuid[]),
  public.dashboard_my_items() from public, anon;
grant execute on function public.dashboard_attention(uuid[]), public.dashboard_status_counts(uuid[]),
  public.dashboard_my_items() to authenticated;

commit;

begin;

create or replace function public.portal_list_approvals(
  p_brand uuid,
  p_status text,
  p_page int,
  p_page_size int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_offset int := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  v_total int;
begin
  perform public.portal_assert_member(p_brand);
  if p_status is not null and p_status not in ('pending', 'approved', 'changes_requested', 'superseded') then
    raise exception 'invalid_input';
  end if;

  select count(*)::int into v_total
  from public.approval_requests q
  where q.brand_id = p_brand
    and q.status <> 'cancelled'
    and (p_status is null or q.status = p_status)
    and q.id = (
      select l.id
      from public.approval_requests l
      where l.item_id = q.item_id and l.status <> 'cancelled'
      order by (l.status = 'pending') desc,
        (select r.revision_no from public.content_revisions r where r.id = l.revision_id) desc,
        l.requested_at desc
      limit 1
    );

  return jsonb_build_object(
    'total', v_total,
    'rows', coalesce(
      (
        select jsonb_agg(
          public.portal_request_row(page.q)
            || jsonb_build_object(
              'comment_count', page.comment_count,
              'decision_comment', page.decision_comment
            )
          order by page.ord
        )
        from (
          select
            q,
            (
              select count(*)::int
              from public.comments c
              where c.item_id = q.item_id and c.visibility = 'external' and c.deleted_at is null
            ) as comment_count,
            (
              select d.comment
              from public.approval_decisions d
              where d.request_id = q.id and q.status = 'changes_requested'
            ) as decision_comment,
            row_number() over (
              order by coalesce(k.planned, q.requested_at) desc, q.requested_at desc, q.id
            ) as ord
          from public.approval_requests q
          left join lateral (
            select max((c.value ->> 'planned_at')::timestamptz) as planned
            from public.content_revisions r,
              jsonb_array_elements(coalesce(r.snapshot -> 'channels', '[]'::jsonb)) as c (value)
            where r.id = q.revision_id
          ) k on true
          where q.brand_id = p_brand
            and q.status <> 'cancelled'
            and (p_status is null or q.status = p_status)
            and q.id = (
              select l.id
              from public.approval_requests l
              where l.item_id = q.item_id and l.status <> 'cancelled'
              order by (l.status = 'pending') desc,
        (select r.revision_no from public.content_revisions r where r.id = l.revision_id) desc,
        l.requested_at desc
              limit 1
            )
          order by coalesce(k.planned, q.requested_at) desc, q.requested_at desc, q.id
          limit v_size offset v_offset
        ) page
      ),
      '[]'::jsonb
    )
  );
end;
$$;

commit;

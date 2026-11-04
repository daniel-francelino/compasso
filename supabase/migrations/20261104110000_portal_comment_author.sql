begin;

create or replace function public.portal_list_comments(p_item uuid)
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
  select i.brand_id into v_brand from public.content_items i where i.id = p_item;
  if v_brand is null or not public.is_external_brand_member(v_brand)
    or not exists (select 1 from public.approval_requests q where q.item_id = p_item) then
    raise exception 'not_found';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'body', c.body, 'created_at', c.created_at, 'author_name', p.full_name,
          'author_id', c.author_id,
          'mine', c.author_id = auth.uid(), 'from_team', p.kind = 'internal',
          'revision_no', r.revision_no
        )
        order by c.created_at
      )
      from public.comments c
      join public.profiles p on p.id = c.author_id
      left join public.content_revisions r on r.id = c.revision_id
      where c.item_id = p_item and c.visibility = 'external' and c.deleted_at is null
    ),
    '[]'::jsonb
  );
end;
$$;

commit;

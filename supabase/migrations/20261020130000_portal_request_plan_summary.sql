begin;

create or replace function public.portal_request_row(p_request public.approval_requests)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', q.id,
    'item_id', q.item_id,
    'revision_id', r.id,
    'stage', q.stage,
    'status', q.status,
    'title', r.snapshot ->> 'title',
    'objective_kind', r.snapshot ->> 'objective_kind',
    'plan_summary', r.snapshot ->> 'plan_summary',
    'channels', coalesce(r.snapshot -> 'channels', '[]'::jsonb),
    'brand_timezone', r.snapshot ->> 'brand_timezone',
    'revision_no', r.revision_no,
    'due_date', q.due_date,
    'requested_at', q.requested_at,
    'decided_at', q.decided_at,
    'can_decide', q.status = 'pending'
      and i.current_revision_id = r.id
      and public.has_action('approvals.decide')
      and public.approver_is_valid(q.brand_id, auth.uid()),
    'decided_by_name', (
      select p.full_name
      from public.approval_decisions d
      join public.profiles p on p.id = d.decided_by
      where d.request_id = q.id
    ),
    'media', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'version_id', m.media_version_id,
            'position', m.position,
            'alt_text', m.alt_text,
            'mime_type', mv.mime_type,
            'width', mv.width,
            'height', mv.height,
            'name', mv.original_filename,
            'has_thumb', mv.thumb_key is not null,
            'has_display', mv.display_key is not null
          )
          order by m.position
        )
        from public.content_revision_media m
        join public.media_versions mv on mv.id = m.media_version_id
        where m.revision_id = r.id
      ),
      '[]'::jsonb
    )
  )
  from public.approval_requests q
  join public.content_revisions r on r.id = q.revision_id and r.item_id = q.item_id and r.brand_id = q.brand_id
  join public.content_items i on i.id = q.item_id and i.brand_id = q.brand_id
  where q.id = p_request.id
    and q.revision_id = p_request.revision_id
    and q.brand_id = p_request.brand_id
    and public.has_action('portal.view')
    and public.is_external_brand_member(q.brand_id)
$$;


commit;

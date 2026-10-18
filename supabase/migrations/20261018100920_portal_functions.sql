begin;

create function public.portal_assert_member(p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  if p_brand is null or not public.is_external_brand_member(p_brand) then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.portal_request_row(p_request public.approval_requests)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_request.id,
    'variant_id', p_request.variant_id,
    'status', p_request.status,
    'title', r.snapshot ->> 'title',
    'format', r.snapshot ->> 'format',
    'platform', r.snapshot -> 'channel' ->> 'platform',
    'profile_name', r.snapshot -> 'channel' ->> 'profile_name',
    'planned_at', r.snapshot ->> 'planned_at',
    'planned_timezone', r.snapshot ->> 'planned_timezone',
    'brand_timezone', r.snapshot ->> 'brand_timezone',
    'revision_no', r.revision_no,
    'due_date', p_request.due_date,
    'requested_at', p_request.requested_at,
    'decided_at', p_request.decided_at,
    'is_mine', p_request.approver_user_id = auth.uid(),
    'approver_name', (select p.full_name from public.profiles p where p.id = p_request.approver_user_id)
  )
  from public.content_revisions r
  where r.id = p_request.revision_id
$$;

create function public.portal_list_brands()
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
          'pending_count', (
            select count(*)::int from public.approval_requests q
            where q.brand_id = b.id and q.status = 'pending' and q.approver_user_id = auth.uid()
          )
        )
        order by b.name
      )
      from public.brands b
      where b.archived_at is null and public.is_external_brand_member(b.id)
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.portal_list_pending(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.portal_assert_member(p_brand);
  return coalesce(
    (
      select jsonb_agg(public.portal_request_row(q) order by q.approver_user_id <> auth.uid(), q.due_date nulls last, q.requested_at)
      from public.approval_requests q
      where q.brand_id = p_brand and q.status = 'pending'
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.portal_list_approvals(
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
  where q.brand_id = p_brand and q.status <> 'cancelled' and (p_status is null or q.status = p_status);
  return jsonb_build_object(
    'total', v_total,
    'rows', coalesce(
      (
        select jsonb_agg(public.portal_request_row(page.q) order by page.ord)
        from (
          select q, row_number() over (
            order by (q.status = 'pending') desc, q.due_date nulls last, q.requested_at desc
          ) as ord
          from public.approval_requests q
          where q.brand_id = p_brand and q.status <> 'cancelled' and (p_status is null or q.status = p_status)
          order by (q.status = 'pending') desc, q.due_date nulls last, q.requested_at desc
          limit v_size offset v_offset
        ) page
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create function public.portal_get_approval(p_request uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_variant public.content_variants;
  v_revision public.content_revisions;
  v_decision public.approval_decisions;
  v_current uuid;
  v_designated boolean;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_request.brand_id) then
    raise exception 'not_found';
  end if;
  select * into v_variant from public.content_variants v where v.id = v_request.variant_id;
  select * into v_revision from public.content_revisions r where r.id = v_request.revision_id;
  select * into v_decision from public.approval_decisions d where d.request_id = p_request;
  select q.id into v_current
  from public.approval_requests q
  where q.variant_id = v_request.variant_id and q.status <> 'cancelled'
    and q.revision_id = v_variant.current_revision_id
  order by (q.status = 'pending') desc, q.requested_at desc
  limit 1;
  v_designated := v_request.approver_user_id = auth.uid();

  return jsonb_build_object(
    'request', public.portal_request_row(v_request),
    'brand_id', v_request.brand_id,
    'brand_name', (select b.name from public.brands b where b.id = v_request.brand_id),
    'message', v_request.message,
    'caption', v_revision.snapshot -> 'caption',
    'call_to_action', v_revision.snapshot ->> 'call_to_action',
    'revision_id', v_revision.id,
    'is_current', v_variant.current_revision_id = v_request.revision_id,
    'current_request_id', case when v_current is distinct from p_request then v_current else null end,
    'is_designated', v_designated,
    'can_decide', v_designated
      and v_request.status = 'pending'
      and v_variant.current_revision_id = v_request.revision_id
      and public.has_action('approvals.decide')
      and public.is_external_brand_member(v_request.brand_id, true),
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
        where m.revision_id = v_revision.id
      ),
      '[]'::jsonb
    ),
    'decision', case
      when v_decision.id is null then null
      else jsonb_build_object(
        'outcome', v_decision.outcome,
        'comment', v_decision.comment,
        'decided_at', v_decision.decided_at,
        'decided_by_name', (select p.full_name from public.profiles p where p.id = v_decision.decided_by)
      )
    end,
    'history', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'request_id', h.id,
            'revision_no', hr.revision_no,
            'status', h.status,
            'requested_at', h.requested_at,
            'decided_at', h.decided_at,
            'comment', hd.comment
          )
          order by h.requested_at desc
        )
        from public.approval_requests h
        join public.content_revisions hr on hr.id = h.revision_id
        left join public.approval_decisions hd on hd.request_id = h.id
        where h.variant_id = v_request.variant_id and h.id <> p_request and h.status <> 'cancelled'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create function public.portal_record_view(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_request.brand_id) then
    raise exception 'not_found';
  end if;
  if v_request.approver_user_id = auth.uid() and v_request.viewed_at is null and v_request.status = 'pending' then
    update public.approval_requests set viewed_at = now() where id = p_request;
  end if;
end;
$$;

create function public.portal_decide_approval(p_request uuid, p_outcome text, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_variant public.content_variants;
  v_item public.content_items;
  v_channel public.channels;
  v_brand public.brands;
  v_probe record;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_recipients uuid[];
begin
  perform public.assert_action('approvals.decide');
  select q.variant_id, q.brand_id into v_probe from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_probe.brand_id) then
    raise exception 'not_found';
  end if;

  select * into v_variant from public.content_variants v where v.id = v_probe.variant_id for update;
  select * into v_request from public.approval_requests q where q.id = p_request for update;

  if v_request.approver_user_id <> auth.uid() then
    raise exception 'not_designated_approver';
  end if;
  if not public.is_external_brand_member(v_request.brand_id, true) then
    raise exception 'approver_without_access';
  end if;
  if v_request.status = 'superseded' then
    raise exception 'revision_superseded';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if v_variant.current_revision_id is distinct from v_request.revision_id then
    raise exception 'revision_superseded';
  end if;
  if v_variant.editorial_status <> 'awaiting_approval' then
    raise exception 'request_not_pending';
  end if;
  if p_outcome is null or p_outcome not in ('approved', 'changes_requested') then
    raise exception 'invalid_input';
  end if;
  if p_outcome = 'changes_requested' and char_length(coalesce(v_comment, '')) < 5 then
    raise exception 'comment_required';
  end if;
  if char_length(coalesce(v_comment, '')) > 4000 then
    raise exception 'invalid_input';
  end if;

  insert into public.approval_decisions (request_id, revision_id, decided_by, outcome, comment)
  values (p_request, v_request.revision_id, auth.uid(), p_outcome, v_comment);

  update public.approval_requests
  set status = p_outcome, decided_at = now()
  where id = p_request;

  update public.content_variants
  set editorial_status = p_outcome,
      approved_revision_id = case when p_outcome = 'approved' then v_request.revision_id else null end,
      version = version + 1
  where id = v_request.variant_id;

  select * into v_item from public.content_items i where i.id = v_variant.content_item_id;
  select * into v_channel from public.channels c where c.id = v_variant.channel_id;
  select * into v_brand from public.brands b where b.id = v_request.brand_id;

  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.decided', 'approval_request',
    p_request, jsonb_build_object('outcome', p_outcome, 'revision_id', v_request.revision_id)
  );
  perform public.resolve_notifications('approval_request', p_request);

  select array_agg(distinct u) into v_recipients
  from unnest(array[v_request.requested_by, v_item.assignee_id]) u
  where u is not null;
  if v_recipients is not null then
    perform public.notify_users(
      'approval.decided', v_request.brand_id, 'Aprovação concluída',
      case when p_outcome = 'approved'
        then format('%s aprovou «%s» (%s).', v_brand.name, v_item.title, v_channel.profile_name)
        else format('%s pediu alterações em «%s».', v_brand.name, v_item.title)
      end,
      '/admin/marketing/approvals/' || p_request,
      'approval_request', p_request, 'approval.decided:' || p_request, v_recipients
    );
  end if;
  return jsonb_build_object('status', p_outcome);
end;
$$;

create function public.portal_list_comments(p_variant uuid)
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
  select v.brand_id into v_brand from public.content_variants v where v.id = p_variant;
  if v_brand is null or not public.is_external_brand_member(v_brand)
    or not exists (select 1 from public.approval_requests q where q.variant_id = p_variant) then
    raise exception 'not_found';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'body', c.body, 'created_at', c.created_at, 'author_name', p.full_name,
          'mine', c.author_id = auth.uid(), 'from_team', p.kind = 'internal',
          'revision_no', r.revision_no
        )
        order by c.created_at
      )
      from public.comments c
      join public.profiles p on p.id = c.author_id
      left join public.content_revisions r on r.id = c.revision_id
      where c.variant_id = p_variant and c.visibility = 'external' and c.deleted_at is null
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.portal_add_comment(p_variant uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.content_variants;
  v_item public.content_items;
  v_body text := btrim(coalesce(p_body, ''));
  v_author text;
  v_last_requester uuid;
  v_recipients uuid[];
  v_id uuid;
begin
  perform public.assert_action('comments.create_external');
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'invalid_input';
  end if;
  select * into v_variant from public.content_variants v where v.id = p_variant;
  if not found or not public.is_external_brand_member(v_variant.brand_id)
    or not exists (select 1 from public.approval_requests q where q.variant_id = p_variant) then
    raise exception 'not_found';
  end if;

  insert into public.comments (brand_id, variant_id, revision_id, author_id, visibility, body)
  values (v_variant.brand_id, p_variant, v_variant.current_revision_id, auth.uid(), 'external', v_body)
  returning id into v_id;

  select * into v_item from public.content_items i where i.id = v_variant.content_item_id;
  select p.full_name into v_author from public.profiles p where p.id = auth.uid();
  select q.requested_by into v_last_requester
  from public.approval_requests q where q.variant_id = p_variant order by q.requested_at desc limit 1;
  select array_agg(distinct u) into v_recipients
  from unnest(array[v_item.assignee_id, v_last_requester]) u
  where u is not null;

  perform public.audit_write(
    public.current_organization_id(), v_variant.brand_id, 'comment.created', 'comment', v_id,
    jsonb_build_object('visibility', 'external', 'variant_id', p_variant)
  );
  if v_recipients is not null then
    perform public.notify_users(
      'comment.created', v_variant.brand_id, 'Novo comentário',
      format('%s comentou em «%s».', v_author, v_item.title),
      '/admin/marketing/variants/' || p_variant,
      'comment', v_id, 'comment.created:' || v_id, v_recipients
    );
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.portal_media_urls(p_revision uuid, p_version_ids uuid[])
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
          'version_id', mv.id, 'storage_key', mv.storage_key, 'thumb_key', mv.thumb_key,
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

revoke execute on function public.portal_assert_member(uuid),
  public.portal_request_row(public.approval_requests), public.portal_list_brands(),
  public.portal_list_pending(uuid), public.portal_list_approvals(uuid, text, int, int),
  public.portal_get_approval(uuid), public.portal_record_view(uuid),
  public.portal_decide_approval(uuid, text, text), public.portal_list_comments(uuid),
  public.portal_add_comment(uuid, text), public.portal_media_urls(uuid, uuid[])
  from public, anon;

grant execute on function public.portal_list_brands(), public.portal_list_pending(uuid),
  public.portal_list_approvals(uuid, text, int, int), public.portal_get_approval(uuid),
  public.portal_record_view(uuid), public.portal_decide_approval(uuid, text, text),
  public.portal_list_comments(uuid), public.portal_add_comment(uuid, text),
  public.portal_media_urls(uuid, uuid[])
  to authenticated;

revoke execute on function public.portal_assert_member(uuid),
  public.portal_request_row(public.approval_requests) from authenticated;

commit;

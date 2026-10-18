begin;

create function public.user_can_work_on_brand(p_user uuid, p_brand uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = p_user and p.status = 'approved' and p.kind = 'internal'
      and (
        (r.key = 'owner' and r.is_system)
        or exists (
          select 1 from public.brand_members m
          where m.brand_id = p_brand and m.user_id = p.id and m.kind = 'internal' and m.status = 'active'
        )
      )
  )
$$;

create function public.approver_is_valid(p_brand uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_members m
    join public.profiles p on p.id = m.user_id
    where m.brand_id = p_brand and m.user_id = p_user
      and m.kind = 'external' and m.status = 'active' and m.can_decide
      and p.status = 'approved' and p.kind = 'external'
      and exists (
        select 1 from public.role_actions ra
        where ra.role_id = p.role_id and ra.action_key = 'approvals.decide'
      )
  )
$$;

create function public.content_check_media(p_brand uuid, p_media jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_found int;
begin
  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) > 20 then
    raise exception 'invalid_input';
  end if;
  if jsonb_array_length(p_media) = 0 then
    return;
  end if;
  select array_agg((e ->> 'media_version_id')::uuid) into v_ids from jsonb_array_elements(p_media) e;
  if exists (
    select 1 from jsonb_array_elements(p_media) e
    where char_length(coalesce(e ->> 'alt_text', '')) > 300
  ) then
    raise exception 'invalid_input';
  end if;
  if cardinality(v_ids) <> (select count(distinct x)::int from unnest(v_ids) x) then
    raise exception 'invalid_input';
  end if;
  select count(*)::int into v_found
  from public.media_versions v
  join public.media_assets a on a.id = v.asset_id
  where v.id = any (v_ids) and v.status = 'available'
    and a.scope = 'brand' and a.brand_id = p_brand and a.trashed_at is null;
  if v_found <> cardinality(v_ids) then
    raise exception 'media_not_available';
  end if;
end;
$$;

create function public.content_normalize_media(p_media jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'media_version_id', (e.value ->> 'media_version_id')::uuid,
        'alt_text', nullif(btrim(coalesce(e.value ->> 'alt_text', '')), '')
      )
      order by e.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) with ordinality as e (value, ordinality)
$$;

create function public.content_check_channel(p_brand uuid, p_channel uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_channel public.channels;
begin
  select * into v_channel from public.channels c where c.id = p_channel;
  if not found then
    raise exception 'not_found';
  end if;
  if v_channel.brand_id <> p_brand then
    raise exception 'channel_brand_mismatch';
  end if;
  if v_channel.archived_at is not null then
    raise exception 'channel_archived';
  end if;
end;
$$;

create function public.content_cancel_variant_row(p_variant uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.content_variants;
  v_request record;
begin
  select * into v_variant from public.content_variants v where v.id = p_variant for update;
  if not found or v_variant.editorial_status = 'cancelled' then
    return;
  end if;
  for v_request in
    select q.id from public.approval_requests q where q.variant_id = p_variant and q.status = 'pending'
  loop
    update public.approval_requests
    set status = 'cancelled', cancelled_reason = p_reason, decided_at = now()
    where id = v_request.id;
    perform public.resolve_notifications('approval_request', v_request.id);
  end loop;
  update public.content_variants
  set editorial_status = 'cancelled', publication_status = 'cancelled', version = version + 1
  where id = p_variant;
  perform public.audit_write(
    public.current_organization_id(), v_variant.brand_id, 'variant.cancelled', 'content_variant',
    p_variant, jsonb_build_object('item_id', v_variant.content_item_id)
  );
end;
$$;

create function public.content_item_save(p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_item ->> 'id', '')::uuid;
  v_brand uuid := nullif(p_item ->> 'brand_id', '')::uuid;
  v_title text := btrim(coalesce(p_item ->> 'title', ''));
  v_objective text := nullif(btrim(coalesce(p_item ->> 'objective', '')), '');
  v_briefing jsonb := case when jsonb_typeof(p_item -> 'briefing') = 'object' then p_item -> 'briefing' else null end;
  v_notes text := nullif(btrim(coalesce(p_item ->> 'internal_notes', '')), '');
  v_assignee uuid := nullif(p_item ->> 'assignee_id', '')::uuid;
  v_due date := nullif(p_item ->> 'production_due_date', '')::date;
  v_expected int := nullif(p_item ->> 'expected_version', '')::int;
  v_tags text[] := '{}';
  v_org uuid := public.current_organization_id();
  v_old public.content_items;
  v_version int;
begin
  if jsonb_typeof(p_item -> 'tags') = 'array' then
    select coalesce(array_agg(distinct btrim(t) order by btrim(t)), '{}')
    into v_tags
    from jsonb_array_elements_text(p_item -> 'tags') t
    where btrim(t) <> '';
  end if;
  if char_length(v_title) not between 2 and 140
    or char_length(coalesce(v_objective, '')) > 2000
    or char_length(coalesce(v_notes, '')) > 4000
    or cardinality(v_tags) > 20
    or exists (select 1 from unnest(v_tags) t where char_length(t) > 40) then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    perform public.assert_action('content.create');
    perform public.assert_brand_access(v_brand);
    if exists (select 1 from public.brands b where b.id = v_brand and b.archived_at is not null) then
      raise exception 'brand_archived';
    end if;
    if v_assignee is not null and not public.user_can_work_on_brand(v_assignee, v_brand) then
      raise exception 'invalid_input';
    end if;
    insert into public.content_items (
      brand_id, title, objective, briefing, internal_notes, assignee_id, tags, production_due_date, created_by
    )
    values (v_brand, v_title, v_objective, v_briefing, v_notes, v_assignee, v_tags, v_due, auth.uid())
    returning id, version into v_id, v_version;
    perform public.audit_write(v_org, v_brand, 'content.created', 'content_item', v_id, '{}'::jsonb);
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  perform public.assert_action('content.update');
  select * into v_old from public.content_items i where i.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;
  if v_old.cancelled_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  if v_assignee is not null and v_assignee is distinct from v_old.assignee_id
    and not public.user_can_work_on_brand(v_assignee, v_old.brand_id) then
    raise exception 'invalid_input';
  end if;

  update public.content_items
  set title = v_title, objective = v_objective, briefing = v_briefing, internal_notes = v_notes,
      assignee_id = v_assignee, tags = v_tags, production_due_date = v_due, version = version + 1
  where id = v_id
  returning version into v_version;
  perform public.audit_write(v_org, v_old.brand_id, 'content.updated', 'content_item', v_id, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.content_item_cancel(p_item uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_variant record;
  v_count int := 0;
begin
  perform public.assert_action('content.cancel');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if v_item.cancelled_at is not null then
    raise exception 'transition_not_allowed';
  end if;

  for v_variant in
    select v.id from public.content_variants v
    where v.content_item_id = p_item and v.editorial_status <> 'cancelled'
      and v.publication_status <> 'published_manually'
    order by v.created_at
  loop
    perform public.content_cancel_variant_row(v_variant.id, v_reason);
    v_count := v_count + 1;
  end loop;

  update public.content_items set cancelled_at = now(), version = version + 1 where id = p_item;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.cancelled', 'content_item', p_item,
    jsonb_build_object('variants', v_count)
  );
end;
$$;

create function public.content_item_delete(p_item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
begin
  perform public.assert_action('content.delete');
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if exists (
    select 1 from public.content_revisions r
    join public.content_variants v on v.id = r.variant_id
    where v.content_item_id = p_item
  ) or exists (
    select 1 from public.comments c
    join public.content_variants v on v.id = c.variant_id
    where v.content_item_id = p_item
  ) then
    raise exception 'content_has_history';
  end if;
  delete from public.content_variants where content_item_id = p_item;
  delete from public.content_items where id = p_item;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.deleted', 'content_item', p_item, '{}'::jsonb
  );
end;
$$;

create function public.content_variant_save(p_variant jsonb, p_expected_version int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_variant ->> 'id', '')::uuid;
  v_item_id uuid := nullif(p_variant ->> 'content_item_id', '')::uuid;
  v_channel uuid := nullif(p_variant ->> 'channel_id', '')::uuid;
  v_format text := p_variant ->> 'format';
  v_text text := coalesce(p_variant -> 'caption' ->> 'text', '');
  v_caption jsonb;
  v_cta text := nullif(btrim(coalesce(p_variant ->> 'call_to_action', '')), '');
  v_planned timestamptz := nullif(p_variant ->> 'planned_at', '')::timestamptz;
  v_tz text := nullif(btrim(coalesce(p_variant ->> 'planned_timezone', '')), '');
  v_due date := nullif(p_variant ->> 'approval_due_date', '')::date;
  v_media jsonb := public.content_normalize_media(p_variant -> 'working_media');
  v_org uuid := public.current_organization_id();
  v_item public.content_items;
  v_old public.content_variants;
  v_brand_tz text;
  v_publication text;
  v_version int;
begin
  if v_format is null or v_format not in (
    'image', 'carousel', 'video', 'text', 'story', 'reel', 'article', 'other'
  ) or char_length(v_text) > 5000 or char_length(coalesce(v_cta, '')) > 300 then
    raise exception 'invalid_input';
  end if;
  v_caption := case when btrim(v_text) = '' then null else jsonb_build_object('text', v_text) end;
  if v_planned is not null and v_tz is not null and not exists (
    select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz
  ) then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    perform public.assert_action('content.create');
    select * into v_item from public.content_items i where i.id = v_item_id for share;
    if not found then
      raise exception 'not_found';
    end if;
    perform public.assert_brand_access(v_item.brand_id);
    if v_item.cancelled_at is not null then
      raise exception 'transition_not_allowed';
    end if;
    if exists (select 1 from public.brands b where b.id = v_item.brand_id and b.archived_at is not null) then
      raise exception 'brand_archived';
    end if;
    perform public.content_check_channel(v_item.brand_id, v_channel);
    perform public.content_check_media(v_item.brand_id, v_media);
    select b.timezone into v_brand_tz from public.brands b where b.id = v_item.brand_id;
    if v_planned is not null then
      v_tz := coalesce(v_tz, v_brand_tz);
    end if;
    insert into public.content_variants (
      brand_id, content_item_id, channel_id, format, caption, call_to_action, planned_at,
      planned_timezone, publication_status, approval_due_date, working_media
    )
    values (
      v_item.brand_id, v_item_id, v_channel, v_format, v_caption, v_cta, v_planned,
      case when v_planned is null then null else v_tz end,
      case when v_planned is null then 'unplanned' else 'planned' end,
      v_due, v_media
    )
    returning id, version into v_id, v_version;
    perform public.audit_write(
      v_org, v_item.brand_id, 'variant.created', 'content_variant', v_id,
      jsonb_build_object('item_id', v_item_id, 'channel_id', v_channel)
    );
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  perform public.assert_action('content.update');
  select * into v_old from public.content_variants v where v.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if p_expected_version is null or p_expected_version <> v_old.version then
    raise exception 'conflict';
  end if;
  if v_old.editorial_status = 'cancelled' or v_old.publication_status = 'published_manually' then
    raise exception 'transition_not_allowed';
  end if;
  if v_channel is distinct from v_old.channel_id then
    perform public.content_check_channel(v_old.brand_id, v_channel);
  end if;
  perform public.content_check_media(v_old.brand_id, v_media);
  select b.timezone into v_brand_tz from public.brands b where b.id = v_old.brand_id;
  if v_planned is not null then
    v_tz := coalesce(v_tz, v_old.planned_timezone, v_brand_tz);
  end if;

  if v_old.editorial_status = 'approved' and (
    v_format <> v_old.format
    or v_channel <> v_old.channel_id
    or v_caption is distinct from v_old.caption
    or v_cta is distinct from v_old.call_to_action
    or v_planned is distinct from v_old.planned_at
    or v_media is distinct from v_old.working_media
  ) then
    raise exception 'requires_new_revision';
  end if;

  v_publication := case
    when v_planned is null then 'unplanned'
    else 'planned'
  end;

  update public.content_variants
  set channel_id = v_channel, format = v_format, caption = v_caption, call_to_action = v_cta,
      planned_at = v_planned, planned_timezone = case when v_planned is null then null else v_tz end,
      publication_status = v_publication, approval_due_date = v_due, working_media = v_media,
      version = version + 1
  where id = v_id
  returning version into v_version;
  perform public.audit_write(
    v_org, v_old.brand_id, 'variant.updated', 'content_variant', v_id, '{}'::jsonb
  );
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.content_variant_move(p_variant uuid, p_to_status text, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.content_variants;
  v_version int;
begin
  perform public.assert_action('content.update');
  select * into v_old from public.content_variants v where v.id = p_variant for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if p_expected_version is null or p_expected_version <> v_old.version then
    raise exception 'conflict';
  end if;
  if p_to_status not in ('in_production', 'internal_review')
    or not public.editorial_transition_allowed(v_old.editorial_status, p_to_status) then
    raise exception 'transition_not_allowed';
  end if;
  update public.content_variants
  set editorial_status = p_to_status, version = version + 1
  where id = p_variant
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'variant.updated', 'content_variant', p_variant,
    jsonb_build_object('from', v_old.editorial_status, 'to', p_to_status)
  );
  return jsonb_build_object('id', p_variant, 'version', v_version);
end;
$$;

create function public.content_variant_cancel(p_variant uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.content_variants;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.assert_action('content.cancel');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select * into v_variant from public.content_variants v where v.id = p_variant for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_variant.brand_id);
  if v_variant.editorial_status = 'cancelled' or v_variant.publication_status = 'published_manually' then
    raise exception 'transition_not_allowed';
  end if;
  perform public.content_cancel_variant_row(p_variant, v_reason);
end;
$$;

create function public.submit_for_approval(
  p_variant uuid,
  p_approver uuid,
  p_due_date date,
  p_message text,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_organization_id();
  v_variant public.content_variants;
  v_item public.content_items;
  v_channel public.channels;
  v_brand public.brands;
  v_old public.approval_requests;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_revision uuid;
  v_request uuid;
  v_no int;
  v_version int;
begin
  perform public.assert_action('content.submit');
  select * into v_variant from public.content_variants v where v.id = p_variant for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_variant.brand_id);
  if p_expected_version is null or p_expected_version <> v_variant.version then
    raise exception 'conflict';
  end if;
  if v_variant.editorial_status not in ('in_production', 'internal_review', 'awaiting_approval') then
    raise exception 'transition_not_allowed';
  end if;
  if p_approver is null then
    raise exception 'approver_required';
  end if;
  if char_length(coalesce(v_message, '')) > 1000 then
    raise exception 'invalid_input';
  end if;

  select * into v_item from public.content_items i where i.id = v_variant.content_item_id;
  select * into v_channel from public.channels c where c.id = v_variant.channel_id;
  select * into v_brand from public.brands b where b.id = v_variant.brand_id;
  if v_item.cancelled_at is not null then
    raise exception 'transition_not_allowed';
  end if;
  if v_channel.archived_at is not null then
    raise exception 'channel_archived';
  end if;
  perform public.content_check_media(v_variant.brand_id, v_variant.working_media);
  if btrim(coalesce(v_variant.caption ->> 'text', '')) = '' and jsonb_array_length(v_variant.working_media) = 0 then
    raise exception 'invalid_input';
  end if;
  if not public.approver_is_valid(v_variant.brand_id, p_approver) then
    raise exception 'approver_without_access';
  end if;
  if p_due_date is not null and p_due_date < (now() at time zone v_brand.timezone)::date then
    raise exception 'invalid_input';
  end if;

  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.content_revisions r where r.variant_id = p_variant;

  insert into public.content_revisions (variant_id, brand_id, revision_no, snapshot, created_by)
  values (
    p_variant, v_variant.brand_id, v_no,
    jsonb_build_object(
      'title', v_item.title,
      'format', v_variant.format,
      'caption', v_variant.caption,
      'call_to_action', v_variant.call_to_action,
      'planned_at', v_variant.planned_at,
      'planned_timezone', v_variant.planned_timezone,
      'brand_timezone', v_brand.timezone,
      'channel', jsonb_build_object(
        'id', v_channel.id, 'platform', v_channel.platform, 'profile_name', v_channel.profile_name
      )
    ),
    auth.uid()
  )
  returning id into v_revision;

  insert into public.content_revision_media (revision_id, media_version_id, position, alt_text)
  select v_revision, (e.value ->> 'media_version_id')::uuid, (e.ordinality - 1)::int, e.value ->> 'alt_text'
  from jsonb_array_elements(v_variant.working_media) with ordinality as e (value, ordinality);

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id, alt_text)
  select (e.value ->> 'media_version_id')::uuid, 'content_revision', v_revision, e.value ->> 'alt_text'
  from jsonb_array_elements(v_variant.working_media) as e (value)
  on conflict do nothing;

  select * into v_old from public.approval_requests q
  where q.variant_id = p_variant and q.status = 'pending' for update;
  if found then
    update public.approval_requests
    set status = 'superseded', decided_at = now()
    where id = v_old.id;
    perform public.resolve_notifications('approval_request', v_old.id);
  end if;

  insert into public.approval_requests (
    brand_id, variant_id, revision_id, approver_user_id, requested_by, due_date, message
  )
  values (
    v_variant.brand_id, p_variant, v_revision, p_approver, auth.uid(), p_due_date, v_message
  )
  returning id into v_request;

  update public.content_variants
  set editorial_status = 'awaiting_approval', current_revision_id = v_revision,
      approved_revision_id = null, approval_due_date = p_due_date, version = version + 1
  where id = p_variant
  returning version into v_version;

  perform public.audit_write(
    v_org, v_variant.brand_id, 'variant.submitted', 'content_variant', p_variant,
    jsonb_build_object('revision_no', v_no, 'request_id', v_request)
  );
  perform public.audit_write(
    v_org, v_variant.brand_id, 'approval.requested', 'approval_request', v_request,
    jsonb_build_object('approver_id', p_approver, 'revision_id', v_revision)
  );

  if v_old.id is not null then
    perform public.audit_write(
      v_org, v_variant.brand_id, 'approval.superseded', 'approval_request', v_old.id,
      jsonb_build_object('replaced_by', v_request)
    );
    perform public.notify_users(
      'approval.superseded', v_variant.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_variant.brand_id || '/approvals/' || v_request,
      'approval_request', v_old.id, 'approval.superseded:' || v_old.id,
      array[v_old.approver_user_id]
    );
  end if;

  perform public.notify_users(
    'approval.requested', v_variant.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_channel.profile_name),
    '/portal/brands/' || v_variant.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    array[p_approver]
  );

  return jsonb_build_object(
    'request_id', v_request, 'revision_id', v_revision, 'revision_no', v_no, 'version', v_version
  );
end;
$$;

create function public.reopen_variant(p_variant uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.content_variants;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_old public.approval_requests;
  v_version int;
begin
  perform public.assert_action('content.reopen');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select * into v_variant from public.content_variants v where v.id = p_variant for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_variant.brand_id);
  if v_variant.editorial_status not in ('approved', 'awaiting_approval')
    or v_variant.publication_status = 'published_manually' then
    raise exception 'transition_not_allowed';
  end if;

  select * into v_old from public.approval_requests q
  where q.variant_id = p_variant and q.status = 'pending' for update;
  if found then
    update public.approval_requests
    set status = 'superseded', decided_at = now()
    where id = v_old.id;
    perform public.resolve_notifications('approval_request', v_old.id);
    perform public.audit_write(
      public.current_organization_id(), v_variant.brand_id, 'approval.superseded', 'approval_request',
      v_old.id, jsonb_build_object('reason', 'reopened')
    );
    perform public.notify_users(
      'approval.superseded', v_variant.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_variant.brand_id || '/approvals/' || v_old.id,
      'approval_request', v_old.id, 'approval.superseded:' || v_old.id,
      array[v_old.approver_user_id]
    );
  end if;

  update public.content_variants
  set editorial_status = 'in_production', approved_revision_id = null, version = version + 1
  where id = p_variant
  returning version into v_version;

  perform public.audit_write(
    public.current_organization_id(), v_variant.brand_id, 'variant.reopened', 'content_variant',
    p_variant, jsonb_build_object('reason', v_reason, 'from', v_variant.editorial_status)
  );
  return jsonb_build_object('id', p_variant, 'version', v_version);
end;
$$;

create function public.mark_published(
  p_variant uuid,
  p_published_at timestamptz,
  p_url text,
  p_evidence_media_version uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.content_variants;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_version int;
begin
  perform public.assert_action('content.publish_manual');
  select * into v_variant from public.content_variants v where v.id = p_variant for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_variant.brand_id);
  if v_variant.editorial_status <> 'approved' or v_variant.approved_revision_id is null then
    raise exception 'not_approved';
  end if;
  if v_variant.publication_status = 'published_manually' then
    raise exception 'transition_not_allowed';
  end if;
  if p_published_at is null or p_published_at > now() + interval '5 minutes'
    or (v_url is not null and v_url !~ '^https://')
    or char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  if p_evidence_media_version is not null then
    perform public.content_check_media(
      v_variant.brand_id,
      jsonb_build_array(jsonb_build_object('media_version_id', p_evidence_media_version))
    );
    insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
    values (p_evidence_media_version, 'publication_evidence', p_variant)
    on conflict do nothing;
  end if;

  update public.content_variants
  set publication_status = 'published_manually', published_at = p_published_at, published_url = v_url,
      published_note = v_note, published_evidence_media_version_id = p_evidence_media_version,
      version = version + 1
  where id = p_variant
  returning version into v_version;
  perform public.resolve_notifications('content_variant', p_variant);
  perform public.audit_write(
    public.current_organization_id(), v_variant.brand_id, 'variant.published_manually',
    'content_variant', p_variant,
    jsonb_build_object('revision_id', v_variant.approved_revision_id)
  );
  return jsonb_build_object('id', p_variant, 'version', v_version);
end;
$$;

create function public.comment_add(p_variant uuid, p_visibility text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant public.content_variants;
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if p_visibility = 'internal' then
    perform public.assert_action('comments.create_internal');
  elsif p_visibility = 'external' then
    perform public.assert_action('comments.create_external');
  else
    raise exception 'invalid_input';
  end if;
  if char_length(v_body) not between 1 and 4000 then
    raise exception 'invalid_input';
  end if;
  select * into v_variant from public.content_variants v where v.id = p_variant;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_variant.brand_id);

  insert into public.comments (brand_id, variant_id, revision_id, author_id, visibility, body)
  values (v_variant.brand_id, p_variant, v_variant.current_revision_id, auth.uid(), p_visibility, v_body)
  returning id into v_id;
  perform public.audit_write(
    public.current_organization_id(), v_variant.brand_id, 'comment.created', 'comment', v_id,
    jsonb_build_object('visibility', p_visibility, 'variant_id', p_variant)
  );
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.comment_delete(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comment public.comments;
begin
  select * into v_comment from public.comments c where c.id = p_comment and c.deleted_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_comment.brand_id);
  if v_comment.author_id <> auth.uid() then
    raise exception 'denied';
  end if;
  update public.comments set deleted_at = now() where id = p_comment;
  perform public.audit_write(
    public.current_organization_id(), v_comment.brand_id, 'comment.deleted', 'comment', p_comment,
    jsonb_build_object('visibility', v_comment.visibility, 'variant_id', v_comment.variant_id)
  );
end;
$$;

create function public.reassign_approver(p_request uuid, p_new_approver uuid)
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
  v_new uuid;
begin
  perform public.assert_action('content.submit');
  select q.variant_id into v_new from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_variant from public.content_variants v where v.id = v_new for update;
  perform public.assert_brand_access(v_variant.brand_id);
  select * into v_request from public.approval_requests q where q.id = p_request for update;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if v_variant.current_revision_id is distinct from v_request.revision_id then
    raise exception 'revision_superseded';
  end if;
  if p_new_approver is null then
    raise exception 'approver_required';
  end if;
  if p_new_approver = v_request.approver_user_id
    or not public.approver_is_valid(v_variant.brand_id, p_new_approver) then
    raise exception 'approver_without_access';
  end if;

  update public.approval_requests set status = 'superseded', decided_at = now() where id = p_request;
  perform public.resolve_notifications('approval_request', p_request);
  insert into public.approval_requests (
    brand_id, variant_id, revision_id, approver_user_id, requested_by, due_date, message
  )
  values (
    v_request.brand_id, v_request.variant_id, v_request.revision_id, p_new_approver, auth.uid(),
    v_request.due_date, v_request.message
  )
  returning id into v_new;

  select * into v_item from public.content_items i where i.id = v_variant.content_item_id;
  select * into v_channel from public.channels c where c.id = v_variant.channel_id;
  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.approver_reassigned',
    'approval_request', v_new,
    jsonb_build_object('previous_request', p_request, 'approver_id', p_new_approver)
  );
  perform public.notify_users(
    'approval.superseded', v_request.brand_id, 'Uma nova versão foi enviada',
    'A versão que você ia avaliar foi substituída. Veja a versão atual.',
    '/portal/brands/' || v_request.brand_id || '/approvals/' || v_new,
    'approval_request', p_request, 'approval.superseded:' || p_request,
    array[v_request.approver_user_id]
  );
  perform public.notify_users(
    'approval.requested', v_request.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_channel.profile_name),
    '/portal/brands/' || v_request.brand_id || '/approvals/' || v_new,
    'approval_request', v_new, 'approval.requested:' || v_new,
    array[p_new_approver]
  );
  return jsonb_build_object('request_id', v_new);
end;
$$;

create function public.cancel_request(p_request uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_variant public.content_variants;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_variant_id uuid;
begin
  perform public.assert_action('content.submit');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select q.variant_id into v_variant_id from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_variant from public.content_variants v where v.id = v_variant_id for update;
  perform public.assert_brand_access(v_variant.brand_id);
  select * into v_request from public.approval_requests q where q.id = p_request for update;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  update public.approval_requests
  set status = 'cancelled', cancelled_reason = v_reason, decided_at = now()
  where id = p_request;
  perform public.resolve_notifications('approval_request', p_request);
  if v_variant.editorial_status = 'awaiting_approval' then
    update public.content_variants
    set editorial_status = 'in_production', version = version + 1
    where id = v_variant_id;
  end if;
  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.cancelled', 'approval_request',
    p_request, jsonb_build_object('reason', v_reason)
  );
end;
$$;

create function public.send_approval_reminder(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_variant public.content_variants;
  v_item public.content_items;
  v_channel public.channels;
begin
  perform public.assert_action('content.submit');
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_request.brand_id);
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if not public.approver_is_valid(v_request.brand_id, v_request.approver_user_id) then
    raise exception 'approver_without_access';
  end if;
  select * into v_variant from public.content_variants v where v.id = v_request.variant_id;
  select * into v_item from public.content_items i where i.id = v_variant.content_item_id;
  select * into v_channel from public.channels c where c.id = v_variant.channel_id;
  perform public.notify_users(
    'approval.requested', v_request.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_channel.profile_name),
    '/portal/brands/' || v_request.brand_id || '/approvals/' || p_request,
    'approval_request', p_request,
    'approval.requested:' || p_request || ':reminder:' || to_char(now(), 'YYYYMMDDHH24'),
    array[v_request.approver_user_id]
  );
  perform public.audit_write(
    public.current_organization_id(), v_request.brand_id, 'approval.reminder_sent', 'approval_request',
    p_request, '{}'::jsonb
  );
end;
$$;

create function public.approver_options(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.submit');
  perform public.assert_brand_access(p_brand);
  return jsonb_build_object(
    'approvers', coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name) order by p.full_name)
        from public.brand_members m
        join public.profiles p on p.id = m.user_id
        where m.brand_id = p_brand and public.approver_is_valid(p_brand, p.id)
      ),
      '[]'::jsonb
    ),
    'default_deadline_days', coalesce(
      (select (s.value ->> 'deadlineDays')::int from public.organization_settings s where s.key = 'policies.approvals'),
      3
    )
  );
end;
$$;

create function public.person_names(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_action('content.view') or public.has_action('approvals.view')) then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_object_agg(p.id::text, p.full_name)
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = any (coalesce(p_ids, '{}'))
        and (
          p.id = auth.uid()
          or (r.key = 'owner' and r.is_system)
          or exists (
            select 1 from public.brand_members m
            where m.user_id = p.id and public.can_access_brand(m.brand_id)
          )
        )
    ),
    '{}'::jsonb
  );
end;
$$;

create function public.comment_list(p_variant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  select v.brand_id into v_brand from public.content_variants v where v.id = p_variant;
  if v_brand is null then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_brand);
  if not (public.has_action('content.view') or public.has_action('approvals.view')) then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id, 'visibility', c.visibility, 'body', c.body, 'created_at', c.created_at,
          'author_id', c.author_id, 'author_name', p.full_name, 'revision_no', r.revision_no,
          'mine', c.author_id = auth.uid()
        )
        order by c.created_at
      )
      from public.comments c
      join public.profiles p on p.id = c.author_id
      left join public.content_revisions r on r.id = c.revision_id
      where c.variant_id = p_variant and c.deleted_at is null
        and (
          (c.visibility = 'internal' and public.has_action('content.view'))
          or (c.visibility = 'external' and (public.has_action('approvals.view') or public.has_action('content.view')))
        )
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.user_can_work_on_brand(uuid, uuid),
  public.approver_is_valid(uuid, uuid), public.content_check_media(uuid, jsonb),
  public.content_normalize_media(jsonb), public.content_check_channel(uuid, uuid),
  public.content_cancel_variant_row(uuid, text),
  public.content_item_save(jsonb), public.content_item_cancel(uuid, text),
  public.content_item_delete(uuid), public.content_variant_save(jsonb, int),
  public.content_variant_move(uuid, text, int), public.content_variant_cancel(uuid, text),
  public.submit_for_approval(uuid, uuid, date, text, int), public.reopen_variant(uuid, text),
  public.mark_published(uuid, timestamptz, text, uuid, text), public.comment_add(uuid, text, text),
  public.comment_delete(uuid), public.reassign_approver(uuid, uuid), public.cancel_request(uuid, text),
  public.send_approval_reminder(uuid), public.approver_options(uuid), public.person_names(uuid[]),
  public.comment_list(uuid)
  from public, anon;

grant execute on function public.content_item_save(jsonb), public.content_item_cancel(uuid, text),
  public.content_item_delete(uuid), public.content_variant_save(jsonb, int),
  public.content_variant_move(uuid, text, int), public.content_variant_cancel(uuid, text),
  public.submit_for_approval(uuid, uuid, date, text, int), public.reopen_variant(uuid, text),
  public.mark_published(uuid, timestamptz, text, uuid, text), public.comment_add(uuid, text, text),
  public.comment_delete(uuid), public.reassign_approver(uuid, uuid), public.cancel_request(uuid, text),
  public.send_approval_reminder(uuid), public.approver_options(uuid), public.person_names(uuid[]),
  public.comment_list(uuid)
  to authenticated;

revoke execute on function public.user_can_work_on_brand(uuid, uuid),
  public.approver_is_valid(uuid, uuid), public.content_check_media(uuid, jsonb),
  public.content_normalize_media(jsonb), public.content_check_channel(uuid, uuid),
  public.content_cancel_variant_row(uuid, text) from authenticated;

commit;

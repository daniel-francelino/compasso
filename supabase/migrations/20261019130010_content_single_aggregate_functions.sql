begin;

drop function public.content_cancel_variant_row(uuid, text);
drop function public.content_item_save(jsonb);
drop function public.content_item_cancel(uuid, text);
drop function public.content_item_delete(uuid);
drop function public.content_variant_save(jsonb, int);
drop function public.content_variant_move(uuid, text, int);
drop function public.content_variant_cancel(uuid, text);
drop function public.submit_for_approval(uuid, uuid, date, text, int);
drop function public.reopen_variant(uuid, text);
drop function public.mark_published(uuid, timestamptz, text, uuid, text);
drop function public.comment_add(uuid, text, text);
drop function public.comment_list(uuid);
drop function public.comment_delete(uuid);
drop function public.reassign_approver(uuid, uuid);
drop function public.cancel_request(uuid, text);
drop function public.send_approval_reminder(uuid);

create function public.content_channels_signature(p_item uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'channel_id', r.channel_id, 'format', r.format, 'caption', r.caption,
        'planned_at', r.planned_at
      )
      order by r.position, r.created_at
    ),
    '[]'::jsonb
  )
  from public.content_channels r
  where r.content_item_id = p_item and r.publication_status <> 'cancelled'
$$;

create function public.content_cancel_pending_requests(p_item uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request record;
begin
  for v_request in
    select q.id from public.approval_requests q where q.item_id = p_item and q.status = 'pending'
  loop
    update public.approval_requests
    set status = 'cancelled', cancelled_reason = p_reason, decided_at = now()
    where id = v_request.id;
    perform public.resolve_notifications('approval_request', v_request.id);
  end loop;
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
  v_objective_kind text := nullif(btrim(coalesce(p_item ->> 'objective_kind', '')), '');
  v_briefing jsonb := case when jsonb_typeof(p_item -> 'briefing') = 'object' then p_item -> 'briefing' else null end;
  v_notes text := nullif(btrim(coalesce(p_item ->> 'internal_notes', '')), '');
  v_assignee uuid := nullif(p_item ->> 'assignee_id', '')::uuid;
  v_due date := nullif(p_item ->> 'production_due_date', '')::date;
  v_expected int := nullif(p_item ->> 'expected_version', '')::int;
  v_text text := coalesce(p_item -> 'caption' ->> 'text', '');
  v_caption jsonb;
  v_cta text := nullif(btrim(coalesce(p_item ->> 'call_to_action', '')), '');
  v_media jsonb := public.content_normalize_media(p_item -> 'working_media');
  v_channels jsonb := coalesce(p_item -> 'channels', '[]'::jsonb);
  v_source_note uuid := nullif(p_item ->> 'source_note', '')::uuid;
  v_tags text[] := '{}';
  v_org uuid := public.current_organization_id();
  v_is_new boolean := nullif(p_item ->> 'id', '') is null;
  v_old public.content_items;
  v_existing public.content_channels;
  v_removed record;
  v_row jsonb;
  v_row_id uuid;
  v_channel uuid;
  v_format text;
  v_row_caption jsonb;
  v_planned timestamptz;
  v_tz text;
  v_brand_tz text;
  v_position int := 0;
  v_keep uuid[] := '{}';
  v_signature jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_out jsonb := '[]'::jsonb;
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
    or (v_objective_kind is not null and v_objective_kind not in (
      'awareness', 'engagement', 'traffic', 'leads', 'sales', 'community', 'other'
    ))
    or char_length(coalesce(v_notes, '')) > 4000
    or char_length(v_text) > 5000
    or char_length(coalesce(v_cta, '')) > 300
    or cardinality(v_tags) > 20
    or exists (select 1 from unnest(v_tags) t where char_length(t) > 40)
    or jsonb_typeof(v_channels) <> 'array'
    or jsonb_array_length(v_channels) > 20 then
    raise exception 'invalid_input';
  end if;
  v_caption := case when btrim(v_text) = '' then null else jsonb_build_object('text', v_text) end;

  if v_is_new then
    perform public.assert_action('content.create');
    perform public.assert_brand_access(v_brand);
    if exists (select 1 from public.brands b where b.id = v_brand and b.archived_at is not null) then
      raise exception 'brand_archived';
    end if;
    if v_assignee is not null and not public.user_can_work_on_brand(v_assignee, v_brand) then
      raise exception 'invalid_input';
    end if;
  else
    perform public.assert_action('content.update');
    select * into v_old from public.content_items i where i.id = v_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    v_brand := v_old.brand_id;
    perform public.assert_brand_access(v_brand);
    if v_expected is null or v_expected <> v_old.version then
      raise exception 'conflict';
    end if;
    if v_old.cancelled_at is not null then
      raise exception 'transition_not_allowed';
    end if;
    if v_assignee is not null and v_assignee is distinct from v_old.assignee_id
      and not public.user_can_work_on_brand(v_assignee, v_brand) then
      raise exception 'invalid_input';
    end if;
  end if;

  perform public.content_check_media(v_brand, v_media);
  select b.timezone into v_brand_tz from public.brands b where b.id = v_brand;

  for v_row in select e.value from jsonb_array_elements(v_channels) e loop
    v_channel := nullif(v_row ->> 'channel_id', '')::uuid;
    v_format := v_row ->> 'format';
    v_planned := nullif(v_row ->> 'planned_at', '')::timestamptz;
    v_tz := nullif(btrim(coalesce(v_row ->> 'planned_timezone', '')), '');
    v_row_caption := case
      when btrim(coalesce(v_row ->> 'caption', '')) = '' then null
      else jsonb_build_object('text', v_row ->> 'caption')
    end;
    if v_channel is null or v_format is null or v_format not in (
      'image', 'carousel', 'video', 'text', 'story', 'reel', 'article', 'other'
    ) or char_length(coalesce(v_row ->> 'caption', '')) > 5000
      or (v_tz is not null and not exists (
        select 1 from pg_catalog.pg_timezone_names z where z.name = v_tz
      )) then
      raise exception 'invalid_input';
    end if;
    perform public.content_check_channel(v_brand, v_channel);
    v_tz := case when v_planned is null then null else coalesce(v_tz, v_brand_tz) end;
    v_signature := v_signature || jsonb_build_array(jsonb_build_object(
      'channel_id', v_channel, 'format', v_format, 'caption', v_row_caption, 'planned_at', v_planned
    ));
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', nullif(v_row ->> 'id', ''), 'channel_id', v_channel, 'format', v_format,
      'caption', v_row_caption, 'planned_at', v_planned, 'planned_timezone', v_tz
    ));
  end loop;

  if not v_is_new and v_old.editorial_status = 'approved' and (
    v_caption is distinct from v_old.caption
    or v_cta is distinct from v_old.call_to_action
    or v_media is distinct from v_old.working_media
    or v_signature is distinct from public.content_channels_signature(v_id)
  ) then
    raise exception 'requires_new_revision';
  end if;

  if v_is_new then
    insert into public.content_items (
      brand_id, title, objective, objective_kind, briefing, internal_notes, assignee_id, tags,
      production_due_date, caption, call_to_action, working_media, created_by
    )
    values (
      v_brand, v_title, v_objective, v_objective_kind, v_briefing, v_notes, v_assignee, v_tags, v_due,
      v_caption, v_cta, v_media, auth.uid()
    )
    returning id, version into v_id, v_version;
    perform public.audit_write(v_org, v_brand, 'content.created', 'content_item', v_id, '{}'::jsonb);
  end if;

  for v_row in select e.value from jsonb_array_elements(v_rows) e loop
    v_row_id := nullif(v_row ->> 'id', '')::uuid;
    v_planned := nullif(v_row ->> 'planned_at', '')::timestamptz;
    if v_row_id is null then
      insert into public.content_channels (
        brand_id, content_item_id, channel_id, format, caption, planned_at, planned_timezone,
        publication_status, position
      )
      values (
        v_brand, v_id, (v_row ->> 'channel_id')::uuid, v_row ->> 'format', nullif(v_row -> 'caption', 'null'::jsonb),
        v_planned, nullif(v_row ->> 'planned_timezone', ''),
        case when v_planned is null then 'unplanned' else 'planned' end, v_position
      )
      returning id into v_row_id;
      perform public.audit_write(
        v_org, v_brand, 'content_channel.added', 'content_channel', v_row_id,
        jsonb_build_object('item_id', v_id, 'channel_id', (v_row ->> 'channel_id')::uuid)
      );
    else
      select * into v_existing from public.content_channels r
      where r.id = v_row_id and r.content_item_id = v_id for update;
      if not found then
        raise exception 'not_found';
      end if;
      if v_existing.publication_status = 'published_manually' then
        v_keep := v_keep || v_row_id;
        v_position := v_position + 1;
        v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_row_id, 'channel_id', v_existing.channel_id));
        continue;
      end if;
      update public.content_channels
      set channel_id = (v_row ->> 'channel_id')::uuid, format = v_row ->> 'format',
          caption = nullif(v_row -> 'caption', 'null'::jsonb), planned_at = v_planned,
          planned_timezone = nullif(v_row ->> 'planned_timezone', ''), position = v_position,
          publication_status = case when v_planned is null then 'unplanned' else 'planned' end,
          version = version + 1
      where id = v_row_id;
    end if;
    v_keep := v_keep || v_row_id;
    v_position := v_position + 1;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_row_id, 'channel_id', (v_row ->> 'channel_id')::uuid));
  end loop;

  if exists (
    select 1 from public.content_channels r
    where r.content_item_id = v_id and r.publication_status = 'published_manually'
      and not (r.id = any (v_keep))
  ) then
    raise exception 'transition_not_allowed';
  end if;

  for v_removed in
    select r.id, r.channel_id from public.content_channels r
    where r.content_item_id = v_id and r.publication_status in ('unplanned', 'planned')
      and not (r.id = any (v_keep))
  loop
    delete from public.content_channels where id = v_removed.id;
    perform public.audit_write(
      v_org, v_brand, 'content_channel.removed', 'content_channel', v_removed.id,
      jsonb_build_object('item_id', v_id, 'channel_id', v_removed.channel_id)
    );
  end loop;

  if not v_is_new then
    update public.content_items
    set title = v_title, objective = v_objective, objective_kind = v_objective_kind,
        briefing = v_briefing, internal_notes = v_notes, assignee_id = v_assignee, tags = v_tags,
        production_due_date = v_due, caption = v_caption, call_to_action = v_cta,
        working_media = v_media, version = version + 1
    where id = v_id
    returning version into v_version;
    perform public.audit_write(v_org, v_brand, 'content.updated', 'content_item', v_id, '{}'::jsonb);
  end if;

  if v_is_new and v_source_note is not null and public.has_action('calendar.manage') then
    update public.calendar_notes
    set converted_item_id = v_id, converted_at = now()
    where id = v_source_note and brand_id = v_brand and converted_item_id is null
      and archived_at is null;
    if found then
      perform public.audit_write(
        v_org, v_brand, 'calendar_note.converted', 'calendar_note', v_source_note,
        jsonb_build_object('item_id', v_id)
      );
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'version', v_version, 'channels', v_out);
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
  v_count int;
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

  perform public.content_cancel_pending_requests(p_item, v_reason);
  update public.content_channels
  set publication_status = 'cancelled', version = version + 1
  where content_item_id = p_item and publication_status in ('unplanned', 'planned');
  get diagnostics v_count = row_count;
  update public.content_items
  set cancelled_at = now(), editorial_status = 'cancelled', version = version + 1
  where id = p_item;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.cancelled', 'content_item', p_item,
    jsonb_build_object('channels', v_count)
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
  if exists (select 1 from public.content_revisions r where r.item_id = p_item)
    or exists (select 1 from public.comments c where c.item_id = p_item) then
    raise exception 'content_has_history';
  end if;
  update public.calendar_notes
  set converted_item_id = null, converted_at = null
  where converted_item_id = p_item;
  delete from public.content_channels where content_item_id = p_item;
  delete from public.content_items where id = p_item;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.deleted', 'content_item', p_item, '{}'::jsonb
  );
end;
$$;

create function public.content_move(p_item uuid, p_to_status text, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.content_items;
  v_version int;
begin
  perform public.assert_action('content.update');
  select * into v_old from public.content_items i where i.id = p_item for update;
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
  update public.content_items
  set editorial_status = p_to_status, version = version + 1
  where id = p_item
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'content.updated', 'content_item', p_item,
    jsonb_build_object('from', v_old.editorial_status, 'to', p_to_status)
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;

create function public.content_channel_cancel(p_channel_row uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.content_channels;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  perform public.assert_action('content.cancel');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select * into v_row from public.content_channels r where r.id = p_channel_row for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  if v_row.publication_status in ('cancelled', 'published_manually') then
    raise exception 'transition_not_allowed';
  end if;
  if not exists (
    select 1 from public.content_channels o
    where o.content_item_id = v_row.content_item_id and o.id <> p_channel_row
      and o.publication_status <> 'cancelled'
  ) then
    raise exception 'transition_not_allowed';
  end if;
  update public.content_channels
  set publication_status = 'cancelled', version = version + 1
  where id = p_channel_row;
  perform public.resolve_notifications('content_channel', p_channel_row);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'content_channel.cancelled', 'content_channel',
    p_channel_row, jsonb_build_object('item_id', v_row.content_item_id)
  );
end;
$$;

create function public.submit_for_approval(
  p_item uuid,
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
  v_item public.content_items;
  v_brand public.brands;
  v_old public.approval_requests;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_channels jsonb;
  v_names text;
  v_revision uuid;
  v_request uuid;
  v_no int;
  v_version int;
begin
  perform public.assert_action('content.submit');
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if p_expected_version is null or p_expected_version <> v_item.version then
    raise exception 'conflict';
  end if;
  if v_item.cancelled_at is not null
    or v_item.editorial_status not in ('in_production', 'internal_review', 'awaiting_approval') then
    raise exception 'transition_not_allowed';
  end if;
  if p_approver is null then
    raise exception 'approver_required';
  end if;
  if char_length(coalesce(v_message, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  select * into v_brand from public.brands b where b.id = v_item.brand_id;

  if not exists (
    select 1 from public.content_channels r
    where r.content_item_id = p_item and r.publication_status <> 'cancelled'
  ) then
    raise exception 'channel_required';
  end if;
  if exists (
    select 1 from public.content_channels r
    join public.channels c on c.id = r.channel_id
    where r.content_item_id = p_item and r.publication_status <> 'cancelled'
      and c.archived_at is not null
  ) then
    raise exception 'channel_archived';
  end if;
  perform public.content_check_media(v_item.brand_id, v_item.working_media);
  if btrim(coalesce(v_item.caption ->> 'text', '')) = '' and jsonb_array_length(v_item.working_media) = 0 then
    raise exception 'invalid_input';
  end if;
  if not public.approver_is_valid(v_item.brand_id, p_approver) then
    raise exception 'approver_without_access';
  end if;
  if p_due_date is not null and p_due_date < (now() at time zone v_brand.timezone)::date then
    raise exception 'invalid_input';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'row_id', r.id, 'id', c.id, 'platform', c.platform, 'profile_name', c.profile_name,
      'format', r.format, 'caption', r.caption, 'planned_at', r.planned_at,
      'planned_timezone', r.planned_timezone
    )
    order by r.position, r.created_at
  ),
  string_agg(c.profile_name, ', ' order by r.position, r.created_at)
  into v_channels, v_names
  from public.content_channels r
  join public.channels c on c.id = r.channel_id
  where r.content_item_id = p_item and r.publication_status <> 'cancelled';

  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.content_revisions r where r.item_id = p_item;

  insert into public.content_revisions (item_id, brand_id, revision_no, snapshot, created_by)
  values (
    p_item, v_item.brand_id, v_no,
    jsonb_build_object(
      'title', v_item.title,
      'caption', v_item.caption,
      'call_to_action', v_item.call_to_action,
      'brand_timezone', v_brand.timezone,
      'channels', v_channels
    ),
    auth.uid()
  )
  returning id into v_revision;

  insert into public.content_revision_media (revision_id, media_version_id, position, alt_text)
  select v_revision, (e.value ->> 'media_version_id')::uuid, (e.ordinality - 1)::int, e.value ->> 'alt_text'
  from jsonb_array_elements(v_item.working_media) with ordinality as e (value, ordinality);

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id, alt_text)
  select (e.value ->> 'media_version_id')::uuid, 'content_revision', v_revision, e.value ->> 'alt_text'
  from jsonb_array_elements(v_item.working_media) as e (value)
  on conflict do nothing;

  select * into v_old from public.approval_requests q
  where q.item_id = p_item and q.status = 'pending' for update;
  if found then
    update public.approval_requests set status = 'superseded', decided_at = now() where id = v_old.id;
    perform public.resolve_notifications('approval_request', v_old.id);
  end if;

  insert into public.approval_requests (
    brand_id, item_id, revision_id, approver_user_id, requested_by, due_date, message
  )
  values (v_item.brand_id, p_item, v_revision, p_approver, auth.uid(), p_due_date, v_message)
  returning id into v_request;

  update public.content_items
  set editorial_status = 'awaiting_approval', current_revision_id = v_revision,
      approved_revision_id = null, approval_due_date = p_due_date, version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    v_org, v_item.brand_id, 'content.submitted', 'content_item', p_item,
    jsonb_build_object('revision_no', v_no, 'request_id', v_request)
  );
  perform public.audit_write(
    v_org, v_item.brand_id, 'approval.requested', 'approval_request', v_request,
    jsonb_build_object('approver_id', p_approver, 'revision_id', v_revision)
  );

  if v_old.id is not null then
    perform public.audit_write(
      v_org, v_item.brand_id, 'approval.superseded', 'approval_request', v_old.id,
      jsonb_build_object('replaced_by', v_request)
    );
    perform public.notify_users(
      'approval.superseded', v_item.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
      'approval_request', v_old.id, 'approval.superseded:' || v_old.id,
      array[v_old.approver_user_id]
    );
  end if;

  perform public.notify_users(
    'approval.requested', v_item.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_names),
    '/portal/brands/' || v_item.brand_id || '/approvals/' || v_request,
    'approval_request', v_request, 'approval.requested:' || v_request,
    array[p_approver]
  );

  return jsonb_build_object(
    'request_id', v_request, 'revision_id', v_revision, 'revision_no', v_no, 'version', v_version
  );
end;
$$;

create function public.reopen_content(p_item uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_old public.approval_requests;
  v_version int;
begin
  perform public.assert_action('content.reopen');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select * into v_item from public.content_items i where i.id = p_item for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);
  if v_item.editorial_status not in ('approved', 'awaiting_approval')
    or exists (
      select 1 from public.content_channels r
      where r.content_item_id = p_item and r.publication_status = 'published_manually'
    ) then
    raise exception 'transition_not_allowed';
  end if;

  select * into v_old from public.approval_requests q
  where q.item_id = p_item and q.status = 'pending' for update;
  if found then
    update public.approval_requests set status = 'superseded', decided_at = now() where id = v_old.id;
    perform public.resolve_notifications('approval_request', v_old.id);
    perform public.audit_write(
      public.current_organization_id(), v_item.brand_id, 'approval.superseded', 'approval_request',
      v_old.id, jsonb_build_object('reason', 'reopened')
    );
    perform public.notify_users(
      'approval.superseded', v_item.brand_id, 'Uma nova versão foi enviada',
      'A versão que você ia avaliar foi substituída. Veja a versão atual.',
      '/portal/brands/' || v_item.brand_id || '/approvals/' || v_old.id,
      'approval_request', v_old.id, 'approval.superseded:' || v_old.id,
      array[v_old.approver_user_id]
    );
  end if;

  update public.content_items
  set editorial_status = 'in_production', approved_revision_id = null, version = version + 1
  where id = p_item
  returning version into v_version;

  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'content.reopened', 'content_item', p_item,
    jsonb_build_object('reason', v_reason, 'from', v_item.editorial_status)
  );
  return jsonb_build_object('id', p_item, 'version', v_version);
end;
$$;

create function public.mark_published(
  p_channel_row uuid,
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
  v_row public.content_channels;
  v_item public.content_items;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_version int;
begin
  perform public.assert_action('content.publish_manual');
  select * into v_row from public.content_channels r where r.id = p_channel_row for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  select * into v_item from public.content_items i where i.id = v_row.content_item_id;
  if v_item.editorial_status <> 'approved' or v_item.approved_revision_id is null then
    raise exception 'not_approved';
  end if;
  if v_row.publication_status in ('published_manually', 'cancelled') then
    raise exception 'transition_not_allowed';
  end if;
  if p_published_at is null or p_published_at > now() + interval '5 minutes'
    or (v_url is not null and v_url !~ '^https://')
    or char_length(coalesce(v_note, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  if p_evidence_media_version is not null then
    perform public.content_check_media(
      v_row.brand_id,
      jsonb_build_array(jsonb_build_object('media_version_id', p_evidence_media_version))
    );
    insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
    values (p_evidence_media_version, 'publication_evidence', p_channel_row)
    on conflict do nothing;
  end if;

  update public.content_channels
  set publication_status = 'published_manually', published_at = p_published_at, published_url = v_url,
      published_note = v_note, published_evidence_media_version_id = p_evidence_media_version,
      version = version + 1
  where id = p_channel_row
  returning version into v_version;
  perform public.resolve_notifications('content_channel', p_channel_row);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'content_channel.published_manually',
    'content_channel', p_channel_row,
    jsonb_build_object('item_id', v_row.content_item_id, 'revision_id', v_item.approved_revision_id)
  );
  return jsonb_build_object('id', p_channel_row, 'version', v_version);
end;
$$;

create function public.comment_add(p_item uuid, p_visibility text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
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
  select * into v_item from public.content_items i where i.id = p_item;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_item.brand_id);

  insert into public.comments (brand_id, item_id, revision_id, author_id, visibility, body)
  values (v_item.brand_id, p_item, v_item.current_revision_id, auth.uid(), p_visibility, v_body)
  returning id into v_id;
  perform public.audit_write(
    public.current_organization_id(), v_item.brand_id, 'comment.created', 'comment', v_id,
    jsonb_build_object('visibility', p_visibility, 'item_id', p_item)
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
    jsonb_build_object('visibility', v_comment.visibility, 'item_id', v_comment.item_id)
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
  v_item public.content_items;
  v_names text;
  v_new uuid;
begin
  perform public.assert_action('content.submit');
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_item from public.content_items i where i.id = v_request.item_id for update;
  perform public.assert_brand_access(v_item.brand_id);
  select * into v_request from public.approval_requests q where q.id = p_request for update;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if v_item.current_revision_id is distinct from v_request.revision_id then
    raise exception 'revision_superseded';
  end if;
  if p_new_approver is null then
    raise exception 'approver_required';
  end if;
  if p_new_approver = v_request.approver_user_id
    or not public.approver_is_valid(v_item.brand_id, p_new_approver) then
    raise exception 'approver_without_access';
  end if;

  update public.approval_requests set status = 'superseded', decided_at = now() where id = p_request;
  perform public.resolve_notifications('approval_request', p_request);
  insert into public.approval_requests (
    brand_id, item_id, revision_id, approver_user_id, requested_by, due_date, message
  )
  values (
    v_request.brand_id, v_request.item_id, v_request.revision_id, p_new_approver, auth.uid(),
    v_request.due_date, v_request.message
  )
  returning id into v_new;

  select string_agg(c ->> 'profile_name', ', ') into v_names
  from public.content_revisions r, jsonb_array_elements(r.snapshot -> 'channels') c
  where r.id = v_request.revision_id;
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
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_names),
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
  v_item public.content_items;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_item_id uuid;
begin
  perform public.assert_action('content.submit');
  if char_length(v_reason) < 3 then
    raise exception 'reason_required';
  end if;
  select q.item_id into v_item_id from public.approval_requests q where q.id = p_request;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_item from public.content_items i where i.id = v_item_id for update;
  perform public.assert_brand_access(v_item.brand_id);
  select * into v_request from public.approval_requests q where q.id = p_request for update;
  if v_request.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;

  update public.approval_requests
  set status = 'cancelled', cancelled_reason = v_reason, decided_at = now()
  where id = p_request;
  perform public.resolve_notifications('approval_request', p_request);
  if v_item.editorial_status = 'awaiting_approval' then
    update public.content_items
    set editorial_status = 'in_production', version = version + 1
    where id = v_item_id;
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
  v_item public.content_items;
  v_names text;
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
  select * into v_item from public.content_items i where i.id = v_request.item_id;
  select string_agg(c ->> 'profile_name', ', ') into v_names
  from public.content_revisions r, jsonb_array_elements(r.snapshot -> 'channels') c
  where r.id = v_request.revision_id;
  perform public.notify_users(
    'approval.requested', v_request.brand_id, 'Nova aprovação pendente',
    format('O conteúdo «%s» (%s) aguarda sua decisão.', v_item.title, v_names),
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

create function public.comment_list(p_item uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  select i.brand_id into v_brand from public.content_items i where i.id = p_item;
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
      where c.item_id = p_item and c.deleted_at is null
        and (
          (c.visibility = 'internal' and public.has_action('content.view'))
          or (c.visibility = 'external' and (public.has_action('approvals.view') or public.has_action('content.view')))
        )
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.audit_write(
  p_org uuid,
  p_brand uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog constant text[] := array[
    'invitation.created',
    'invitation.revoked',
    'invitation.accepted',
    'client.created',
    'client.updated',
    'client.owner_changed',
    'client.archived',
    'client.reactivated',
    'client.deleted',
    'contact.created',
    'contact.updated',
    'contact.deleted',
    'brand.created',
    'brand.updated',
    'brand.timezone_changed',
    'brand.archived',
    'brand.reactivated',
    'brand.deleted',
    'brand.member_added',
    'brand.member_revoked',
    'brand.member_can_decide_changed',
    'channel.created',
    'channel.updated',
    'channel.archived',
    'channel.reactivated',
    'channel.deleted',
    'content.created',
    'content.updated',
    'content.submitted',
    'content.reopened',
    'content.cancelled',
    'content.deleted',
    'content_channel.added',
    'content_channel.removed',
    'content_channel.rescheduled',
    'content_channel.published_manually',
    'content_channel.cancelled',
    'calendar_note.created',
    'calendar_note.updated',
    'calendar_note.archived',
    'calendar_note.converted',
    'variant.created',
    'variant.updated',
    'variant.submitted',
    'variant.reopened',
    'variant.rescheduled',
    'variant.cancelled',
    'variant.published_manually',
    'comment.created',
    'comment.deleted',
    'approval.requested',
    'approval.decided',
    'approval.superseded',
    'approval.cancelled',
    'approval.approver_reassigned',
    'approval.reminder_sent',
    'media.published',
    'media.unpublished',
    'media.deleted_permanently',
    'media.version_replaced',
    'media.share_created',
    'media.share_revoked',
    'site.page_published',
    'site.page_unpublished',
    'site.rolled_back',
    'site.case_study_authorized',
    'site.case_study_withdrawn',
    'site.settings_changed',
    'settings.policy_changed',
    'organization.updated',
    'audit.exported'
  ];
  v_actor uuid := auth.uid();
  v_kind text;
  v_request text;
begin
  if not (p_action = any (v_catalog)) then
    raise exception 'invalid_input';
  end if;

  if v_actor is null then
    v_kind := 'system';
  else
    select p.kind into v_kind from public.profiles p where p.id = v_actor;
    v_kind := coalesce(v_kind, 'internal');
  end if;

  begin
    v_request := (current_setting('request.headers', true)::jsonb) ->> 'x-request-id';
  exception when others then
    v_request := null;
  end;

  insert into public.audit_events (
    organization_id, brand_id, actor_id, actor_kind, action, entity_type, entity_id, metadata,
    request_id
  )
  values (
    p_org, p_brand, v_actor, v_kind, p_action, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), v_request
  );
end;
$$;

revoke execute on function public.content_channels_signature(uuid),
  public.content_cancel_pending_requests(uuid, text), public.content_item_save(jsonb),
  public.content_item_cancel(uuid, text), public.content_item_delete(uuid),
  public.content_move(uuid, text, int), public.content_channel_cancel(uuid, text),
  public.submit_for_approval(uuid, uuid, date, text, int), public.reopen_content(uuid, text),
  public.mark_published(uuid, timestamptz, text, uuid, text), public.comment_add(uuid, text, text),
  public.comment_delete(uuid), public.reassign_approver(uuid, uuid), public.cancel_request(uuid, text),
  public.send_approval_reminder(uuid), public.comment_list(uuid)
  from public, anon;

grant execute on function public.content_item_save(jsonb), public.content_item_cancel(uuid, text),
  public.content_item_delete(uuid), public.content_move(uuid, text, int),
  public.content_channel_cancel(uuid, text),
  public.submit_for_approval(uuid, uuid, date, text, int), public.reopen_content(uuid, text),
  public.mark_published(uuid, timestamptz, text, uuid, text), public.comment_add(uuid, text, text),
  public.comment_delete(uuid), public.reassign_approver(uuid, uuid), public.cancel_request(uuid, text),
  public.send_approval_reminder(uuid), public.comment_list(uuid)
  to authenticated;

revoke execute on function public.content_channels_signature(uuid),
  public.content_cancel_pending_requests(uuid, text) from authenticated;

commit;

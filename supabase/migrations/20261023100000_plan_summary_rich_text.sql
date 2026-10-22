begin;

alter table public.content_items add column plan_summary_doc jsonb;

update public.content_items c
set plan_summary_doc = (
  select jsonb_build_object('type', 'doc', 'content', jsonb_agg(
    jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', t.part))
    ) order by t.ord
  ))
  from regexp_split_to_table(c.plan_summary, E'\n{2,}') with ordinality as t(part, ord)
  where btrim(t.part) <> ''
)
where c.plan_summary is not null and btrim(c.plan_summary) <> '';

alter table public.content_items drop column plan_summary;
alter table public.content_items rename column plan_summary_doc to plan_summary;
alter table public.content_items
  add constraint content_items_plan_summary_check
  check (plan_summary is null or jsonb_typeof(plan_summary) = 'object');

create or replace function public.content_item_save(p_item jsonb)
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
  v_plan_media jsonb := public.content_normalize_media(p_item -> 'plan_media');
  v_plan_summary jsonb := case when jsonb_typeof(p_item -> 'plan_summary') = 'object' then p_item -> 'plan_summary' else null end;
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
  v_plan_signature jsonb := '[]'::jsonb;
  v_plan_required boolean;
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
    or octet_length(coalesce(v_plan_summary::text, '')) > 100000
    or jsonb_array_length(v_plan_media) > 10
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

  v_plan_required := case when v_is_new then public.plan_approval_required() else v_old.plan_required end;
  perform public.content_check_media(v_brand, v_media);
  perform public.content_check_media(v_brand, v_plan_media);
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
    v_plan_signature := v_plan_signature || jsonb_build_array(jsonb_build_object(
      'channel_id', v_channel, 'format', v_format, 'planned_at', v_planned
    ));
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'id', nullif(v_row ->> 'id', ''), 'channel_id', v_channel, 'format', v_format,
      'caption', v_row_caption, 'planned_at', v_planned, 'planned_timezone', v_tz
    ));
  end loop;

  if not v_is_new and v_old.plan_approved_revision_id is not null and (
    v_plan_signature is distinct from public.content_plan_signature(v_id)
    or v_objective_kind is distinct from v_old.objective_kind
    or v_objective is distinct from v_old.objective
    or v_plan_summary is distinct from v_old.plan_summary
    or v_plan_media is distinct from v_old.plan_media
  ) then
    raise exception 'plan_locked';
  end if;

  if not v_is_new and v_old.editorial_status in ('approved', 'published') and (
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
      production_due_date, caption, call_to_action, working_media, plan_required, plan_summary,
      plan_media, editorial_status, created_by
    )
    values (
      v_brand, v_title, v_objective, v_objective_kind, v_briefing, v_notes, v_assignee, v_tags, v_due,
      v_caption, v_cta, v_media, v_plan_required, v_plan_summary, v_plan_media,
      case when v_plan_required then 'planning' else 'draft' end, auth.uid()
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
        working_media = v_media, plan_summary = v_plan_summary, plan_media = v_plan_media,
        version = version + 1
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
    'plan_summary', r.snapshot -> 'plan_summary',
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

create or replace function public.portal_get_approval(p_request uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_request public.approval_requests;
  v_item public.content_items;
  v_revision public.content_revisions;
  v_decision public.approval_decisions;
  v_current uuid;
begin
  if not public.has_action('portal.view') then
    raise exception 'denied';
  end if;
  select * into v_request from public.approval_requests q where q.id = p_request;
  if not found or not public.is_external_brand_member(v_request.brand_id) then
    raise exception 'not_found';
  end if;
  select * into v_item from public.content_items i where i.id = v_request.item_id;
  select * into v_revision from public.content_revisions r where r.id = v_request.revision_id;
  select * into v_decision from public.approval_decisions d where d.request_id = p_request;
  select q.id into v_current
  from public.approval_requests q
  where q.item_id = v_request.item_id and q.status <> 'cancelled'
    and q.revision_id = v_item.current_revision_id
  order by (q.status = 'pending') desc, q.requested_at desc
  limit 1;

  return jsonb_build_object(
    'request', public.portal_request_row(v_request),
    'brand_id', v_request.brand_id,
    'brand_name', (select b.name from public.brands b where b.id = v_request.brand_id),
    'message', v_request.message,
    'caption', v_revision.snapshot -> 'caption',
    'call_to_action', v_revision.snapshot ->> 'call_to_action',
    'revision_id', v_revision.id,
    'is_current', v_item.current_revision_id = v_request.revision_id,
    'current_request_id', case when v_current is distinct from p_request then v_current else null end,
    'stage', v_request.stage,
    'plan_summary', v_revision.snapshot -> 'plan_summary',
    'objective_kind', v_revision.snapshot ->> 'objective_kind',
    'can_decide', v_request.status = 'pending'
      and v_item.current_revision_id = v_request.revision_id
      and public.has_action('approvals.decide')
      and public.approver_is_valid(v_request.brand_id, auth.uid()),
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
        where h.item_id = v_request.item_id and h.id <> p_request and h.status <> 'cancelled'
      ),
      '[]'::jsonb
    )
  );
end;
$$;

commit;

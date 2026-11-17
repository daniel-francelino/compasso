begin;

alter table public.media_usages drop constraint media_usages_usage_type_check;
alter table public.media_usages add constraint media_usages_usage_type_check check (usage_type in (
  'content_revision', 'site_page_revision', 'case_study', 'brand_identity', 'publication_evidence',
  'profile_avatar', 'design_version'
));

alter table public.designs add column is_template boolean not null default false;
create index designs_template_idx on public.designs (brand_id) where is_template and trashed_at is null;

create table public.design_exports (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null,
  brand_id uuid not null,
  version_no int not null,
  page_no int not null check (page_no between 1 and 10),
  format text not null check (format in ('png', 'jpeg')),
  scale smallint not null check (scale in (1, 2)),
  media_asset_id uuid not null references public.media_assets (id),
  media_version_id uuid not null unique references public.media_versions (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (design_id, brand_id) references public.designs (id, brand_id),
  foreign key (design_id, version_no) references public.design_versions (design_id, version_no)
);

create index design_exports_design_idx on public.design_exports (design_id, page_no, created_at desc);
create index design_exports_brand_idx on public.design_exports (brand_id);

alter table public.design_exports enable row level security;

create policy design_exports_read on public.design_exports for select
  using (public.has_action('design.view') and public.can_access_brand(brand_id));

revoke all on public.design_exports from public, anon, authenticated;
grant select on public.design_exports to authenticated;

create function public.design_upgrade_document(p_document jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_document -> 'version' = '1'::jsonb then jsonb_build_object(
      'version', 2,
      'pages', jsonb_build_array(jsonb_build_object(
        'id', 'page-1',
        'background', coalesce(p_document -> 'background', 'null'::jsonb),
        'elements', coalesce(p_document -> 'elements', '[]'::jsonb)
      ))
    )
    else p_document
  end
$$;

update public.designs
set draft_document = public.design_upgrade_document(draft_document)
where draft_document -> 'version' = '1'::jsonb;

create or replace function public.design_assert_document(p_document jsonb, p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page jsonb;
  v_element jsonb;
  v_media text;
  v_total int := 0;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
     or p_document -> 'version' is distinct from '2'::jsonb
     or coalesce(jsonb_typeof(p_document -> 'pages'), 'missing') <> 'array'
     or jsonb_array_length(p_document -> 'pages') < 1 then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_document::text) > 262144 or jsonb_array_length(p_document -> 'pages') > 10 then
    raise exception 'design_too_large';
  end if;

  for v_page in select p from jsonb_array_elements(p_document -> 'pages') p loop
    if jsonb_typeof(v_page) <> 'object'
       or coalesce(jsonb_typeof(v_page -> 'id'), 'missing') <> 'string'
       or coalesce(jsonb_typeof(v_page -> 'elements'), 'missing') <> 'array'
       or coalesce(jsonb_typeof(v_page -> 'background'), 'missing') not in ('string', 'null') then
      raise exception 'invalid_input';
    end if;
    if jsonb_typeof(v_page -> 'background') = 'string'
       and (v_page ->> 'background') !~ '^#[0-9a-f]{6}$' then
      raise exception 'invalid_input';
    end if;
    v_total := v_total + jsonb_array_length(v_page -> 'elements');
    if v_total > 100 then
      raise exception 'design_too_large';
    end if;

    for v_element in select e from jsonb_array_elements(v_page -> 'elements') e loop
      if jsonb_typeof(v_element) <> 'object'
         or coalesce(jsonb_typeof(v_element -> 'id'), 'missing') <> 'string'
         or coalesce(v_element ->> 'kind', '') not in ('text', 'image', 'rect', 'ellipse', 'line') then
        raise exception 'invalid_input';
      end if;
      continue when v_element ->> 'kind' <> 'image';
      v_media := v_element ->> 'mediaVersionId';
      if v_media is null
         or v_media !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or not exists (
           select 1
           from public.media_versions mv
           join public.media_assets ma on ma.id = mv.asset_id
           where mv.id = v_media::uuid and ma.brand_id = p_brand and mv.mime_type like 'image/%'
         ) then
        raise exception 'invalid_input';
      end if;
    end loop;
  end loop;
end;
$$;

drop function public.design_create(uuid, text, text);

create function public.design_create(
  p_brand uuid,
  p_name text,
  p_preset text,
  p_document jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_document jsonb := coalesce(p_document, jsonb_build_object(
    'version', 2,
    'pages', jsonb_build_array(jsonb_build_object(
      'id', 'page-1', 'background', null, 'elements', '[]'::jsonb
    ))
  ));
  v_id uuid;
begin
  perform public.assert_action('design.create');
  perform public.assert_brand_access(p_brand);
  if char_length(v_name) not between 1 and 120
     or coalesce(p_preset, '') not in ('feed_square', 'feed_portrait', 'story') then
    raise exception 'invalid_input';
  end if;
  perform public.design_assert_document(v_document, p_brand);

  insert into public.designs (brand_id, name, preset, draft_document, created_by)
  values (p_brand, v_name, p_preset, v_document, auth.uid())
  returning id into v_id;

  perform public.audit_write(public.current_organization_id(), p_brand, 'design.created', 'design',
    v_id, jsonb_build_object('preset', p_preset));
  return jsonb_build_object('id', v_id, 'version', 1);
end;
$$;

create or replace function public.design_save_version(p_design uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_document jsonb;
  v_no int;
  v_version_id uuid;
  v_version int;
begin
  perform public.assert_action('design.update');
  v_row := public.design_lock(p_design, p_expected_version);
  v_no := v_row.current_version_no + 1;
  v_document := public.design_upgrade_document(v_row.draft_document);

  insert into public.design_versions (design_id, brand_id, version_no, document, created_by)
  values (v_row.id, v_row.brand_id, v_no, v_document, auth.uid())
  returning id into v_version_id;

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
  select distinct mv.id, 'design_version', v_version_id
  from jsonb_array_elements(v_document -> 'pages') p,
       jsonb_array_elements(p -> 'elements') e
  join public.media_versions mv on mv.id::text = e ->> 'mediaVersionId'
  where e ->> 'kind' = 'image'
  on conflict do nothing;

  update public.designs
  set current_version_no = v_no, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.version_saved', 'design', v_row.id, jsonb_build_object('version_no', v_no));
  return jsonb_build_object('version', v_version, 'version_no', v_no);
end;
$$;

create function public.design_restore_version(
  p_design uuid,
  p_version_no int,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_document jsonb;
  v_version int;
begin
  perform public.assert_action('design.update');
  v_row := public.design_lock(p_design, p_expected_version);
  select dv.document into v_document
  from public.design_versions dv
  where dv.design_id = v_row.id and dv.version_no = p_version_no;
  if not found then
    raise exception 'not_found';
  end if;

  update public.designs
  set draft_document = public.design_upgrade_document(v_document), version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.version_restored', 'design', v_row.id, jsonb_build_object('version_no', p_version_no));
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.design_set_template(
  p_design uuid,
  p_template boolean,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_version int;
begin
  perform public.assert_action('design.update');
  if p_template is null then
    raise exception 'invalid_input';
  end if;
  v_row := public.design_lock(p_design, p_expected_version);
  if v_row.is_template = p_template then
    return jsonb_build_object('version', v_row.version);
  end if;

  update public.designs
  set is_template = p_template, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.template_changed', 'design', v_row.id, jsonb_build_object('is_template', p_template));
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.design_record_export(
  p_design uuid,
  p_version_no int,
  p_page_no int,
  p_format text,
  p_scale int,
  p_media_version uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_document jsonb;
  v_asset uuid;
  v_id uuid;
begin
  perform public.assert_action('design.update');
  select * into v_row from public.designs d where d.id = p_design;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if v_row.trashed_at is not null then
    raise exception 'design_trashed';
  end if;
  if coalesce(p_format, '') not in ('png', 'jpeg') or coalesce(p_scale, 0) not in (1, 2)
     or coalesce(p_page_no, 0) not between 1 and 10 then
    raise exception 'invalid_input';
  end if;

  select dv.document into v_document
  from public.design_versions dv
  where dv.design_id = v_row.id and dv.version_no = p_version_no;
  if not found then
    raise exception 'not_found';
  end if;
  if jsonb_array_length(public.design_upgrade_document(v_document) -> 'pages') < p_page_no then
    raise exception 'invalid_input';
  end if;

  select mv.asset_id into v_asset
  from public.media_versions mv
  join public.media_assets ma on ma.id = mv.asset_id
  where mv.id = p_media_version
    and ma.brand_id = v_row.brand_id
    and mv.status = 'available'
    and mv.uploaded_by = auth.uid()
    and mv.mime_type = case p_format when 'png' then 'image/png' else 'image/jpeg' end;
  if not found then
    raise exception 'invalid_input';
  end if;

  insert into public.design_exports (
    design_id, brand_id, version_no, page_no, format, scale, media_asset_id, media_version_id,
    created_by
  )
  values (
    v_row.id, v_row.brand_id, p_version_no, p_page_no, p_format, p_scale, v_asset, p_media_version,
    auth.uid()
  )
  returning id into v_id;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id, 'design.exported',
    'design', v_row.id,
    jsonb_build_object('version_no', p_version_no, 'page_no', p_page_no, 'format', p_format));
  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.design_upgrade_document(jsonb) from public, anon, authenticated;

revoke execute on function
  public.design_create(uuid, text, text, jsonb), public.design_restore_version(uuid, int, int),
  public.design_set_template(uuid, boolean, int),
  public.design_record_export(uuid, int, int, text, int, uuid)
from public, anon;
grant execute on function
  public.design_create(uuid, text, text, jsonb), public.design_restore_version(uuid, int, int),
  public.design_set_template(uuid, boolean, int),
  public.design_record_export(uuid, int, int, text, int, uuid)
to authenticated;

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
    'content.published',
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
    'comment.edited',
    'approval.requested',
    'approval.decided',
    'approval.superseded',
    'approval.approved_by_team',
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
    'content_type.saved',
    'content_type.archived',
    'organization.updated',
    'channel.connected',
    'channel.disconnected',
    'channel.connection_lost',
    'content_channel.published_auto',
    'content_channel.publish_failed',
    'content_channel.publish_mode_changed',
    'content_channel.publish_requested',
    'metric_mark.created',
    'metric_mark.updated',
    'metric_mark.deleted',
    'metrics_report.published',
    'metrics_report.withdrawn',
    'feedback.answered',
    'feedback.declined',
    'design.created',
    'design.version_saved',
    'design.trashed',
    'design.restored',
    'design.exported',
    'design.version_restored',
    'design.template_changed',
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

commit;

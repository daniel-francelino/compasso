begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('video.view', 'video', 'Open the video projects of linked brands', false, false, '{brands.view}'),
  ('video.create', 'video', 'Create video projects', false, false, '{video.view}'),
  ('video.update', 'video', 'Edit, rename, save versions and export video projects', false, false, '{video.view}'),
  ('video.delete', 'video', 'Move video projects to the trash and restore them', false, false, '{video.view}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, a.key
from public.roles r
join (values
  ('manager', 'video.view'),
  ('manager', 'video.create'),
  ('manager', 'video.update'),
  ('manager', 'video.delete'),
  ('collaborator', 'video.view'),
  ('collaborator', 'video.create'),
  ('collaborator', 'video.update')
) as a (role_key, key) on a.role_key = r.key
on conflict do nothing;

alter table public.media_usages drop constraint media_usages_usage_type_check;
alter table public.media_usages add constraint media_usages_usage_type_check check (usage_type in (
  'content_revision', 'site_page_revision', 'case_study', 'brand_identity', 'publication_evidence',
  'profile_avatar', 'design_version', 'video_project_version'
));

create table public.video_projects (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  name text not null check (char_length(name) between 1 and 120),
  preset text not null check (preset in ('feed_square', 'feed_portrait', 'story')),
  draft_document jsonb not null check (jsonb_typeof(draft_document) = 'object'),
  current_version_no int not null default 0 check (current_version_no >= 0),
  version int not null default 1,
  trashed_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_id)
);

create index video_projects_brand_idx on public.video_projects (brand_id, updated_at desc);
create index video_projects_name_idx on public.video_projects (lower(name));

create table public.video_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  brand_id uuid not null,
  version_no int not null check (version_no >= 1),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  duration_ms int not null check (duration_ms between 1 and 90000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (project_id, version_no),
  foreign key (project_id, brand_id) references public.video_projects (id, brand_id)
);

create index video_project_versions_brand_idx on public.video_project_versions (brand_id);

create table public.video_exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  brand_id uuid not null,
  version_no int not null,
  media_asset_id uuid not null references public.media_assets (id),
  media_version_id uuid not null unique references public.media_versions (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (project_id, brand_id) references public.video_projects (id, brand_id),
  foreign key (project_id, version_no) references public.video_project_versions (project_id, version_no)
);

create index video_exports_project_idx on public.video_exports (project_id, created_at desc);
create index video_exports_brand_idx on public.video_exports (brand_id);

alter table public.video_projects enable row level security;
alter table public.video_project_versions enable row level security;
alter table public.video_exports enable row level security;

create policy video_projects_read on public.video_projects for select
  using (public.has_action('video.view') and public.can_access_brand(brand_id));
create policy video_project_versions_read on public.video_project_versions for select
  using (public.has_action('video.view') and public.can_access_brand(brand_id));
create policy video_exports_read on public.video_exports for select
  using (public.has_action('video.view') and public.can_access_brand(brand_id));

revoke all on public.video_projects from public, anon, authenticated;
revoke all on public.video_project_versions from public, anon, authenticated;
revoke all on public.video_exports from public, anon, authenticated;
grant select on public.video_projects to authenticated;
grant select on public.video_project_versions to authenticated;
grant select on public.video_exports to authenticated;

create trigger video_projects_set_updated_at before update on public.video_projects
for each row execute function public.set_updated_at();

create function public.video_project_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'video_version_immutable';
end;
$$;

create trigger video_project_versions_immutable
before update or delete on public.video_project_versions
for each row execute function public.video_project_versions_immutable();

create function public.video_assert_document(p_document jsonb, p_brand uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_track text;
  v_clip jsonb;
  v_kind text;
  v_media text;
  v_duration int;
  v_start int;
  v_main int := 0;
  v_end int := 0;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
     or p_document -> 'version' is distinct from '1'::jsonb
     or coalesce(jsonb_typeof(p_document -> 'main'), 'missing') <> 'array'
     or coalesce(jsonb_typeof(p_document -> 'overlays'), 'missing') <> 'array'
     or coalesce(jsonb_typeof(p_document -> 'texts'), 'missing') <> 'array'
     or coalesce(jsonb_typeof(p_document -> 'audio'), 'missing') <> 'array'
     or coalesce(p_document ->> 'background', '') !~ '^#[0-9a-f]{6}$' then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_document::text) > 262144
     or jsonb_array_length(p_document -> 'main') > 50
     or jsonb_array_length(p_document -> 'overlays') > 20
     or jsonb_array_length(p_document -> 'texts') > 30
     or jsonb_array_length(p_document -> 'audio') > 5 then
    raise exception 'video_too_large';
  end if;

  foreach v_track in array array['main', 'overlays', 'texts', 'audio'] loop
    for v_clip in select e from jsonb_array_elements(p_document -> v_track) e loop
      if jsonb_typeof(v_clip) <> 'object'
         or coalesce(jsonb_typeof(v_clip -> 'id'), 'missing') <> 'string'
         or coalesce(v_clip ->> 'durationMs', '') !~ '^[0-9]{1,6}$' then
        raise exception 'invalid_input';
      end if;
      v_duration := (v_clip ->> 'durationMs')::int;
      if v_duration not between 100 and 90000 then
        raise exception 'invalid_input';
      end if;

      if v_track = 'main' then
        v_main := v_main + v_duration;
      else
        if coalesce(v_clip ->> 'startMs', '') !~ '^[0-9]{1,6}$' then
          raise exception 'invalid_input';
        end if;
        v_start := (v_clip ->> 'startMs')::int;
        v_end := greatest(v_end, v_start + v_duration);
      end if;

      continue when v_track = 'texts';
      v_kind := case v_track when 'main' then v_clip ->> 'kind' when 'overlays' then 'image' else 'video' end;
      v_media := v_clip ->> 'mediaVersionId';
      if coalesce(v_kind, '') not in ('video', 'image')
         or v_media is null
         or v_media !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or not exists (
           select 1
           from public.media_versions mv
           join public.media_assets ma on ma.id = mv.asset_id
           where mv.id = v_media::uuid and ma.brand_id = p_brand and mv.mime_type like v_kind || '/%'
         ) then
        raise exception 'invalid_input';
      end if;
    end loop;
  end loop;

  if greatest(v_main, v_end) > 90000 then
    raise exception 'video_too_long';
  end if;
  return greatest(v_main, v_end);
end;
$$;

create function public.video_project_lock(p_project uuid, p_expected_version int)
returns public.video_projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.video_projects;
begin
  select * into v_row from public.video_projects p where p.id = p_project for update;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if v_row.trashed_at is not null then
    raise exception 'video_trashed';
  end if;
  if p_expected_version is distinct from v_row.version then
    raise exception 'conflict';
  end if;
  return v_row;
end;
$$;

create function public.video_project_create(
  p_brand uuid,
  p_name text,
  p_preset text,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  perform public.assert_action('video.create');
  perform public.assert_brand_access(p_brand);
  if char_length(v_name) not between 1 and 120
     or coalesce(p_preset, '') not in ('feed_square', 'feed_portrait', 'story') then
    raise exception 'invalid_input';
  end if;
  perform public.video_assert_document(p_document, p_brand);

  insert into public.video_projects (brand_id, name, preset, draft_document, created_by)
  values (p_brand, v_name, p_preset, p_document, auth.uid())
  returning id into v_id;

  perform public.audit_write(public.current_organization_id(), p_brand, 'video.created',
    'video_project', v_id, jsonb_build_object('preset', p_preset));
  return jsonb_build_object('id', v_id, 'version', 1);
end;
$$;

create function public.video_project_save_draft(
  p_project uuid,
  p_document jsonb,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.video_projects;
  v_version int;
begin
  perform public.assert_action('video.update');
  v_row := public.video_project_lock(p_project, p_expected_version);
  perform public.video_assert_document(p_document, v_row.brand_id);

  update public.video_projects
  set draft_document = p_document, version = version + 1
  where id = v_row.id
  returning version into v_version;
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.video_project_rename(p_project uuid, p_name text, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_row public.video_projects;
  v_version int;
begin
  perform public.assert_action('video.update');
  v_row := public.video_project_lock(p_project, p_expected_version);
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_input';
  end if;

  update public.video_projects
  set name = v_name, version = version + 1
  where id = v_row.id
  returning version into v_version;
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.video_project_save_version(p_project uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.video_projects;
  v_duration int;
  v_no int;
  v_version_id uuid;
  v_version int;
begin
  perform public.assert_action('video.update');
  v_row := public.video_project_lock(p_project, p_expected_version);
  v_duration := public.video_assert_document(v_row.draft_document, v_row.brand_id);
  if v_duration < 1 then
    raise exception 'video_empty';
  end if;
  v_no := v_row.current_version_no + 1;

  insert into public.video_project_versions (
    project_id, brand_id, version_no, document, duration_ms, created_by
  )
  values (v_row.id, v_row.brand_id, v_no, v_row.draft_document, v_duration, auth.uid())
  returning id into v_version_id;

  insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
  select distinct mv.id, 'video_project_version', v_version_id
  from (
    select e ->> 'mediaVersionId' as media from jsonb_array_elements(v_row.draft_document -> 'main') e
    union
    select e ->> 'mediaVersionId' from jsonb_array_elements(v_row.draft_document -> 'overlays') e
    union
    select e ->> 'mediaVersionId' from jsonb_array_elements(v_row.draft_document -> 'audio') e
  ) refs
  join public.media_versions mv on mv.id::text = refs.media
  on conflict do nothing;

  update public.video_projects
  set current_version_no = v_no, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'video.version_saved', 'video_project', v_row.id,
    jsonb_build_object('version_no', v_no, 'duration_ms', v_duration));
  return jsonb_build_object('version', v_version, 'version_no', v_no);
end;
$$;

create function public.video_project_set_trashed(p_project uuid, p_trashed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.video_projects;
  v_version int;
begin
  perform public.assert_action('video.delete');
  if p_trashed is null then
    raise exception 'invalid_input';
  end if;
  select * into v_row from public.video_projects p where p.id = p_project for update;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if (v_row.trashed_at is not null) = p_trashed then
    return jsonb_build_object('version', v_row.version);
  end if;

  update public.video_projects
  set trashed_at = case when p_trashed then now() else null end, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    case when p_trashed then 'video.trashed' else 'video.restored' end, 'video_project', v_row.id,
    '{}'::jsonb);
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.video_project_record_export(
  p_project uuid,
  p_version_no int,
  p_media_version uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.video_projects;
  v_asset uuid;
  v_id uuid;
begin
  perform public.assert_action('video.update');
  select * into v_row from public.video_projects p where p.id = p_project;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if v_row.trashed_at is not null then
    raise exception 'video_trashed';
  end if;
  if not exists (
    select 1 from public.video_project_versions v
    where v.project_id = v_row.id and v.version_no = p_version_no
  ) then
    raise exception 'not_found';
  end if;

  select mv.asset_id into v_asset
  from public.media_versions mv
  join public.media_assets ma on ma.id = mv.asset_id
  where mv.id = p_media_version
    and ma.brand_id = v_row.brand_id
    and mv.status = 'available'
    and mv.uploaded_by = auth.uid()
    and mv.mime_type = 'video/mp4';
  if not found then
    raise exception 'invalid_input';
  end if;

  insert into public.video_exports (
    project_id, brand_id, version_no, media_asset_id, media_version_id, created_by
  )
  values (v_row.id, v_row.brand_id, p_version_no, v_asset, p_media_version, auth.uid())
  returning id into v_id;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id, 'video.exported',
    'video_project', v_row.id, jsonb_build_object('version_no', p_version_no));
  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function
  public.video_project_versions_immutable(), public.video_assert_document(jsonb, uuid),
  public.video_project_lock(uuid, int)
from public, anon, authenticated;

revoke execute on function
  public.video_project_create(uuid, text, text, jsonb),
  public.video_project_save_draft(uuid, jsonb, int),
  public.video_project_rename(uuid, text, int),
  public.video_project_save_version(uuid, int),
  public.video_project_set_trashed(uuid, boolean),
  public.video_project_record_export(uuid, int, uuid)
from public, anon;
grant execute on function
  public.video_project_create(uuid, text, text, jsonb),
  public.video_project_save_draft(uuid, jsonb, int),
  public.video_project_rename(uuid, text, int),
  public.video_project_save_version(uuid, int),
  public.video_project_set_trashed(uuid, boolean),
  public.video_project_record_export(uuid, int, uuid)
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
    'video.created',
    'video.version_saved',
    'video.trashed',
    'video.restored',
    'video.exported',
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

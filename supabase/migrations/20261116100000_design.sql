begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('design.view', 'design', 'Open the designs of linked brands', false, false, '{brands.view}'),
  ('design.create', 'design', 'Create designs', false, false, '{design.view}'),
  ('design.update', 'design', 'Edit, rename and save versions of designs', false, false, '{design.view}'),
  ('design.delete', 'design', 'Move designs to the trash and restore them', false, false, '{design.view}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, a.key
from public.roles r
join (values
  ('manager', 'design.view'),
  ('manager', 'design.create'),
  ('manager', 'design.update'),
  ('manager', 'design.delete'),
  ('collaborator', 'design.view'),
  ('collaborator', 'design.create'),
  ('collaborator', 'design.update')
) as a (role_key, key) on a.role_key = r.key
on conflict do nothing;

create table public.designs (
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

create index designs_brand_idx on public.designs (brand_id, updated_at desc);
create index designs_name_idx on public.designs (lower(name));

create table public.design_versions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null,
  brand_id uuid not null,
  version_no int not null check (version_no >= 1),
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (design_id, version_no),
  foreign key (design_id, brand_id) references public.designs (id, brand_id)
);

create index design_versions_brand_idx on public.design_versions (brand_id);

alter table public.designs enable row level security;
alter table public.design_versions enable row level security;

create policy designs_read on public.designs for select
  using (public.has_action('design.view') and public.can_access_brand(brand_id));
create policy design_versions_read on public.design_versions for select
  using (public.has_action('design.view') and public.can_access_brand(brand_id));

revoke all on public.designs from public, anon, authenticated;
revoke all on public.design_versions from public, anon, authenticated;
grant select on public.designs to authenticated;
grant select on public.design_versions to authenticated;

create trigger designs_set_updated_at before update on public.designs
for each row execute function public.set_updated_at();

create function public.design_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'design_version_immutable';
end;
$$;

create trigger design_versions_immutable before update or delete on public.design_versions
for each row execute function public.design_versions_immutable();

create function public.design_assert_document(p_document jsonb, p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_element jsonb;
  v_media text;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object'
     or p_document -> 'version' is distinct from '1'::jsonb
     or coalesce(jsonb_typeof(p_document -> 'elements'), 'missing') <> 'array'
     or coalesce(jsonb_typeof(p_document -> 'background'), 'missing') not in ('string', 'null') then
    raise exception 'invalid_input';
  end if;
  if jsonb_typeof(p_document -> 'background') = 'string'
     and (p_document ->> 'background') !~ '^#[0-9a-f]{6}$' then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_document::text) > 262144 or jsonb_array_length(p_document -> 'elements') > 100 then
    raise exception 'design_too_large';
  end if;

  for v_element in select e from jsonb_array_elements(p_document -> 'elements') e loop
    if jsonb_typeof(v_element) <> 'object'
       or coalesce(jsonb_typeof(v_element -> 'id'), 'missing') <> 'string'
       or coalesce(v_element ->> 'kind', '') not in ('text', 'image', 'rect', 'ellipse') then
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
end;
$$;

create function public.design_lock(p_design uuid, p_expected_version int)
returns public.designs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
begin
  select * into v_row from public.designs d where d.id = p_design for update;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if v_row.trashed_at is not null then
    raise exception 'design_trashed';
  end if;
  if p_expected_version is distinct from v_row.version then
    raise exception 'conflict';
  end if;
  return v_row;
end;
$$;

create function public.design_create(p_brand uuid, p_name text, p_preset text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  perform public.assert_action('design.create');
  perform public.assert_brand_access(p_brand);
  if char_length(v_name) not between 1 and 120
     or coalesce(p_preset, '') not in ('feed_square', 'feed_portrait', 'story') then
    raise exception 'invalid_input';
  end if;

  insert into public.designs (brand_id, name, preset, draft_document, created_by)
  values (
    p_brand, v_name, p_preset,
    jsonb_build_object('version', 1, 'background', null, 'elements', '[]'::jsonb),
    auth.uid()
  )
  returning id into v_id;

  perform public.audit_write(public.current_organization_id(), p_brand, 'design.created', 'design',
    v_id, jsonb_build_object('preset', p_preset));
  return jsonb_build_object('id', v_id, 'version', 1);
end;
$$;

create function public.design_save_draft(p_design uuid, p_document jsonb, p_expected_version int)
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
  v_row := public.design_lock(p_design, p_expected_version);
  perform public.design_assert_document(p_document, v_row.brand_id);

  update public.designs
  set draft_document = p_document, version = version + 1
  where id = v_row.id
  returning version into v_version;
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.design_rename(p_design uuid, p_name text, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_row public.designs;
  v_version int;
begin
  perform public.assert_action('design.update');
  v_row := public.design_lock(p_design, p_expected_version);
  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_input';
  end if;

  update public.designs
  set name = v_name, version = version + 1
  where id = v_row.id
  returning version into v_version;
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.design_save_version(p_design uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_no int;
  v_version int;
begin
  perform public.assert_action('design.update');
  v_row := public.design_lock(p_design, p_expected_version);
  v_no := v_row.current_version_no + 1;

  insert into public.design_versions (design_id, brand_id, version_no, document, created_by)
  values (v_row.id, v_row.brand_id, v_no, v_row.draft_document, auth.uid());

  update public.designs
  set current_version_no = v_no, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.version_saved', 'design', v_row.id, jsonb_build_object('version_no', v_no));
  return jsonb_build_object('version', v_version, 'version_no', v_no);
end;
$$;

create function public.design_set_trashed(p_design uuid, p_trashed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_version int;
begin
  perform public.assert_action('design.delete');
  if p_trashed is null then
    raise exception 'invalid_input';
  end if;
  select * into v_row from public.designs d where d.id = p_design for update;
  if not found or not public.can_access_brand(v_row.brand_id) then
    raise exception 'not_found';
  end if;
  if (v_row.trashed_at is not null) = p_trashed then
    return jsonb_build_object('version', v_row.version);
  end if;

  update public.designs
  set trashed_at = case when p_trashed then now() else null end, version = version + 1
  where id = v_row.id
  returning version into v_version;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    case when p_trashed then 'design.trashed' else 'design.restored' end, 'design', v_row.id,
    '{}'::jsonb);
  return jsonb_build_object('version', v_version);
end;
$$;

revoke execute on function
  public.design_versions_immutable(), public.design_assert_document(jsonb, uuid),
  public.design_lock(uuid, int)
from public, anon, authenticated;

revoke execute on function
  public.design_create(uuid, text, text), public.design_save_draft(uuid, jsonb, int),
  public.design_rename(uuid, text, int), public.design_save_version(uuid, int),
  public.design_set_trashed(uuid, boolean)
from public, anon;
grant execute on function
  public.design_create(uuid, text, text), public.design_save_draft(uuid, jsonb, int),
  public.design_rename(uuid, text, int), public.design_save_version(uuid, int),
  public.design_set_trashed(uuid, boolean)
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

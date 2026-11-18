begin;

create table public.design_import_metadata (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null,
  brand_id uuid not null,
  source_format text not null check (source_format ~ '^[a-z0-9_]{2,16}$'),
  metadata jsonb not null check (
    jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 1048576
  ),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (design_id, brand_id) references public.designs (id, brand_id) on delete cascade
);

create index design_import_metadata_design_idx on public.design_import_metadata (design_id, created_at desc);
create index design_import_metadata_brand_idx on public.design_import_metadata (brand_id);

alter table public.design_import_metadata enable row level security;

create policy design_import_metadata_read on public.design_import_metadata for select
  using (public.has_action('design.view') and public.can_access_brand(brand_id));

revoke all on public.design_import_metadata from public, anon, authenticated;
grant select on public.design_import_metadata to authenticated;

create function public.design_record_import(p_design uuid, p_metadata jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.designs;
  v_format text;
  v_layers jsonb;
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

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'invalid_input';
  end if;
  if octet_length(p_metadata::text) > 1048576 then
    raise exception 'design_import_metadata_too_large';
  end if;

  v_format := p_metadata -> 'source' ->> 'format';
  v_layers := p_metadata -> 'layers';
  if p_metadata -> 'version' is distinct from '1'::jsonb
     or jsonb_typeof(p_metadata -> 'source') is distinct from 'object'
     or jsonb_typeof(p_metadata -> 'source' -> 'format') is distinct from 'string'
     or v_format !~ '^[a-z0-9_]{2,16}$'
     or jsonb_typeof(v_layers) is distinct from 'array'
     or jsonb_array_length(v_layers) > 1000
     or jsonb_typeof(p_metadata -> 'textRuns') is distinct from 'array'
     or jsonb_array_length(p_metadata -> 'textRuns') <> 0 then
    raise exception 'invalid_input';
  end if;

  insert into public.design_import_metadata (design_id, brand_id, source_format, metadata, created_by)
  values (v_row.id, v_row.brand_id, v_format, p_metadata, auth.uid())
  returning id into v_id;

  perform public.audit_write(public.current_organization_id(), v_row.brand_id,
    'design.import_recorded', 'design', v_row.id,
    jsonb_build_object('format', v_format, 'layer_count', jsonb_array_length(v_layers)));
  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.design_record_import(uuid, jsonb) from public, anon;
grant execute on function public.design_record_import(uuid, jsonb) to authenticated;

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
    'design.hidden_purged',
    'design.import_recorded',
    'media.hidden_removed',
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

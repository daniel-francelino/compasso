begin;

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
values
  ('content.publish_failed', 'Falha ao publicar no Instagram', 'content.publish_manual', 'urgent', null, false, false, true, true),
  ('content.published_auto', 'Publicado automaticamente', 'content.view', 'info', null, false, false, false, true)
on conflict (kind) do nothing;

alter table public.content_channels
  add column publish_mode text not null default 'manual' check (publish_mode in ('manual', 'automatic')),
  add column auto_publish_state text check (
    auto_publish_state is null or auto_publish_state in ('publishing', 'failed')
  ),
  add column published_via text check (published_via is null or published_via in ('instagram_api')),
  add column external_media_id text check (external_media_id is null or char_length(external_media_id) <= 80),
  add column publish_retry_at timestamptz,
  add column attempt_count int not null default 0,
  add column last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80);

create index content_channels_auto_idx on public.content_channels (planned_at)
  where publish_mode = 'automatic' and publication_status = 'planned';

create table public.publish_attempts (
  id uuid primary key default gen_random_uuid(),
  channel_row_id uuid not null,
  brand_id uuid not null references public.brands (id),
  attempt_no int not null check (attempt_no >= 1),
  container_id text check (container_id is null or char_length(container_id) <= 80),
  status text not null default 'claimed' check (status in ('claimed', 'container_created', 'published', 'failed', 'uncertain', 'released')),
  error_code text check (error_code is null or char_length(error_code) <= 80),
  provider_error text check (provider_error is null or char_length(provider_error) <= 200),
  media_id text check (media_id is null or char_length(media_id) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_row_id, attempt_no),
  foreign key (channel_row_id, brand_id) references public.content_channels (id, brand_id)
);

create index publish_attempts_row_idx on public.publish_attempts (channel_row_id, attempt_no desc);
create index publish_attempts_open_idx on public.publish_attempts (updated_at)
  where status in ('claimed', 'container_created');

alter table public.publish_attempts enable row level security;
create policy publish_attempts_read on public.publish_attempts for select
  using (public.has_action('content.view') and public.can_access_brand(brand_id));
revoke all on public.publish_attempts from public, anon, authenticated;
grant select on public.publish_attempts to authenticated;

create trigger publish_attempts_set_updated_at before update on public.publish_attempts
for each row execute function public.set_updated_at();

create or replace function public.content_channels_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brand_id <> old.brand_id or new.content_item_id <> old.content_item_id then
    raise exception 'invalid_input';
  end if;
  if old.auto_publish_state = 'publishing'
    and coalesce(current_setting('compasso.publish_job', true), '') <> 'on'
    and (
      new.planned_at is distinct from old.planned_at
      or new.publication_status is distinct from old.publication_status
      or new.publish_mode is distinct from old.publish_mode
    ) then
    raise exception 'publish_in_progress';
  end if;
  if new.publication_status = 'published_manually' and old.publication_status <> 'published_manually'
    and new.published_via is null then
    new.auto_publish_state := null;
  end if;
  if new.planned_at is distinct from old.planned_at and old.auto_publish_state = 'failed' then
    new.auto_publish_state := null;
    new.last_error_code := null;
    new.publish_retry_at := null;
  end if;
  return new;
end;
$$;

create function public.publish_notify_failed(p_row uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.content_channels;
  v_title text;
begin
  select * into v_row from public.content_channels r where r.id = p_row;
  select i.title into v_title from public.content_items i where i.id = v_row.content_item_id;
  perform public.notify_users(
    'content.publish_failed', v_row.brand_id, 'Falha ao publicar no Instagram',
    format('«%s» não foi publicado automaticamente. Veja o motivo e tente de novo ou publique à mão.', v_title),
    '/admin/marketing/content/' || v_row.content_item_id::text, 'content_channel', p_row,
    'content.publish_failed:' || p_row::text || ':' || v_row.attempt_count::text, null
  );
end;
$$;

create function public.publish_payload(p_row uuid, p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'row_id', r.id,
    'brand_id', r.brand_id,
    'channel_id', r.channel_id,
    'item_id', r.content_item_id,
    'format', r.format,
    'planned_at', r.planned_at,
    'caption', coalesce(
      s.entry -> 'caption' ->> 'text', rev.snapshot -> 'caption' ->> 'text', ''
    ),
    'external_account_id', k.external_account_id,
    'attempt', jsonb_build_object(
      'id', a.id, 'no', a.attempt_no, 'status', a.status, 'container_id', a.container_id,
      'created_at', a.created_at
    ),
    'media', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'media_version_id', m.media_version_id,
            'position', m.position,
            'mime_type', v.mime_type,
            'storage_key', v.storage_key,
            'size_bytes', v.size_bytes,
            'width', v.width,
            'height', v.height,
            'duration_ms', v.duration_ms,
            'available', v.status = 'available' and v.original_purged_at is null
          )
          order by m.position
        )
        from public.content_revision_media m
        join public.media_versions v on v.id = m.media_version_id
        where m.revision_id = i.approved_revision_id
      ),
      '[]'::jsonb
    )
  )
  from public.content_channels r
  join public.content_items i on i.id = r.content_item_id
  join public.content_revisions rev on rev.id = i.approved_revision_id
  join public.channel_connections k on k.channel_id = r.channel_id
  join public.publish_attempts a on a.id = p_attempt
  left join lateral (
    select e as entry
    from jsonb_array_elements(rev.snapshot -> 'channels') e
    where e ->> 'row_id' = r.id::text
    limit 1
  ) s on true
  where r.id = p_row
$$;

create function public.publish_work(p_limit int, p_late_hours int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_attempt uuid;
  v_no int;
  v_claimed jsonb := '[]'::jsonb;
  v_inflight jsonb := '[]'::jsonb;
begin
  perform set_config('compasso.publish_job', 'on', true);

  for v_row in
    select r.id,
      case
        when k.channel_id is null then 'connection_missing'
        when k.status not in ('active', 'expiring') or k.token_expires_at <= now() then 'connection_expired'
        when coalesce(r.publish_retry_at, r.planned_at) < now() - make_interval(hours => p_late_hours)
          then 'publish_too_late'
        else null
      end as reason
    from public.content_channels r
    join public.content_items i on i.id = r.content_item_id
    left join public.channel_connections k on k.channel_id = r.channel_id
    where r.publish_mode = 'automatic' and r.publication_status = 'planned'
      and r.auto_publish_state is null and coalesce(r.publish_retry_at, r.planned_at) <= now()
      and i.editorial_status = 'approved' and i.cancelled_at is null
      and i.approved_revision_id is not null
    for update of r skip locked
  loop
    if v_row.reason is not null then
      update public.content_channels
      set auto_publish_state = 'failed', last_error_code = v_row.reason, attempt_count = attempt_count + 1,
          version = version + 1
      where id = v_row.id;
      perform public.publish_notify_failed(v_row.id);
      perform public.audit_write(
        public.current_organization_id(),
        (select r.brand_id from public.content_channels r where r.id = v_row.id),
        'content_channel.publish_failed', 'content_channel', v_row.id,
        jsonb_build_object('code', v_row.reason)
      );
      continue;
    end if;
    if jsonb_array_length(v_claimed) >= p_limit then
      continue;
    end if;
    update public.content_channels
    set auto_publish_state = 'publishing', attempt_count = attempt_count + 1, last_error_code = null,
        version = version + 1
    where id = v_row.id
    returning attempt_count into v_no;
    insert into public.publish_attempts (channel_row_id, brand_id, attempt_no)
    select r.id, r.brand_id, v_no from public.content_channels r where r.id = v_row.id
    returning id into v_attempt;
    v_claimed := v_claimed || jsonb_build_array(public.publish_payload(v_row.id, v_attempt));
  end loop;

  for v_row in
    select a.id as attempt_id, a.channel_row_id
    from public.publish_attempts a
    join public.content_channels r on r.id = a.channel_row_id
    where a.status in ('claimed', 'container_created') and r.auto_publish_state = 'publishing'
      and a.updated_at < now() - interval '45 seconds'
    order by a.updated_at
    limit p_limit
    for update of a skip locked
  loop
    update public.publish_attempts set updated_at = now() where id = v_row.attempt_id;
    v_inflight := v_inflight || jsonb_build_array(
      public.publish_payload(v_row.channel_row_id, v_row.attempt_id)
    );
  end loop;

  return jsonb_build_object('claimed', v_claimed, 'inflight', v_inflight);
end;
$$;

create function public.publish_attempt_set(
  p_attempt uuid,
  p_status text,
  p_container text,
  p_error text,
  p_provider text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('claimed', 'container_created') then
    raise exception 'invalid_input';
  end if;
  update public.publish_attempts
  set status = p_status,
      container_id = coalesce(p_container, container_id),
      error_code = left(p_error, 80),
      provider_error = left(p_provider, 200)
  where id = p_attempt;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.publish_row_complete(p_attempt uuid, p_media_id text, p_permalink text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.publish_attempts;
  v_row public.content_channels;
  v_url text := case when p_permalink ~ '^https://' then p_permalink else null end;
begin
  perform set_config('compasso.publish_job', 'on', true);
  select * into v_attempt from public.publish_attempts a where a.id = p_attempt for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_row from public.content_channels r where r.id = v_attempt.channel_row_id for update;

  update public.content_channels
  set publication_status = 'published_manually', published_at = now(), published_url = v_url,
      published_via = 'instagram_api', external_media_id = left(p_media_id, 80),
      auto_publish_state = null, last_error_code = null, version = version + 1
  where id = v_row.id;
  update public.publish_attempts
  set status = 'published', media_id = left(p_media_id, 80), error_code = null
  where id = p_attempt;

  perform public.resolve_notifications('content_channel', v_row.id);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'content_channel.published_auto',
    'content_channel', v_row.id,
    jsonb_build_object('item_id', v_row.content_item_id, 'attempt_no', v_attempt.attempt_no)
  );
  perform public.notify_users(
    'content.published_auto', v_row.brand_id, 'Publicado automaticamente',
    format('«%s» foi publicado no Instagram.',
      (select i.title from public.content_items i where i.id = v_row.content_item_id)),
    '/admin/marketing/content/' || v_row.content_item_id::text, 'content_channel', v_row.id,
    'content.published_auto:' || v_row.id::text, null
  );
end;
$$;

create function public.publish_row_failed(
  p_attempt uuid,
  p_code text,
  p_provider text,
  p_uncertain boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.publish_attempts;
  v_row public.content_channels;
begin
  perform set_config('compasso.publish_job', 'on', true);
  select * into v_attempt from public.publish_attempts a where a.id = p_attempt for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_row from public.content_channels r where r.id = v_attempt.channel_row_id for update;

  update public.publish_attempts
  set status = case when p_uncertain then 'uncertain' else 'failed' end,
      error_code = left(p_code, 80), provider_error = left(p_provider, 200)
  where id = p_attempt;
  update public.content_channels
  set auto_publish_state = 'failed', last_error_code = left(p_code, 80), version = version + 1
  where id = v_row.id;

  perform public.publish_notify_failed(v_row.id);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'content_channel.publish_failed',
    'content_channel', v_row.id,
    jsonb_build_object('code', left(p_code, 80), 'attempt_no', v_attempt.attempt_no)
  );
end;
$$;

create function public.publish_row_release(p_attempt uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.publish_attempts;
begin
  perform set_config('compasso.publish_job', 'on', true);
  select * into v_attempt from public.publish_attempts a where a.id = p_attempt for update;
  if not found then
    raise exception 'not_found';
  end if;
  update public.publish_attempts set status = 'released', error_code = left(p_code, 80)
  where id = p_attempt;
  update public.content_channels
  set auto_publish_state = null, last_error_code = left(p_code, 80), version = version + 1
  where id = v_attempt.channel_row_id;
end;
$$;

create function public.channel_row_set_publish_mode(
  p_row uuid,
  p_mode text,
  p_expected_version int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.content_channels;
  v_version int;
begin
  perform public.assert_action('content.publish_manual');
  select * into v_row from public.content_channels r where r.id = p_row for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  if p_mode not in ('manual', 'automatic') then
    raise exception 'invalid_input';
  end if;
  if p_expected_version is null or p_expected_version <> v_row.version then
    raise exception 'conflict';
  end if;
  if v_row.publication_status not in ('unplanned', 'planned') or v_row.auto_publish_state = 'publishing' then
    raise exception 'transition_not_allowed';
  end if;
  if p_mode = 'automatic' then
    if not exists (
      select 1 from public.channel_connections k
      where k.channel_id = v_row.channel_id and k.status in ('active', 'expiring')
    ) then
      raise exception 'connection_missing';
    end if;
    if v_row.format not in ('image', 'carousel', 'reel', 'story') then
      raise exception 'format_not_supported';
    end if;
  end if;

  update public.content_channels
  set publish_mode = p_mode, auto_publish_state = null, last_error_code = null,
      publish_retry_at = null, version = version + 1
  where id = p_row
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'content_channel.publish_mode_changed',
    'content_channel', p_row, jsonb_build_object('mode', p_mode)
  );
  return jsonb_build_object('id', p_row, 'version', v_version);
end;
$$;

create function public.channel_row_publish_now(p_row uuid, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.content_channels;
  v_version int;
begin
  perform public.assert_action('content.publish_manual');
  select * into v_row from public.content_channels r where r.id = p_row for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  if p_expected_version is null or p_expected_version <> v_row.version then
    raise exception 'conflict';
  end if;
  if v_row.publish_mode <> 'automatic' or v_row.publication_status <> 'planned'
    or v_row.auto_publish_state = 'publishing' then
    raise exception 'transition_not_allowed';
  end if;
  if not exists (
    select 1 from public.channel_connections k
    where k.channel_id = v_row.channel_id and k.status in ('active', 'expiring')
  ) then
    raise exception 'connection_missing';
  end if;

  update public.content_channels
  set auto_publish_state = null, last_error_code = null, publish_retry_at = now(), version = version + 1
  where id = p_row
  returning version into v_version;
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'content_channel.publish_requested',
    'content_channel', p_row, '{}'::jsonb
  );
  return jsonb_build_object('id', p_row, 'version', v_version);
end;
$$;

create function public.content_publish_info(p_item uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
begin
  perform public.assert_action('content.view');
  select i.brand_id into v_brand from public.content_items i where i.id = p_item;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_brand);
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'row_id', r.id,
          'channel_id', r.channel_id,
          'version', r.version,
          'publication_status', r.publication_status,
          'published_url', r.published_url,
          'publish_mode', r.publish_mode,
          'auto_publish_state', r.auto_publish_state,
          'published_via', r.published_via,
          'external_media_id', r.external_media_id,
          'attempt_count', r.attempt_count,
          'last_error_code', r.last_error_code,
          'connected', exists (
            select 1 from public.channel_connections k
            where k.channel_id = r.channel_id and k.status in ('active', 'expiring')
          ),
          'last_attempt_at', (
            select max(a.updated_at) from public.publish_attempts a where a.channel_row_id = r.id
          )
        )
        order by r.position, r.created_at
      )
      from public.content_channels r
      where r.content_item_id = p_item and r.publication_status <> 'cancelled'
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.channel_connection_disconnect(p_channel uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.channel_connections;
begin
  perform public.assert_action('channels.connect');
  select * into v_row from public.channel_connections c where c.channel_id = p_channel for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  if exists (
    select 1 from public.content_channels r
    where r.channel_id = p_channel and r.auto_publish_state = 'publishing'
  ) then
    raise exception 'publish_in_progress';
  end if;
  update public.content_channels
  set publish_mode = 'manual', auto_publish_state = null, publish_retry_at = null,
      version = version + 1
  where channel_id = p_channel and publish_mode = 'automatic' and publication_status in ('unplanned', 'planned');
  delete from public.channel_connections where channel_id = p_channel;
  perform public.resolve_notifications('channel', p_channel);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'channel.disconnected', 'channel', p_channel,
    jsonb_build_object('provider', v_row.provider)
  );
end;
$$;

create or replace function public.dashboard_publication_pending(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('content.publish_manual');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'item_id', x.item_id,
          'title', x.title,
          'brand_id', x.brand_id,
          'brand_name', x.brand_name,
          'pending_rows', x.pending_rows,
          'failed_rows', x.failed_rows,
          'oldest_planned_at', x.oldest,
          'channels', x.channels
        )
        order by x.failed_rows desc, x.oldest, x.title
      )
      from (
        select
          i.id as item_id, i.title, b.id as brand_id, b.name as brand_name,
          count(r.id)::int as pending_rows,
          count(r.id) filter (where r.auto_publish_state = 'failed')::int as failed_rows,
          min(r.planned_at) as oldest,
          array_agg(distinct c.profile_name order by c.profile_name) as channels
        from public.content_items i
        join public.brands b on b.id = i.brand_id
        join public.content_channels r
          on r.content_item_id = i.id
          and r.publication_status = 'planned'
          and r.planned_at < now()
          and (
            r.publish_mode = 'manual'
            or r.auto_publish_state = 'failed'
            or r.planned_at < now() - interval '6 hours'
          )
        join public.channels c on c.id = r.channel_id
        where i.cancelled_at is null
          and i.editorial_status = 'approved'
          and public.can_access_brand(i.brand_id)
          and (p_brands is null or i.brand_id = any (p_brands))
        group by i.id, i.title, b.id, b.name
        order by count(r.id) filter (where r.auto_publish_state = 'failed') desc, min(r.planned_at), i.title
        limit 50
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function
  public.channel_row_set_publish_mode(uuid, text, int),
  public.channel_row_publish_now(uuid, int),
  public.content_publish_info(uuid)
from public, anon;
grant execute on function
  public.channel_row_set_publish_mode(uuid, text, int),
  public.channel_row_publish_now(uuid, int),
  public.content_publish_info(uuid)
to authenticated;
revoke execute on function
  public.publish_notify_failed(uuid),
  public.publish_payload(uuid, uuid),
  public.publish_work(int, int),
  public.publish_attempt_set(uuid, text, text, text, text),
  public.publish_row_complete(uuid, text, text),
  public.publish_row_failed(uuid, text, text, boolean),
  public.publish_row_release(uuid, text)
from public, anon, authenticated;

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
    'organization.updated',
    'channel.connected',
    'channel.disconnected',
    'channel.connection_lost',
    'content_channel.published_auto',
    'content_channel.publish_failed',
    'content_channel.publish_mode_changed',
    'content_channel.publish_requested',
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

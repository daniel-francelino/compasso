begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('channels.connect', 'channels', 'Connect channels to their platforms', false, false, '{channels.update}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, 'channels.connect' from public.roles r where r.key = 'manager'
on conflict do nothing;

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
values
  ('channel.connection_expiring', 'Conexão do canal perto de expirar', 'channels.connect', 'warning', null, false, false, true, true),
  ('channel.connection_expired', 'Conexão do canal expirada', 'channels.connect', 'urgent', null, false, false, true, true)
on conflict (kind) do nothing;

create table public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  brand_id uuid not null,
  provider text not null check (provider in ('instagram')),
  external_account_id text not null check (char_length(external_account_id) between 1 and 80),
  username text not null check (char_length(username) between 1 and 120),
  display_name text check (display_name is null or char_length(display_name) <= 200),
  account_type text check (account_type is null or char_length(account_type) <= 40),
  followers_count int check (followers_count is null or followers_count >= 0),
  token_encrypted text not null check (char_length(token_encrypted) between 20 and 4000),
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'expiring', 'expired', 'revoked')),
  auto_publish_default boolean not null default false,
  collect_metrics boolean not null default true,
  connected_by uuid references public.profiles (id),
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  last_metrics_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id),
  unique (channel_id)
);

create unique index channel_connections_account_idx
  on public.channel_connections (provider, external_account_id);
create index channel_connections_brand_idx on public.channel_connections (brand_id);
create index channel_connections_renew_idx on public.channel_connections (token_expires_at)
  where status in ('active', 'expiring');

alter table public.channel_connections enable row level security;
revoke all on public.channel_connections from public, anon, authenticated;

create trigger channel_connections_set_updated_at before update on public.channel_connections
for each row execute function public.set_updated_at();

create function public.channel_connection_json(c public.channel_connections)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'channel_id', c.channel_id,
    'brand_id', c.brand_id,
    'provider', c.provider,
    'username', c.username,
    'display_name', c.display_name,
    'account_type', c.account_type,
    'followers_count', c.followers_count,
    'status', c.status,
    'scopes', to_jsonb(c.scopes),
    'token_expires_at', c.token_expires_at,
    'auto_publish_default', c.auto_publish_default,
    'collect_metrics', c.collect_metrics,
    'connected_at', c.connected_at,
    'last_refreshed_at', c.last_refreshed_at,
    'last_error_code', c.last_error_code,
    'last_metrics_at', c.last_metrics_at,
    'version', c.version
  )
$$;

create function public.channel_connection_list(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('channels.view');
  perform public.assert_brand_access(p_brand);
  return coalesce(
    (
      select jsonb_agg(public.channel_connection_json(c) order by c.connected_at)
      from public.channel_connections c
      where c.brand_id = p_brand
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.channel_connection_connect(
  p_channel uuid,
  p_account jsonb,
  p_token_encrypted text,
  p_expires_at timestamptz,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel public.channels;
  v_account text := nullif(btrim(coalesce(p_account ->> 'external_account_id', '')), '');
  v_username text := nullif(btrim(coalesce(p_account ->> 'username', '')), '');
  v_followers int := nullif(p_account ->> 'followers_count', '')::int;
  v_row public.channel_connections;
begin
  perform public.assert_action('channels.connect');
  select * into v_channel from public.channels c where c.id = p_channel for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_channel.brand_id);
  if v_channel.archived_at is not null then
    raise exception 'channel_archived';
  end if;
  if v_channel.platform <> 'instagram' or v_account is null or v_username is null
    or p_token_encrypted is null or p_expires_at is null or p_expires_at <= now() then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1 from public.channel_connections k
    where k.provider = 'instagram' and k.external_account_id = v_account and k.channel_id <> p_channel
  ) then
    raise exception 'channel_account_in_use';
  end if;

  insert into public.channel_connections (
    channel_id, brand_id, provider, external_account_id, username, display_name, account_type,
    followers_count, token_encrypted, token_expires_at, scopes, status, connected_by,
    last_refreshed_at
  )
  values (
    p_channel, v_channel.brand_id, 'instagram', v_account, v_username,
    nullif(btrim(coalesce(p_account ->> 'display_name', '')), ''),
    nullif(btrim(coalesce(p_account ->> 'account_type', '')), ''),
    v_followers, p_token_encrypted, p_expires_at, coalesce(p_scopes, '{}'), 'active', auth.uid(),
    now()
  )
  on conflict (channel_id) do update
  set external_account_id = excluded.external_account_id,
      username = excluded.username,
      display_name = excluded.display_name,
      account_type = excluded.account_type,
      followers_count = excluded.followers_count,
      token_encrypted = excluded.token_encrypted,
      token_expires_at = excluded.token_expires_at,
      scopes = excluded.scopes,
      status = 'active',
      last_error_code = null,
      last_refreshed_at = now(),
      connected_by = auth.uid(),
      connected_at = now(),
      version = public.channel_connections.version + 1
  returning * into v_row;

  perform public.resolve_notifications('channel', p_channel);
  perform public.audit_write(
    public.current_organization_id(), v_channel.brand_id, 'channel.connected', 'channel', p_channel,
    jsonb_build_object('provider', 'instagram')
  );
  return public.channel_connection_json(v_row);
end;
$$;

create function public.channel_connection_settings(
  p_channel uuid,
  p_auto_publish_default boolean,
  p_collect_metrics boolean,
  p_expected_version int
)
returns jsonb
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
  if p_expected_version is null or p_expected_version <> v_row.version then
    raise exception 'conflict';
  end if;
  if p_auto_publish_default is null or p_collect_metrics is null then
    raise exception 'invalid_input';
  end if;

  update public.channel_connections
  set auto_publish_default = p_auto_publish_default,
      collect_metrics = p_collect_metrics,
      version = version + 1
  where channel_id = p_channel
  returning * into v_row;

  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'channel.updated', 'channel', p_channel,
    jsonb_build_object('fields', jsonb_build_array('auto_publish_default', 'collect_metrics'))
  );
  return public.channel_connection_json(v_row);
end;
$$;

create function public.channel_connection_disconnect(p_channel uuid)
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
  delete from public.channel_connections where channel_id = p_channel;
  perform public.resolve_notifications('channel', p_channel);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'channel.disconnected', 'channel', p_channel,
    jsonb_build_object('provider', v_row.provider)
  );
end;
$$;

create function public.channel_connection_secret(p_channel uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'channel_id', c.channel_id,
    'brand_id', c.brand_id,
    'external_account_id', c.external_account_id,
    'token_encrypted', c.token_encrypted,
    'token_expires_at', c.token_expires_at,
    'status', c.status,
    'collect_metrics', c.collect_metrics
  )
  from public.channel_connections c
  where c.channel_id = p_channel
$$;

create function public.channel_connections_to_renew(p_within_days int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'channel_id', c.channel_id,
        'token_expires_at', c.token_expires_at,
        'last_refreshed_at', c.last_refreshed_at
      )
      order by c.token_expires_at
    ),
    '[]'::jsonb
  )
  from public.channel_connections c
  where c.status in ('active', 'expiring')
    and c.token_expires_at < now() + make_interval(days => greatest(p_within_days, 0))
$$;

create function public.channel_connection_renewed(
  p_channel uuid,
  p_token_encrypted text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.channel_connections
  set token_encrypted = p_token_encrypted,
      token_expires_at = p_expires_at,
      status = 'active',
      last_error_code = null,
      last_refreshed_at = now(),
      version = version + 1
  where channel_id = p_channel;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.resolve_notifications('channel', p_channel);
end;
$$;

create function public.channel_connection_failed(p_channel uuid, p_status text, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.channel_connections;
  v_kind text;
  v_title text;
begin
  if p_status not in ('expiring', 'expired', 'revoked') then
    raise exception 'invalid_input';
  end if;
  update public.channel_connections
  set status = p_status, last_error_code = left(p_code, 80), version = version + 1
  where channel_id = p_channel
  returning * into v_row;
  if not found then
    raise exception 'not_found';
  end if;
  v_kind := case when p_status = 'expiring' then 'channel.connection_expiring' else 'channel.connection_expired' end;
  v_title := case
    when p_status = 'expiring' then 'A conexão do Instagram está perto de expirar'
    else 'A conexão do Instagram precisa ser refeita'
  end;
  perform public.notify_users(
    v_kind, v_row.brand_id, v_title,
    'Reconecte o canal para continuar publicando e coletando métricas.',
    '/admin/marketing/brands/' || v_row.brand_id::text || '/channels', 'channel', p_channel,
    v_kind || ':' || p_channel::text || ':' || to_char(now(), 'YYYY-MM-DD'), null
  );
  if p_status <> 'expiring' then
    perform public.audit_write(
      public.current_organization_id(), v_row.brand_id, 'channel.connection_lost', 'channel', p_channel,
      jsonb_build_object('status', p_status)
    );
  end if;
end;
$$;

revoke execute on function
  public.channel_connection_list(uuid),
  public.channel_connection_connect(uuid, jsonb, text, timestamptz, text[]),
  public.channel_connection_settings(uuid, boolean, boolean, int),
  public.channel_connection_disconnect(uuid)
from public, anon;
grant execute on function
  public.channel_connection_list(uuid),
  public.channel_connection_connect(uuid, jsonb, text, timestamptz, text[]),
  public.channel_connection_settings(uuid, boolean, boolean, int),
  public.channel_connection_disconnect(uuid)
to authenticated;
revoke execute on function
  public.channel_connection_json(public.channel_connections),
  public.channel_connection_secret(uuid),
  public.channel_connections_to_renew(int),
  public.channel_connection_renewed(uuid, text, timestamptz),
  public.channel_connection_failed(uuid, text, text)
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

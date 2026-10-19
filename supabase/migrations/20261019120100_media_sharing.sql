begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('media.share', 'media', 'Share files and folders by link', false, false, '{media.view}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, 'media.share' from public.roles r where r.key = 'manager'
on conflict do nothing;

create table public.media_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  organization_id uuid not null references public.organizations (id),
  scope text not null check (scope in ('site', 'brand')),
  brand_id uuid references public.brands (id),
  label text not null check (char_length(label) between 1 and 80),
  message text check (message is null or char_length(message) <= 500),
  asset_id uuid references public.media_assets (id) on delete set null,
  pinned_version_id uuid references public.media_versions (id) on delete set null,
  collection_id uuid references public.media_collections (id) on delete set null,
  include_subcollections boolean not null default true,
  allow_download boolean not null default true,
  expires_at timestamptz,
  password_hash text,
  has_password boolean generated always as (password_hash is not null) stored,
  max_downloads int check (max_downloads is null or max_downloads between 1 and 10000),
  download_count int not null default 0,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked', 'target_deleted')),
  created_by uuid default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  check ((scope = 'brand') = (brand_id is not null)),
  check (
    status <> 'active' or ((asset_id is not null)::int + (collection_id is not null)::int) = 1
  )
);

create index media_shares_asset_idx on public.media_shares (asset_id) where asset_id is not null;
create index media_shares_collection_idx
  on public.media_shares (collection_id) where collection_id is not null;
create index media_shares_scope_idx on public.media_shares (organization_id, scope, brand_id);

create table public.media_share_grants (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.media_shares (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index media_share_grants_share_idx on public.media_share_grants (share_id);

create table public.media_share_events (
  id bigint generated always as identity primary key,
  share_id uuid not null references public.media_shares (id) on delete cascade,
  type text not null check (type in (
    'created', 'viewed', 'password_failed', 'downloaded', 'revoked', 'updated'
  )),
  asset_id uuid references public.media_assets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index media_share_events_share_idx on public.media_share_events (share_id, created_at desc);

alter table public.media_shares enable row level security;
alter table public.media_share_grants enable row level security;
alter table public.media_share_events enable row level security;

create policy media_shares_read on public.media_shares for select
  using (
    public.has_action('media.share')
    and (
      (scope = 'brand' and public.can_access_brand(brand_id))
      or (scope = 'site' and public.has_action('site.view'))
    )
  );

revoke all on public.media_shares, public.media_share_grants, public.media_share_events
  from anon, authenticated;
grant select on public.media_shares to authenticated;

create function public.media_share_target_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'media_assets' then
    update public.media_shares set status = 'target_deleted', revoked_at = now()
    where asset_id = old.id and status = 'active';
  else
    update public.media_shares set status = 'target_deleted', revoked_at = now()
    where collection_id = old.id and status = 'active';
  end if;
  return old;
end;
$$;

create trigger media_assets_share_target before delete on public.media_assets
for each row execute function public.media_share_target_deleted();

create trigger media_collections_share_target before delete on public.media_collections
for each row execute function public.media_share_target_deleted();

create function public.media_share_assert_scope(p_scope text, p_brand uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_scope = 'brand' then
    perform public.assert_brand_access(p_brand);
  elsif not public.has_action('site.view') then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.media_share_files(p_share uuid)
returns table (
  asset_id uuid,
  version_id uuid,
  title text,
  filename text,
  mime text,
  size_bytes bigint,
  width int,
  height int,
  storage_key text,
  thumb_key text,
  display_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.media_shares;
begin
  select * into s from public.media_shares where id = p_share;
  if not found then
    return;
  end if;

  if s.asset_id is not null then
    return query
    select a.id, v.id, a.display_name, v.original_filename, v.mime_type, v.size_bytes, v.width,
           v.height, v.storage_key, v.thumb_key, v.display_key
    from public.media_assets a
    join public.media_versions v on v.id = coalesce(s.pinned_version_id, a.current_version_id)
    where a.id = s.asset_id and a.trashed_at is null and v.status = 'available';
    return;
  end if;

  return query
  with recursive tree (id, depth) as (
    select c.id, 1 from public.media_collections c where c.id = s.collection_id
    union all
    select c.id, tree.depth + 1
    from public.media_collections c
    join tree on c.parent_id = tree.id
    where s.include_subcollections and tree.depth < 4
  )
  select distinct on (a.id) a.id, v.id, a.display_name, v.original_filename, v.mime_type,
         v.size_bytes, v.width, v.height, v.storage_key, v.thumb_key, v.display_key
  from tree
  join public.media_collection_items i on i.collection_id = tree.id
  join public.media_assets a on a.id = i.asset_id
  join public.media_versions v on v.id = a.current_version_id
  where a.trashed_at is null and v.status = 'available'
  order by a.id
  limit 500;
end;
$$;

create function public.media_share_gate(p_token text, p_grant text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.media_shares;
begin
  select * into s from public.media_shares where token = p_token;
  if not found then
    return 'not_found';
  end if;
  if s.status = 'revoked' then
    return 'revoked';
  end if;
  if s.status = 'target_deleted' then
    return 'unavailable';
  end if;
  if s.expires_at is not null and s.expires_at <= now() then
    return 'expired';
  end if;
  if s.locked_until is not null and s.locked_until > now() then
    return 'locked';
  end if;
  if s.max_downloads is not null and s.download_count >= s.max_downloads then
    return 'exhausted';
  end if;
  if s.password_hash is not null and not exists (
    select 1
    from public.media_share_grants g
    where g.share_id = s.id
      and g.token_hash = encode(sha256(convert_to(coalesce(p_grant, ''), 'utf8')), 'hex')
      and g.expires_at > now()
  ) then
    return 'password_required';
  end if;
  return 'ok';
end;
$$;

create function public.media_share_create(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text := p_input ->> 'kind';
  v_target uuid := (p_input ->> 'target_id')::uuid;
  v_label text := btrim(coalesce(p_input ->> 'label', ''));
  v_message text := nullif(btrim(coalesce(p_input ->> 'message', '')), '');
  v_expires timestamptz := (p_input ->> 'expires_at')::timestamptz;
  v_password text := nullif(p_input ->> 'password', '');
  v_max int := (p_input ->> 'max_downloads')::int;
  v_allow boolean := coalesce((p_input ->> 'allow_download')::boolean, true);
  v_sub boolean := coalesce((p_input ->> 'include_subcollections')::boolean, true);
  v_follow boolean := coalesce((p_input ->> 'follow_latest')::boolean, false);
  v_asset public.media_assets;
  v_collection public.media_collections;
  v_org uuid;
  v_scope text;
  v_brand uuid;
  v_version uuid;
  v_id uuid;
  v_token text;
begin
  perform public.assert_action('media.share');
  if char_length(v_label) not between 1 and 80
     or char_length(coalesce(v_message, '')) > 500
     or (v_max is not null and v_max not between 1 and 10000) then
    raise exception 'share_invalid';
  end if;
  if v_expires is not null and (v_expires <= now() or v_expires > now() + interval '10 years') then
    raise exception 'share_invalid_expiry';
  end if;
  if v_password is not null and char_length(v_password) not between 8 and 128 then
    raise exception 'password_weak';
  end if;

  if v_kind = 'asset' then
    v_asset := public.media_assert_asset_access(v_target);
    if v_asset.trashed_at is not null or v_asset.current_version_id is null then
      raise exception 'share_target_invalid';
    end if;
    v_org := v_asset.organization_id;
    v_scope := v_asset.scope;
    v_brand := v_asset.brand_id;
    if not v_follow then
      v_version := v_asset.current_version_id;
    end if;
  elsif v_kind = 'collection' then
    select * into v_collection from public.media_collections where id = v_target;
    if not found then
      raise exception 'not_found';
    end if;
    perform public.media_share_assert_scope(v_collection.scope, v_collection.brand_id);
    v_org := v_collection.organization_id;
    v_scope := v_collection.scope;
    v_brand := v_collection.brand_id;
  else
    raise exception 'share_target_invalid';
  end if;

  insert into public.media_shares (
    organization_id, scope, brand_id, label, message, asset_id, pinned_version_id, collection_id,
    include_subcollections, allow_download, expires_at, password_hash, max_downloads
  )
  values (
    v_org, v_scope, v_brand, v_label, v_message,
    case when v_kind = 'asset' then v_target end, v_version,
    case when v_kind = 'collection' then v_target end,
    v_sub, v_allow, v_expires,
    case when v_password is not null
      then extensions.crypt(v_password, extensions.gen_salt('bf', 10)) end,
    v_max
  )
  returning id, token into v_id, v_token;

  insert into public.media_share_events (share_id, type) values (v_id, 'created');
  perform public.audit_write(v_org, v_brand, 'media.share_created', 'media_share', v_id,
    jsonb_build_object('kind', v_kind, 'target_id', v_target));
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

create function public.media_share_update(p_input jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_input ->> 'id')::uuid;
  v_label text := btrim(coalesce(p_input ->> 'label', ''));
  v_message text := nullif(btrim(coalesce(p_input ->> 'message', '')), '');
  v_expires timestamptz := (p_input ->> 'expires_at')::timestamptz;
  v_max int := (p_input ->> 'max_downloads')::int;
  v_allow boolean := coalesce((p_input ->> 'allow_download')::boolean, true);
  v_action text := coalesce(p_input ->> 'password_action', 'keep');
  v_password text := p_input ->> 'password';
  s public.media_shares;
begin
  perform public.assert_action('media.share');
  select * into s from public.media_shares where id = v_id for update;
  if not found then
    raise exception 'share_not_found';
  end if;
  perform public.media_share_assert_scope(s.scope, s.brand_id);
  if s.status <> 'active' then
    raise exception 'share_not_active';
  end if;
  if char_length(v_label) not between 1 and 80
     or char_length(coalesce(v_message, '')) > 500
     or (v_max is not null and v_max not between 1 and 10000)
     or v_action not in ('keep', 'set', 'clear') then
    raise exception 'share_invalid';
  end if;
  if v_expires is not null and (v_expires <= now() or v_expires > now() + interval '10 years') then
    raise exception 'share_invalid_expiry';
  end if;
  if v_action = 'set' and char_length(coalesce(v_password, '')) not between 8 and 128 then
    raise exception 'password_weak';
  end if;

  update public.media_shares
  set label = v_label,
      message = v_message,
      expires_at = v_expires,
      max_downloads = v_max,
      allow_download = v_allow,
      password_hash = case v_action
        when 'set' then extensions.crypt(v_password, extensions.gen_salt('bf', 10))
        when 'clear' then null
        else password_hash
      end,
      failed_attempts = case when v_action = 'keep' then failed_attempts else 0 end,
      locked_until = case when v_action = 'keep' then locked_until else null end
  where id = v_id;

  if v_action <> 'keep' then
    delete from public.media_share_grants where share_id = v_id;
  end if;
  insert into public.media_share_events (share_id, type) values (v_id, 'updated');
end;
$$;

create function public.media_share_revoke(p_share uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.media_shares;
begin
  perform public.assert_action('media.share');
  select * into s from public.media_shares where id = p_share for update;
  if not found then
    raise exception 'share_not_found';
  end if;
  perform public.media_share_assert_scope(s.scope, s.brand_id);
  if s.status <> 'active' then
    raise exception 'share_not_active';
  end if;

  update public.media_shares set status = 'revoked', revoked_at = now() where id = p_share;
  delete from public.media_share_grants where share_id = p_share;
  insert into public.media_share_events (share_id, type) values (p_share, 'revoked');
  perform public.audit_write(s.organization_id, s.brand_id, 'media.share_revoked', 'media_share',
    p_share, '{}'::jsonb);
end;
$$;

create function public.media_share_list(p_kind text, p_target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('media.share');
  if p_kind not in ('asset', 'collection') then
    raise exception 'share_target_invalid';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'token', s.token,
      'label', s.label,
      'message', s.message,
      'status', s.status,
      'allow_download', s.allow_download,
      'expires_at', s.expires_at,
      'has_password', s.has_password,
      'max_downloads', s.max_downloads,
      'download_count', s.download_count,
      'views', (select count(*) from public.media_share_events e
                where e.share_id = s.id and e.type = 'viewed'),
      'created_at', s.created_at
    ) order by s.created_at desc)
    from public.media_shares s
    where ((p_kind = 'asset' and s.asset_id = p_target)
        or (p_kind = 'collection' and s.collection_id = p_target))
      and ((s.scope = 'brand' and public.can_access_brand(s.brand_id))
        or (s.scope = 'site' and public.has_action('site.view')))
  ), '[]'::jsonb);
end;
$$;

create function public.media_share_targets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', case when s.asset_id is not null then 'asset' else 'collection' end,
    'target_id', coalesce(s.asset_id, s.collection_id)
  )), '[]'::jsonb)
  from public.media_shares s
  where public.has_action('media.view')
    and s.status = 'active'
    and (s.expires_at is null or s.expires_at > now())
    and ((s.scope = 'brand' and public.can_access_brand(s.brand_id))
      or (s.scope = 'site' and public.has_action('site.view')))
$$;

revoke execute on function public.media_share_target_deleted() from public, anon, authenticated;
revoke execute on function public.media_share_assert_scope(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.media_share_files(uuid) from public, anon, authenticated;
revoke execute on function public.media_share_gate(text, text) from public, anon, authenticated;
revoke execute on function public.media_share_create(jsonb) from public, anon;
revoke execute on function public.media_share_update(jsonb) from public, anon;
revoke execute on function public.media_share_revoke(uuid) from public, anon;
revoke execute on function public.media_share_list(text, uuid) from public, anon;
revoke execute on function public.media_share_targets() from public, anon;
grant execute on function public.media_share_create(jsonb) to authenticated;
grant execute on function public.media_share_update(jsonb) to authenticated;
grant execute on function public.media_share_revoke(uuid) to authenticated;
grant execute on function public.media_share_list(text, uuid) to authenticated;
grant execute on function public.media_share_targets() to authenticated;

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
    'content.cancelled',
    'content.deleted',
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

commit;

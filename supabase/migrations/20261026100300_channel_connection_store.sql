begin;

drop function public.channel_connection_connect(uuid, jsonb, text, timestamptz, text[]);

create function public.channel_connection_store(
  p_channel uuid,
  p_actor uuid,
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
  if p_actor is null then
    raise exception 'invalid_input';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', p_actor, 'role', 'authenticated')::text, true);
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
    v_followers, p_token_encrypted, p_expires_at, coalesce(p_scopes, '{}'), 'active', p_actor,
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
      connected_by = p_actor,
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

revoke execute on function
  public.channel_connection_store(uuid, uuid, jsonb, text, timestamptz, text[])
from public, anon, authenticated;

commit;

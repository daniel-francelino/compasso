begin;

create function public.media_share_public_open(p_token text, p_grant text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text := public.media_share_gate(p_token, p_grant);
  s public.media_shares;
begin
  if v_state <> 'ok' then
    return jsonb_build_object('state', v_state);
  end if;
  select * into s from public.media_shares where token = p_token;
  update public.media_shares set last_accessed_at = now() where id = s.id;
  insert into public.media_share_events (share_id, type) values (s.id, 'viewed');
  return jsonb_build_object(
    'state', 'ok',
    'label', s.label,
    'message', s.message,
    'allow_download', s.allow_download,
    'files', coalesce((
      select jsonb_agg(jsonb_build_object(
        'asset_id', f.asset_id,
        'title', f.title,
        'filename', f.filename,
        'mime', f.mime,
        'size_bytes', f.size_bytes,
        'width', f.width,
        'height', f.height,
        'has_preview', f.thumb_key is not null
      ) order by f.title)
      from public.media_share_files(s.id) f
    ), '[]'::jsonb)
  );
end;
$$;

create function public.media_share_public_unlock(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text := public.media_share_gate(p_token, null);
  s public.media_shares;
  v_grant text;
begin
  if v_state = 'ok' then
    return jsonb_build_object('state', 'ok', 'grant', null);
  end if;
  if v_state <> 'password_required' then
    return jsonb_build_object('state', v_state);
  end if;

  select * into s from public.media_shares where token = p_token for update;
  if s.password_hash = extensions.crypt(coalesce(p_password, ''), s.password_hash) then
    v_grant := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    update public.media_shares set failed_attempts = 0 where id = s.id;
    insert into public.media_share_grants (share_id, token_hash, expires_at)
    values (s.id, encode(sha256(convert_to(v_grant, 'utf8')), 'hex'), now() + interval '2 hours');
    return jsonb_build_object('state', 'ok', 'grant', v_grant);
  end if;

  update public.media_shares
  set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
                          else locked_until end
  where id = s.id;
  insert into public.media_share_events (share_id, type) values (s.id, 'password_failed');
  return jsonb_build_object(
    'state', case when s.failed_attempts + 1 >= 5 then 'locked' else 'wrong_password' end
  );
end;
$$;

create function public.media_share_public_file(
  p_token text, p_grant text, p_asset uuid, p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state text := public.media_share_gate(p_token, p_grant);
  s public.media_shares;
  f record;
begin
  if v_state <> 'ok' then
    return jsonb_build_object('state', v_state);
  end if;
  if p_mode not in ('view', 'download') then
    return jsonb_build_object('state', 'not_found');
  end if;

  select * into s from public.media_shares where token = p_token for update;
  if p_mode = 'download' and not s.allow_download then
    return jsonb_build_object('state', 'download_disabled');
  end if;
  select * into f from public.media_share_files(s.id) x where x.asset_id = p_asset;
  if not found then
    return jsonb_build_object('state', 'not_found');
  end if;

  if p_mode = 'download' then
    update public.media_shares set download_count = download_count + 1 where id = s.id;
    insert into public.media_share_events (share_id, type, asset_id)
    values (s.id, 'downloaded', p_asset);
  end if;
  return jsonb_build_object(
    'state', 'ok',
    'storage_key', f.storage_key,
    'thumb_key', f.thumb_key,
    'display_key', f.display_key,
    'filename', f.filename,
    'mime', f.mime
  );
end;
$$;

revoke execute on function public.media_share_public_open(text, text) from public;
revoke execute on function public.media_share_public_unlock(text, text) from public;
revoke execute on function public.media_share_public_file(text, text, uuid, text) from public;
grant execute on function public.media_share_public_open(text, text) to anon, authenticated;
grant execute on function public.media_share_public_unlock(text, text) to anon, authenticated;
grant execute on function public.media_share_public_file(text, text, uuid, text)
  to anon, authenticated;

commit;

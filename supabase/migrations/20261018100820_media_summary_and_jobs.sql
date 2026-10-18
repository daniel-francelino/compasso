begin;

create function public.media_storage_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('media.view');
  return jsonb_build_object(
    'used_bytes', public.media_storage_used(),
    'quota_bytes', public.media_policy_mb('quotaMb', 5120)::bigint * 1048576
  );
end;
$$;

create function public.media_storage_keys()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('media.delete');
  return coalesce(
    (select jsonb_agg(jsonb_build_object('key', k.key, 'status', v.status))
     from public.media_versions v
     cross join lateral unnest(array[v.storage_key, v.thumb_key, v.display_key]) as k(key)
     where k.key is not null),
    '[]'::jsonb
  );
end;
$$;

revoke execute on function public.media_storage_summary(), public.media_storage_keys()
  from public, anon;
grant execute on function public.media_storage_summary(), public.media_storage_keys()
  to authenticated;

grant execute on function public.media_expire_sessions() to service_role;

commit;

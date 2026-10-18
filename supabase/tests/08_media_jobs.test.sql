begin;

select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'manager')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((public.media_storage_summary() ->> 'quota_bytes')::bigint, 5120::bigint * 1048576, 'the quota defaults to 5 GiB');
select is((public.media_storage_summary() ->> 'used_bytes')::bigint, 0::bigint, 'nothing is used at the start');
select throws_ok($$select public.media_storage_keys()$$, 'denied', 'only people with media.delete list every storage key');
select throws_ok($$select public.media_expire_sessions()$$, 'permission denied for function media_expire_sessions', 'clients cannot run the cleanup job');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.media_storage_keys()), 0, 'the owner lists the (empty) set of keys');
reset role;

set local role service_role;
select is(jsonb_array_length(public.media_expire_sessions() -> 'keys'), 0, 'the service role can run the cleanup job');
reset role;

set local role anon;
select throws_ok($$select public.media_storage_summary()$$, 'permission denied for function media_storage_summary', 'anon cannot read the quota');
reset role;

select * from finish();
rollback;

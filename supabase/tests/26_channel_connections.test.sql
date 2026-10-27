begin;

select plan(27);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.other', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.outra"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.blog', public.channel_save(format('{"brand_id":"%s","platform":"blog","profile_name":"blog aurora"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');

reset role;
select is(
  public.channel_connection_store(
    current_setting('t.channel')::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid,
    '{"external_account_id":"17841400000","username":"aurora.cafe","account_type":"BUSINESS","followers_count":1200}'::jsonb,
    'ciphertext-ciphertext-ciphertext-1', now() + interval '60 days',
    array['instagram_business_basic', 'instagram_business_content_publish']
  ) ->> 'status',
  'active',
  'the server stores the connection on behalf of a manager with channels.connect'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  (public.channel_connection_list(current_setting('t.brand')::uuid) -> 0 ->> 'username'),
  'aurora.cafe',
  'the connection is listed with the account username'
);
select ok(
  not (public.channel_connection_list(current_setting('t.brand')::uuid) -> 0 ? 'token_encrypted'),
  'the listing never carries the token'
);
select throws_ok(
  format($$select public.channel_connection_connect('%s'::uuid, '{"external_account_id":"1","username":"x"}'::jsonb, 'ciphertext-ciphertext-ciphertext-9', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  '42883',
  'the user-callable connect function no longer exists'
);
select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, '{"external_account_id":"1","username":"x"}'::jsonb, 'ciphertext-ciphertext-ciphertext-9', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  '42501',
  'a signed-in user cannot call the store function with an account id of their choice'
);
reset role;
select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, '{"external_account_id":"17841400000","username":"x"}'::jsonb, 'ciphertext-ciphertext-ciphertext-2', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  'channel_account_in_use',
  'the same Instagram account cannot be connected to two channels'
);
select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, '{"external_account_id":"1","username":"blog"}'::jsonb, 'ciphertext-ciphertext-ciphertext-3', now() + interval '1 day', '{}')$$, current_setting('t.blog')),
  'invalid_input',
  'only an Instagram channel can be connected'
);
select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, '{"external_account_id":"2","username":"y"}'::jsonb, 'short', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  '23514',
  'a token that is too short is refused by the table'
);
select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, null, '{"external_account_id":"2","username":"y"}'::jsonb, 'ciphertext-ciphertext-ciphertext-3', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  'invalid_input',
  'a store call without an actor is refused'
);
select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid, '{"external_account_id":"2","username":"y"}'::jsonb, 'ciphertext-ciphertext-ciphertext-3', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  'not_found',
  'an actor not linked to the brand cannot have a connection stored for it'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  public.channel_connection_settings(current_setting('t.channel')::uuid, true, false, 1) ->> 'collect_metrics',
  'false',
  'the settings are saved with the expected version'
);
select throws_ok(
  format($$select public.channel_connection_settings('%s'::uuid, true, true, 1)$$, current_setting('t.channel')),
  'conflict',
  'a stale version is refused'
);
select throws_ok(
  $$select count(*) from public.channel_connections$$,
  '42501',
  'the table cannot be read directly by a signed-in user'
);
select throws_ok(
  format($$select public.channel_connection_secret('%s'::uuid)$$, current_setting('t.channel')),
  '42501',
  'the secret reader is not callable by a signed-in user'
);
reset role;

select throws_ok(
  format($$select public.channel_connection_store('%s'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid, '{"external_account_id":"3","username":"z"}'::jsonb, 'ciphertext-ciphertext-ciphertext-4', now() + interval '1 day', '{}')$$, current_setting('t.other')),
  'denied',
  'an actor without channels.connect is refused'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  format($$select public.channel_connection_disconnect('%s'::uuid)$$, current_setting('t.channel')),
  'denied',
  'a role without channels.connect cannot disconnect'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  format($$select public.channel_connection_list('%s'::uuid)$$, current_setting('t.brand')),
  'not_found',
  'a manager not linked to the brand cannot list its connections'
);
select throws_ok(
  format($$select public.channel_connection_disconnect('%s'::uuid)$$, current_setting('t.channel')),
  'not_found',
  'a manager not linked to the brand cannot disconnect it'
);
reset role;

set local role anon;
select throws_ok(
  format($$select public.channel_connection_list('%s'::uuid)$$, current_setting('t.brand')),
  '42501',
  'anon cannot call the connection functions'
);
reset role;

select is(
  public.channel_connection_secret(current_setting('t.channel')::uuid) ->> 'token_encrypted',
  'ciphertext-ciphertext-ciphertext-1',
  'the server side reads the encrypted token'
);
select is(
  jsonb_array_length(public.channel_connections_to_renew(90)),
  1,
  'a token expiring within the window is due for renewal'
);
select public.channel_connection_failed(current_setting('t.channel')::uuid, 'expired', 'token_expired');
select is(
  (select status from public.channel_connections where channel_id = current_setting('t.channel')::uuid),
  'expired',
  'a failed renewal marks the connection expired'
);
select ok(
  (select count(*) from public.notifications where kind = 'channel.connection_expired') >= 1,
  'and the team is notified'
);
select public.channel_connection_renewed(
  current_setting('t.channel')::uuid, 'ciphertext-ciphertext-ciphertext-5', now() + interval '60 days'
);
select is(
  (select status from public.channel_connections where channel_id = current_setting('t.channel')::uuid),
  'active',
  'a renewal reactivates the connection'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.channel_connection_disconnect(current_setting('t.channel')::uuid);
select is(
  jsonb_array_length(public.channel_connection_list(current_setting('t.brand')::uuid)),
  0,
  'disconnecting removes the connection and its token'
);
reset role;
select ok(
  exists (select 1 from public.audit_events where action = 'channel.connected')
    and exists (select 1 from public.audit_events where action = 'channel.disconnected'),
  'connecting and disconnecting are audited'
);
select ok(
  not exists (select 1 from public.audit_events where metadata::text like '%ciphertext%'),
  'no audit event carries the token'
);

select * from finish();
rollback;

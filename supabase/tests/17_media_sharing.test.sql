begin;

select plan(34);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.client', public.client_save('{"name":"Cafe Aurora"}'::jsonb, true) ->> 'id', true);
select set_config('t.brand', (select id::text from public.brands limit 1), true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.up1', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'foto.jpg', 1000, 'image/jpeg', 'idem-share-0001')::text, true);
select set_config('t.asset1', (current_setting('t.up1')::jsonb ->> 'asset_id'), true);
select set_config('t.version1', (current_setting('t.up1')::jsonb ->> 'version_id'), true);
select public.media_confirm_upload(current_setting('t.version1')::uuid, repeat('a', 64), 800, 600, null, 500);
select set_config('t.up2', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'logo.png', 800, 'image/png', 'idem-share-0002')::text, true);
select set_config('t.asset2', (current_setting('t.up2')::jsonb ->> 'asset_id'), true);
select public.media_confirm_upload((current_setting('t.up2')::jsonb ->> 'version_id')::uuid, repeat('b', 64), 400, 400, null, 300);
select set_config('t.folder', public.media_collection_save(format('{"scope":"brand","brand_id":"%s","name":"Campanha"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.sub', public.media_collection_save(format('{"scope":"brand","brand_id":"%s","parent_id":"%s","name":"Posts"}', current_setting('t.brand'), current_setting('t.folder'))::jsonb) ->> 'id', true);
select public.media_collection_move_items(current_setting('t.folder')::uuid, array[current_setting('t.asset1')::uuid]);
select public.media_collection_move_items(current_setting('t.sub')::uuid, array[current_setting('t.asset2')::uuid]);

select set_config('t.s1', public.media_share_create(format('{"kind":"asset","target_id":"%s","label":"Foto do cliente"}', current_setting('t.asset1'))::jsonb)::text, true);
select is(length(current_setting('t.s1')::jsonb ->> 'token'), 64, 'a link has a 64-character secret');
select set_config('t.tok1', current_setting('t.s1')::jsonb ->> 'token', true);
select set_config('t.sid1', current_setting('t.s1')::jsonb ->> 'id', true);
select is(jsonb_array_length(public.media_share_list('asset', current_setting('t.asset1')::uuid)), 1, 'the link is listed for its file');
select is((select count(*)::int from public.media_shares), 1, 'a manager reads the links of the brand');
select throws_ok(format($$select public.media_share_create('{"kind":"asset","target_id":"%s","label":"x","max_downloads":0}'::jsonb)$$, current_setting('t.asset1')), 'share_invalid', 'a download limit of zero is refused');
select throws_ok(format($$select public.media_share_create('{"kind":"asset","target_id":"%s","label":"x","expires_at":"2020-01-01T00:00:00Z"}'::jsonb)$$, current_setting('t.asset1')), 'share_invalid_expiry', 'an expiry in the past is refused');
select throws_ok(format($$select public.media_share_create('{"kind":"asset","target_id":"%s","label":"x","password":"short"}'::jsonb)$$, current_setting('t.asset1')), 'password_weak', 'a short password is refused');
select throws_ok(format($$select public.media_share_create('{"kind":"asset","target_id":"%s","label":"x"}'::jsonb)$$, gen_random_uuid()), 'not_found', 'an unknown file is refused');
select throws_ok($$select public.media_share_create('{"kind":"folder","target_id":"00000000-0000-0000-0000-000000000001","label":"x"}'::jsonb)$$, 'share_target_invalid', 'an unknown kind is refused');
select set_config('t.s2', public.media_share_create(format('{"kind":"collection","target_id":"%s","label":"Campanha","password":"segredo-123","max_downloads":2,"include_subcollections":true}', current_setting('t.folder'))::jsonb)::text, true);
select set_config('t.tok2', current_setting('t.s2')::jsonb ->> 'token', true);
select set_config('t.sid2', current_setting('t.s2')::jsonb ->> 'id', true);
reset role;
select is((select count(*)::int from public.audit_events where action = 'media.share_created'), 2, 'creating links is audited');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.media_shares), 0, 'a manager of another brand reads no link');
select throws_ok(format($$select public.media_share_create('{"kind":"asset","target_id":"%s","label":"x"}'::jsonb)$$, current_setting('t.asset1')), 'not_found', 'nor shares a file of another brand');
select throws_ok(format($$select public.media_share_revoke('%s')$$, current_setting('t.sid1')), 'not_found', 'nor revokes it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select public.media_share_create('{"kind":"asset","target_id":"%s","label":"x"}'::jsonb)$$, current_setting('t.asset1')), 'denied', 'a role without media.share cannot create links');
select is((select count(*)::int from public.media_shares), 0, 'nor reads them');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.media_shares), 0, 'an external user reads no link');
select is(public.media_share_targets(), '[]'::jsonb, 'nor lists the shared targets');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.media_shares$$, 'permission denied for table media_shares', 'anon reads no table of the links');
select throws_ok($$select public.media_share_create('{}'::jsonb)$$, 'permission denied for function media_share_create', 'anon cannot create a link');
select is(public.media_share_public_open(current_setting('t.tok1'), null) ->> 'state', 'ok', 'anyone with the secret opens a link without password');
select is(jsonb_array_length(public.media_share_public_open(current_setting('t.tok1'), null) -> 'files'), 1, 'and sees the shared file');
select is(public.media_share_public_open('nope', null) ->> 'state', 'not_found', 'an unknown secret answers not_found');
select is(public.media_share_public_open(current_setting('t.tok2'), null) ->> 'state', 'password_required', 'a link with a password asks for it');
select is(public.media_share_public_unlock(current_setting('t.tok2'), 'errada-123') ->> 'state', 'wrong_password', 'a wrong password is refused');
select set_config('t.grant', public.media_share_public_unlock(current_setting('t.tok2'), 'segredo-123') ->> 'grant', true);
select is(jsonb_array_length(public.media_share_public_open(current_setting('t.tok2'), current_setting('t.grant')) -> 'files'), 2, 'the right password shows the folder and its subfolder files');
select is(public.media_share_public_file(current_setting('t.tok2'), 'wrong', current_setting('t.asset1')::uuid, 'download') ->> 'state', 'password_required', 'a file needs the session of the password');
select is(public.media_share_public_file(current_setting('t.tok1'), null, gen_random_uuid(), 'download') ->> 'state', 'not_found', 'a file outside the link is refused');
select is(public.media_share_public_file(current_setting('t.tok1'), null, current_setting('t.asset1')::uuid, 'download') ->> 'state', 'ok', 'a file of the link downloads');
select is(public.media_share_public_file(current_setting('t.tok2'), current_setting('t.grant'), current_setting('t.asset1')::uuid, 'download') ->> 'state', 'ok', 'the first download of a limited link works');
select is(public.media_share_public_file(current_setting('t.tok2'), current_setting('t.grant'), current_setting('t.asset2')::uuid, 'download') ->> 'state', 'ok', 'the second works');
select is(public.media_share_public_file(current_setting('t.tok2'), current_setting('t.grant'), current_setting('t.asset2')::uuid, 'download') ->> 'state', 'exhausted', 'the limit closes the link');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.media_share_revoke('%s')$$, current_setting('t.sid1')), 'a link is revoked');
reset role;
set local role anon;
select is(public.media_share_public_open(current_setting('t.tok1'), null) ->> 'state', 'revoked', 'a revoked link stops working at once');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"share"}'::jsonb)$$, 'slug_reserved', 'a site page cannot take the address of the share links');
select throws_ok($$select public.site_redirect_save('{"from":"/share/x","to":"/"}'::jsonb)$$, 'redirect_invalid', 'nor can a redirect start from it');
reset role;

select * from finish();
rollback;

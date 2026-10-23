begin;

select plan(21);

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
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'other@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Other Approver', 'other@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands limit 1), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', true, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.media_request_upload('profile', null, 'eu.pdf', 1000, 'application/pdf', 'idem-avatar-0001')$$, 'upload_type_not_allowed', 'a profile photo must be an image');
select throws_ok($$select public.media_request_upload('profile', null, 'eu.png', 6000000, 'image/png', 'idem-avatar-0002')$$, 'upload_too_large', 'and at most 5 MB');
select set_config('t.up1', public.media_request_upload('profile', null, 'eu.png', 1000, 'image/png', 'idem-avatar-0003')::text, true);
select set_config('t.v1', current_setting('t.up1')::jsonb ->> 'version_id', true);
select is((select count(*)::int from public.media_assets where scope = 'profile' and owner_id = '00000000-0000-0000-0000-0000000000c1'), 1, 'a collaborator without media.upload can start a profile photo upload');
select lives_ok(format($$select public.media_confirm_upload('%s', repeat('a', 64), 400, 400, null, 300)$$, current_setting('t.v1')), 'and confirm it');
select lives_ok(format($$select public.profile_set_avatar('%s')$$, current_setting('t.v1')), 'the owner sets it as the avatar');
select is((select count(*)::int from public.media_usages where usage_type = 'profile_avatar' and usage_ref_id = '00000000-0000-0000-0000-0000000000c1'), 1, 'the avatar is a usage of its file');
select is((select count(*)::int from jsonb_object_keys(public.person_avatar_keys(array['00000000-0000-0000-0000-0000000000c1']::uuid[]))), 1, 'the person reads their own avatar key');
select throws_ok($$select public.media_request_upload('site', null, 'x.png', 1000, 'image/png', 'idem-avatar-0004')$$, 'denied', 'the site scope still needs its action');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from jsonb_object_keys(public.person_avatar_keys(array['00000000-0000-0000-0000-0000000000c1']::uuid[]))), 1, 'a manager of the same brand reads the avatar key');
select is((select count(*)::int from public.media_assets where scope = 'profile'), 1, 'and sees the photo in the library (media.view)');
select throws_ok(format($$select public.profile_set_avatar('%s')$$, current_setting('t.v1')), 'avatar_invalid', 'nobody else can use that photo as their own');
select throws_ok(format($$select public.media_update('{"id":"%s","name":"x"}'::jsonb)$$, (select id from public.media_assets where scope = 'profile')), 'not_found', 'library actions on a profile photo are refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from jsonb_object_keys(public.person_avatar_keys(array['00000000-0000-0000-0000-0000000000c1']::uuid[]))), 1, 'a person with users.view reads it even without a shared brand');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from jsonb_object_keys(public.person_avatar_keys(array['00000000-0000-0000-0000-0000000000c1']::uuid[]))), 1, 'an external member of the same brand reads it');
select is((select count(*)::int from public.media_assets where scope = 'profile'), 0, 'but does not browse the library');
select set_config('t.up2', public.media_request_upload('profile', null, 'cliente.png', 1000, 'image/png', 'idem-avatar-0005')::text, true);
select set_config('t.v2', current_setting('t.up2')::jsonb ->> 'version_id', true);
select lives_ok(format($$select public.media_confirm_upload('%s', repeat('b', 64), 400, 400, null, 300)$$, current_setting('t.v2')), 'an external user uploads their own photo');
select lives_ok(format($$select public.profile_set_avatar('%s')$$, current_setting('t.v2')), 'and sets it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from jsonb_object_keys(public.person_avatar_keys(array['00000000-0000-0000-0000-0000000000d1']::uuid[]))), 0, 'an external user of another brand does not read it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$select public.profile_set_avatar(null)$$, 'the owner removes the avatar');
select is((select count(*)::int from public.media_usages where usage_type = 'profile_avatar' and usage_ref_id = '00000000-0000-0000-0000-0000000000c1'), 0, 'and the usage goes away');
reset role;

set local role anon;
select throws_ok($$select public.profile_set_avatar(null)$$, 'permission denied for function profile_set_avatar', 'anon cannot call it');
reset role;

select * from finish();
rollback;

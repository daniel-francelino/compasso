begin;

select plan(13);

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
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands limit 1), true);
select set_config('t.up1', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'logo.png', 1000, 'image/png', 'idem-logo-0001')::text, true);
select set_config('t.v1', current_setting('t.up1')::jsonb ->> 'version_id', true);
select public.media_confirm_upload(current_setting('t.v1')::uuid, repeat('a', 64), 400, 400, null, 300);
select set_config('t.up2', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'logo2.png', 1000, 'image/png', 'idem-logo-0002')::text, true);
select set_config('t.v2', current_setting('t.up2')::jsonb ->> 'version_id', true);
select public.media_confirm_upload(current_setting('t.v2')::uuid, repeat('b', 64), 400, 400, null, 300);
select set_config('t.up3', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'guia.pdf', 1000, 'application/pdf', 'idem-logo-0003')::text, true);
select set_config('t.v3', current_setting('t.up3')::jsonb ->> 'version_id', true);
select public.media_confirm_upload(current_setting('t.v3')::uuid, repeat('c', 64), null, null, null, 0);

select lives_ok(format($$select public.brand_set_logo('%s', '%s')$$, current_setting('t.brand'), current_setting('t.v1')), 'an image of the brand becomes its logo');
select is((select logo_media_version_id::text from public.brands where id = current_setting('t.brand')::uuid), current_setting('t.v1'), 'the brand points to the logo');
select is((select count(*)::int from public.media_usages where usage_type = 'brand_identity' and usage_ref_id = current_setting('t.brand')::uuid), 1, 'the logo is a usage of its file');
select is((select count(*)::int from public.brand_logo_keys(array[current_setting('t.brand')::uuid])), 1, 'the logo thumbnail key is readable by the brand team');
select throws_ok(format($$select public.brand_set_logo('%s', '%s')$$, current_setting('t.brand'), current_setting('t.v3')), 'logo_invalid', 'a PDF cannot be the logo');
select lives_ok(format($$select public.brand_set_logo('%s', '%s')$$, current_setting('t.brand'), current_setting('t.v2')), 'the logo can be replaced');
select is((select array_agg(media_version_id::text) from public.media_usages where usage_type = 'brand_identity' and usage_ref_id = current_setting('t.brand')::uuid), array[current_setting('t.v2')], 'the old logo is released and the new one is in use');
reset role;

select is((select count(*)::int from public.audit_events where action = 'brand.updated'), 2, 'changing the logo is audited as a brand update');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(format($$select public.brand_set_logo('%s', null)$$, current_setting('t.brand')), 'not_found', 'a manager of another brand cannot change the logo');
select is((select count(*)::int from public.brand_logo_keys(array[current_setting('t.brand')::uuid])), 0, 'nor read its logo key');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select public.brand_set_logo('%s', null)$$, current_setting('t.brand')), 'denied', 'a role without brands.update cannot change it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.brand_set_logo('%s', null)$$, current_setting('t.brand')), 'the logo can be removed');
select is((select count(*)::int from public.media_usages where usage_type = 'brand_identity' and usage_ref_id = current_setting('t.brand')::uuid), 0, 'and its usage goes away');
reset role;

select * from finish();
rollback;

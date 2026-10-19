begin;

select plan(25);

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

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
select public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"@aurora"}', current_setting('t.brand'))::jsonb);
select public.brand_set_logo(current_setting('t.brand')::uuid, current_setting('t.v1')::uuid);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(public.portal_get_brand(current_setting('t.brand')::uuid) ->> 'client_name', 'Cafe Aurora', 'a linked external user reads the brand profile with the client name');
select is(jsonb_array_length(public.portal_get_brand(current_setting('t.brand')::uuid) -> 'channels'), 1, 'and its active channels');
select ok(not (public.portal_get_brand(current_setting('t.brand')::uuid) ? 'references_notes') and not (public.portal_get_brand(current_setting('t.brand')::uuid) ? 'visual_identity'), 'but not the internal notes or the visual identity');
select is(public.portal_list_brands() -> 0 ->> 'client_name', 'Cafe Aurora', 'the portal brand list carries the client name');
select is((select count(*)::int from public.portal_brand_logo_keys(array[current_setting('t.brand')::uuid])), 1, 'the logo key of a linked brand is readable');
reset role;
update public.brands set description = 'Cafe de origem', references_notes = 'private' where id = current_setting('t.brand')::uuid;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.portal_get_brand('%s')$$, current_setting('t.brand')), 'not_found', 'an external user of another brand gets not found');
select is((select count(*)::int from public.portal_brand_logo_keys(array[current_setting('t.brand')::uuid])), 0, 'and no logo key');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.portal_get_brand('%s')$$, current_setting('t.brand')), 'denied', 'an internal manager is refused by the portal function');
select is((select count(*)::int from public.portal_brand_logo_keys(array[current_setting('t.brand')::uuid])), 0, 'and reads no key through it');
reset role;

set local role anon;
select throws_ok(format($$select public.portal_get_brand('%s')$$, current_setting('t.brand')), 'permission denied for function portal_get_brand', 'anon cannot call it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_get_brand('%s')$$, gen_random_uuid()), 'not_found', 'an unknown brand is not found');
select is(jsonb_array_length(public.portal_list_brands()), 1, 'the list holds only the linked brand');
reset role;

select * from finish();
rollback;

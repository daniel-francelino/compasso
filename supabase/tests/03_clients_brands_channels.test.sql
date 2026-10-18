begin;

select plan(58);

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
select set_config('t.clientA', public.client_save('{"name":"Grupo Aurora"}'::jsonb, true) ->> 'id', true);
select set_config('t.brandA', (select id::text from public.brands where client_id = current_setting('t.clientA')::uuid), true);
select is((select count(*)::int from public.brands where name = 'Grupo Aurora'), 1, 'creating a client can create the first brand with the same name');
select is(
  (select count(*)::int from public.brand_members where brand_id = current_setting('t.brandA')::uuid and user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'internal'),
  1,
  'the creator is linked to the new brand'
);
select is((select timezone from public.brands where id = current_setting('t.brandA')::uuid), 'America/Sao_Paulo', 'the brand takes the organization time zone');
reset role;

select is(
  (select count(*)::int from public.audit_events where action in ('client.created', 'brand.created')),
  2,
  'client and brand creation are audited'
);
select is(
  (select brand_id::text from public.audit_events where action = 'brand.created'),
  current_setting('t.brandA'),
  'the brand event carries the brand id'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select set_config('t.clientB', public.client_save('{"name":"Padaria Sol"}'::jsonb, true) ->> 'id', true);
select set_config('t.brandB', (select id::text from public.brands where client_id = current_setting('t.clientB')::uuid), true);
select is((select count(*)::int from public.clients), 1, 'manager two sees only the own client');
select is((select count(*)::int from public.brands), 1, 'manager two sees only the own brand');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.clients), 2, 'the owner sees every client');
select is((select count(*)::int from public.brands), 2, 'the owner sees every brand');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.clients), 0, 'an unlinked collaborator sees no client');
select throws_ok($$select public.client_save('{"name":"Nope Ltda"}'::jsonb, false)$$, 'denied', 'a collaborator cannot create clients');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  format($$select public.brand_member_set('%s', '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active')$$, current_setting('t.brandA')),
  'a manager links a collaborator to the brand'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.clients), 1, 'the linked collaborator sees the client');
select is((select count(*)::int from public.brands), 1, 'the linked collaborator sees the brand');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($$select public.brand_save(jsonb_build_object('id', '%s', 'name', 'Aurora', 'expected_version', 99))$$, current_setting('t.brandA')),
  'conflict',
  'a stale version is refused'
);
select throws_ok(
  format($$select public.channel_save(jsonb_build_object('brand_id', '%s', 'platform', 'instagram', 'profile_name', 'x'))$$, current_setting('t.brandB')),
  'not_found',
  'a manager cannot create a channel on a brand they are not linked to'
);
select throws_ok(
  format($$select public.client_save(jsonb_build_object('id', '%s', 'name', 'Hacked', 'expected_version', 1))$$, current_setting('t.clientB')),
  'not_found',
  'a manager cannot edit a client of another brand'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  (public.client_save(format('{"id":"%s","name":"Grupo Aurora SA","owner_user_id":"00000000-0000-0000-0000-0000000000b1","expected_version":1}', current_setting('t.clientA'))::jsonb) ->> 'version')::int,
  2,
  'editing a client increments the version'
);
select throws_ok(
  format($$select public.client_save('{"id":"%s","name":"Again","expected_version":1}'::jsonb)$$, current_setting('t.clientA')),
  'conflict',
  'the old version now conflicts'
);
select throws_ok($$select public.client_save('{"name":"X"}'::jsonb)$$, 'invalid_input', 'a one-letter name is refused');
reset role;

select is(
  (select count(*)::int from public.audit_events where action = 'client.updated' and entity_id = current_setting('t.clientA')::uuid),
  1,
  'the client update is audited'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($$select public.client_contact_save(jsonb_build_object('client_id', '%s', 'name', 'Ana', 'email', 'not-an-email'))$$, current_setting('t.clientA')),
  'contact_email_invalid',
  'an invalid contact e-mail is refused'
);
select set_config('t.contact1', public.client_contact_save(format('{"client_id":"%s","name":"Ana","email":"ana@example.test","is_primary":true}', current_setting('t.clientA'))::jsonb) ->> 'id', true);
select set_config('t.contact2', public.client_contact_save(format('{"client_id":"%s","name":"Beto","is_primary":true}', current_setting('t.clientA'))::jsonb) ->> 'id', true);
select is(
  (select count(*)::int from public.client_contacts where client_id = current_setting('t.clientA')::uuid and is_primary),
  1,
  'only one primary contact per client'
);
select is((select is_primary from public.client_contacts where id = current_setting('t.contact2')::uuid), true, 'the newest primary wins');
select lives_ok(format($$select public.client_contact_delete('%s')$$, current_setting('t.contact1')), 'a contact can be deleted');
select throws_ok(format($$select public.client_delete('%s')$$, current_setting('t.clientA')), 'client_has_brands', 'a client with brands is not deleted (manager)');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($$select public.brand_save(jsonb_build_object('client_id', '%s', 'name', 'grupo aurora'))$$, current_setting('t.clientA')),
  'brand_name_taken',
  'brand names are unique per client, ignoring case'
);
select throws_ok(
  format($$select public.brand_save(jsonb_build_object('client_id', '%s', 'name', 'Aurora Café', 'timezone', 'Mars/Phobos'))$$, current_setting('t.clientA')),
  'invalid_input',
  'an unknown time zone is refused'
);
select set_config('t.brandA2', public.brand_save(format('{"client_id":"%s","name":"Aurora Café","timezone":"America/Recife"}', current_setting('t.clientA'))::jsonb) ->> 'id', true);
select is((select timezone from public.brands where id = current_setting('t.brandA2')::uuid), 'America/Recife', 'a brand keeps its own time zone');
select lives_ok(
  format($$select public.brand_save(jsonb_build_object('id', '%s', 'name', 'Aurora Café', 'timezone', 'America/Sao_Paulo', 'expected_version', 1))$$, current_setting('t.brandA2')),
  'a brand time zone can change'
);
reset role;

select is(
  (select count(*)::int from public.audit_events where action = 'brand.timezone_changed' and entity_id = current_setting('t.brandA2')::uuid),
  1,
  'the time zone change is audited'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($$select public.brand_member_set('%s', '00000000-0000-0000-0000-0000000000d1', 'internal', false, 'active')$$, current_setting('t.brandA')),
  'member_kind_mismatch',
  'an external account cannot be linked as internal'
);
select lives_ok(
  format($$select public.brand_member_set('%s', '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active')$$, current_setting('t.brandA')),
  'an external account is linked as external with decision rights'
);
select throws_ok(
  format($$select public.brand_member_set('%s', '00000000-0000-0000-0000-0000000000b1', 'internal', false, 'revoked')$$, current_setting('t.brandA2')),
  'last_internal_member',
  'the last internal member cannot be revoked'
);
reset role;

select is(
  (select count(*)::int from public.audit_events where action = 'brand.member_added' and brand_id = current_setting('t.brandA')::uuid),
  2,
  'member additions are audited'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.clients), 0, 'an external member reads no client');
select is((select count(*)::int from public.brands), 0, 'an external member reads no brand');
select is((select count(*)::int from public.brand_members), 0, 'an external member reads no member row');
select is((select count(*)::int from public.channels), 0, 'an external member reads no channel');
select is((select count(*)::int from public.client_contacts), 0, 'an external member reads no contact');
select throws_ok($$select public.client_save('{"name":"Externo Ltda"}'::jsonb, false)$$, 'denied', 'an external user cannot write clients');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.channel1', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brandA'))::jsonb) ->> 'id', true);
select is((select profile_name from public.channels where id = current_setting('t.channel1')::uuid), '@aurora.cafe', 'Instagram handles are normalized with @');
select throws_ok(
  format($$select public.channel_save(jsonb_build_object('brand_id', '%s', 'platform', 'instagram', 'profile_name', '@AURORA.cafe'))$$, current_setting('t.brandA')),
  'channel_duplicate',
  'the same active profile cannot be registered twice'
);
select throws_ok(
  format($$select public.channel_save(jsonb_build_object('brand_id', '%s', 'platform', 'blog', 'profile_name', 'Blog', 'profile_url', 'http://insecure.test'))$$, current_setting('t.brandA')),
  'invalid_input',
  'a channel URL must be https'
);
select throws_ok(
  format($$select public.channel_save(jsonb_build_object('brand_id', '%s', 'platform', 'myspace', 'profile_name', 'x'))$$, current_setting('t.brandA')),
  'invalid_input',
  'an unknown platform is refused'
);
select lives_ok(format($$select public.channel_set_archived('%s', true)$$, current_setting('t.channel1')), 'a channel can be archived');
select lives_ok(
  format($$select public.channel_save(jsonb_build_object('brand_id', '%s', 'platform', 'instagram', 'profile_name', 'aurora.cafe'))$$, current_setting('t.brandA')),
  'an archived channel frees its name'
);
select lives_ok(format($$select public.channel_delete('%s')$$, current_setting('t.channel1')), 'a manager can delete an unused channel');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.channel_delete('%s')$$, current_setting('t.channel1')), 'not_found', 'a deleted channel is gone');
select throws_ok(format($$select public.brand_delete('%s')$$, current_setting('t.brandA')), 'brand_not_empty', 'a brand with channels is not deleted');
select throws_ok(format($$select public.client_delete('%s')$$, current_setting('t.clientA')), 'client_has_brands', 'a client with brands is not deleted');
select is(
  (select count(*)::int from public.audit_events where brand_id = current_setting('t.brandA')::uuid),
  (select count(*)::int from public.audit_events where brand_id = current_setting('t.brandA')::uuid),
  'the owner reads brand-scoped audit events'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.audit_events), 0, 'a manager without audit.view reads no audit event');
reset role;

set local role anon;
select throws_ok($$select * from public.clients$$, 'permission denied for table clients', 'anon cannot read clients');
select throws_ok($$select * from public.brands$$, 'permission denied for table brands', 'anon cannot read brands');
select throws_ok($$select * from public.channels$$, 'permission denied for table channels', 'anon cannot read channels');
select throws_ok($$select public.can_access_brand(gen_random_uuid())$$, 'permission denied for function can_access_brand', 'anon cannot call the access helper');
reset role;

select throws_ok(
  $$insert into public.brand_members (brand_id, user_id, kind, can_decide) select id, '00000000-0000-0000-0000-0000000000b1', 'internal', true from public.brands limit 1$$,
  '23514',
  null,
  'only external members may have decision rights'
);

select * from finish();
rollback;

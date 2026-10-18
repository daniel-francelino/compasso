begin;

select plan(35);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'owner2@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'pending@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'owner'),
  ('00000000-0000-0000-0000-0000000000a2'::uuid, 'Owner Two', 'owner2@example.test', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'collaborator')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

insert into public.profiles (id, full_name, email, status)
values ('00000000-0000-0000-0000-0000000000f1', 'Pending', 'pending@example.test', 'pending');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$select public.profile_set_access('00000000-0000-0000-0000-0000000000c1', 'suspended')$$,
  'denied',
  'a manager cannot suspend people'
);
select throws_ok($$select public.role_save('{"name":"Hack","actions":["clients.view"]}'::jsonb)$$, 'denied', 'a manager cannot manage roles');
select throws_ok($$select public.organization_save('{"name":"X"}'::jsonb)$$, 'denied', 'a manager cannot edit the organization');
select throws_ok($$select public.audit_list('{}'::jsonb, 1)$$, 'denied', 'a manager cannot read the audit');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$select public.profile_set_access('00000000-0000-0000-0000-0000000000f1', 'approved', (select id from public.roles where key = 'collaborator'))$$,
  'an owner approves a pending account with a role'
);
select lives_ok($$select public.profile_set_access('00000000-0000-0000-0000-0000000000c1', 'suspended', null)$$, 'an owner suspends a collaborator');
select throws_ok($$select public.profile_set_access('00000000-0000-0000-0000-0000000000a1', 'suspended', null)$$, 'self_change_forbidden', 'an owner cannot suspend themselves');
select throws_ok($$select public.profile_set_access('00000000-0000-0000-0000-0000000000c1', 'weird', null)$$, 'invalid_input', 'an unknown status is refused');
reset role;

select is(
  (select count(*)::int from public.profile_audit where profile_id = '00000000-0000-0000-0000-0000000000c1' and action = 'status_changed'),
  1,
  'the suspension is in the access audit'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select set_config('t.role', public.role_save('{"name":"Editor do Site","description":"Edita o site","actions":["site.view","site.edit","media.view","media.upload"]}'::jsonb) ->> 'id', true);
select is((select key from public.roles where id = current_setting('t.role')::uuid), 'editor_do_site', 'the role key is a slug of the name');
select is((select count(*)::int from public.role_actions where role_id = current_setting('t.role')::uuid), 4, 'the chosen actions are saved');
select throws_ok(
  $$select public.role_save('{"name":"Quebrado","actions":["site.edit"]}'::jsonb)$$,
  'action_requires_read',
  'a write action without its read action is refused'
);
select throws_ok(
  $$select public.role_save('{"name":"Admin demais","actions":["roles.manage"]}'::jsonb)$$,
  'admin_only_action',
  'an administration-only action cannot be given to a role'
);
select throws_ok(
  $$select public.role_save('{"name":"Portal ruim","portal_only":true,"actions":["portal.view","content.view"]}'::jsonb)$$,
  'portal_role_internal_action',
  'a portal-only role takes only portal actions'
);
select throws_ok($$select public.role_save('{"name":"Fantasma","actions":["nope.nothing"]}'::jsonb)$$, 'invalid_input', 'an unknown action is refused');
select lives_ok(
  format($$select public.role_save('{"id":"%s","name":"Editor do Site","actions":["site.view","media.view"]}'::jsonb)$$, current_setting('t.role')),
  'a role can lose actions'
);
select is((select count(*)::int from public.role_actions where role_id = current_setting('t.role')::uuid), 2, 'removed actions are gone');
select throws_ok($$select public.role_save(jsonb_build_object('id', (select id from public.roles where key = 'owner'), 'name', 'Boss', 'actions', '[]'::jsonb))$$, 'role_system_protected', 'the owner role cannot be edited');
select lives_ok(format($$select public.role_delete('%s')$$, current_setting('t.role')), 'an unused role is deleted');
select throws_ok($$select public.role_delete((select id from public.roles where key = 'manager'))$$, 'role_in_use', 'a role in use is not deleted');
reset role;

select is(
  (select count(*)::int from public.role_audit where action = 'deleted'),
  1,
  'role deletion is in the role audit'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.organization_save('{"name":"Compasso","default_timezone":"America/Sao_Paulo","expected_version":9}'::jsonb)$$, 'conflict', 'a stale organization version conflicts');
select throws_ok($$select public.organization_save('{"name":"Compasso","default_timezone":"Mars/Base","expected_version":1}'::jsonb)$$, 'invalid_input', 'an invalid time zone is refused');
select is(
  (public.organization_save('{"name":"Compasso Marketing","legal_name":"Compasso Ltda","default_timezone":"America/Recife","contact_email":"oi@compasso.test","expected_version":1}'::jsonb) ->> 'version')::int,
  2,
  'saving the organization increments the version'
);
select is(
  (public.organization_setting_save('policies.approvals', '{"deadline_days":3}'::jsonb, 0) ->> 'version')::int,
  1,
  'a policy group is created'
);
select is(
  (public.organization_setting_save('policies.approvals', '{"deadline_days":5}'::jsonb, 1) ->> 'version')::int,
  2,
  'a policy group is updated with the right version'
);
select throws_ok($$select public.organization_setting_save('policies.approvals', '{}'::jsonb, 1)$$, 'conflict', 'a stale policy version conflicts');
select throws_ok($$select public.organization_setting_save('policies.unknown', '{}'::jsonb, 0)$$, 'invalid_input', 'an unknown policy key is refused');
select is((select count(*)::int from public.audit_events where action = 'organization.updated'), 1, 'organization changes are audited');
select is((select count(*)::int from public.audit_events where action = 'settings.policy_changed'), 2, 'policy changes are audited');
select is((public.audit_list('{"domain":"settings"}'::jsonb, 1) ->> 'total')::int, 2, 'the audit list filters by domain');
select is(jsonb_array_length(public.audit_list('{}'::jsonb, 1) -> 'rows') > 0, true, 'the audit list returns rows');
select is((public.audit_list('{}'::jsonb, 99) -> 'rows')::text, '[]', 'a page past the end is empty');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.audit_list('{}'::jsonb, 1, true)$$, 'the owner exports the audit');
reset role;
select is((select count(*)::int from public.audit_events where action = 'audit.exported'), 1, 'the export is itself audited');

select * from finish();
rollback;

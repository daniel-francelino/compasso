begin;

select plan(61);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'owner2@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'suspended@example.test'),
  ('00000000-0000-0000-0000-0000000000f1', 'pending@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, u.status, u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner One', 'owner@example.test', 'approved', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'approved', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'approved', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'approved', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Suspended', 'suspended@example.test', 'suspended', 'internal', 'manager')
) as u (id, name, email, status, kind, role_key)
join public.roles r on r.key = u.role_key;

insert into public.profiles (id, full_name, email, status)
values ('00000000-0000-0000-0000-0000000000f1', 'Pending', 'pending@example.test', 'pending');

select is((select count(*)::int from public.roles), 6, 'six roles are seeded');
select is((select count(*)::int from public.actions), 53, 'the action catalog is seeded');
select is((select is_system from public.roles where key = 'owner'), true, 'owner is a system role');
select is(
  (select count(*)::int from public.role_actions ra join public.roles r on r.id = ra.role_id where r.key = 'owner'),
  0,
  'owner keeps no action rows (access is implicit)'
);
select is(
  (select count(*)::int from public.actions where admin_only order by 1),
  3,
  'three administration-only actions'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(public.is_admin(), true, 'owner is admin');
select is(public.has_action('anything.at_all'), true, 'owner has any action, including future ones');
select is(cardinality(public.my_actions()), 53, 'owner my_actions lists the whole catalog');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(public.is_admin(), false, 'manager is not admin');
select is(public.has_action('clients.update'), true, 'manager can update clients');
select is(public.has_action('roles.manage'), false, 'manager cannot manage roles');
select is(public.has_action('users.manage'), false, 'manager has no administration-only action');
select is(public.has_action('content.delete'), false, 'manager cannot delete content');
select ok(not ('settings.manage' = any (public.my_actions())), 'manager my_actions excludes admin-only actions');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(public.has_action('clients.view'), true, 'collaborator can view clients');
select is(public.has_action('clients.create'), false, 'collaborator cannot create clients');
select is(public.has_action('invitations.create'), false, 'collaborator cannot invite');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(public.has_action('approvals.decide'), true, 'external approver can decide approvals');
select is(public.has_action('content.view'), false, 'external approver has no internal action');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is(public.has_action('clients.view'), false, 'a suspended account has no action');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is(public.has_action('clients.view'), false, 'a pending account has no action');
select is(public.is_admin(), false, 'a pending account is not admin');
reset role;

select pg_temp.act_as_anon();
select throws_ok($$select * from public.profiles$$, 'permission denied for table profiles', 'anon cannot read profiles');
select throws_ok($$select * from public.roles$$, 'permission denied for table roles', 'anon cannot read roles');
select throws_ok($$select public.has_action('clients.view')$$, 'permission denied for function has_action', 'anon cannot call has_action');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.profiles), 1, 'a collaborator sees only the own profile');
select is((select count(*)::int from public.roles), 6, 'an approved account reads the roles');
select is((select count(*)::int from public.organizations), 1, 'an approved account reads the organization');
select is((select count(*)::int from public.organization_settings), 0, 'settings need settings.manage');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.profiles), 6, 'users.view shows every profile');
select throws_ok(
  $$update public.profiles set role_id = (select id from public.roles where key = 'owner') where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'permission denied for table profiles',
  'a client cannot update its own role column'
);
select lives_ok(
  $$update public.profiles set full_name = 'Manager Renamed' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'a client can update its own name'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000f1');
select is((select count(*)::int from public.organizations), 0, 'a pending account does not read the organization');
reset role;

select throws_ok(
  $$update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'last_owner',
  'the last owner cannot be suspended'
);
select throws_ok(
  $$update public.profiles set role_id = (select id from public.roles where key = 'manager') where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'last_owner',
  'the last owner cannot lose the role'
);
select throws_ok(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'last_owner',
  'the last owner cannot be deleted'
);

insert into public.profiles (id, full_name, email, status, kind, role_id)
select '00000000-0000-0000-0000-0000000000a2', 'Owner Two', 'owner2@example.test', 'approved', 'internal', r.id
from public.roles r where r.key = 'owner';

select lives_ok(
  $$update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a2'$$,
  'an owner can be suspended while another remains'
);
select is(
  (select count(*)::int from public.profile_audit where profile_id = '00000000-0000-0000-0000-0000000000a2' and action = 'status_changed'),
  1,
  'the status change is in profile_audit'
);

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b1')::text, true);
select throws_ok(
  $$update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'self_change_forbidden',
  'nobody changes their own status'
);
select throws_ok(
  $$update public.profiles set role_id = (select id from public.roles where key = 'owner') where id = '00000000-0000-0000-0000-0000000000c1'$$,
  'role_not_assignable',
  'a non-owner cannot assign the owner role'
);
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1')::text, true);
select lives_ok(
  $$update public.profiles set role_id = (select id from public.roles where key = 'manager') where id = '00000000-0000-0000-0000-0000000000c1'$$,
  'an owner can assign a regular role'
);
select set_config('request.jwt.claims', '', true);

select throws_ok(
  $$update public.profiles set status = 'approved' where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '23514',
  null,
  'an account cannot be approved without a role'
);
select throws_ok(
  $$update public.profiles set role_id = (select id from public.roles where key = 'external_approver') where id = '00000000-0000-0000-0000-0000000000b1'$$,
  'role_not_assignable',
  'an internal user cannot hold a portal-only role'
);
select throws_ok(
  $$update public.profiles set role_id = (select id from public.roles where key = 'manager') where id = '00000000-0000-0000-0000-0000000000d1'$$,
  'role_not_assignable',
  'an external user cannot hold an internal role'
);

select throws_ok(
  $$insert into public.role_actions (role_id, action_key) select id, 'clients.view' from public.roles where key = 'owner'$$,
  'role_system_protected',
  'the owner role takes no action rows'
);
select throws_ok(
  $$insert into public.role_actions (role_id, action_key) select id, 'roles.manage' from public.roles where key = 'manager'$$,
  'admin_only_action',
  'an administration-only action cannot go into a role'
);
select throws_ok(
  $$insert into public.role_actions (role_id, action_key) select id, 'content.view' from public.roles where key = 'external_commenter'$$,
  'portal_role_internal_action',
  'a portal-only role takes only portal actions'
);
select throws_ok(
  $$delete from public.role_actions where role_id = (select id from public.roles where key = 'collaborator') and action_key = 'content.view'; set constraints all immediate$$,
  'action_requires_read',
  'removing a read action that a write action needs is refused'
);
select throws_ok(
  $$insert into public.role_actions (role_id, action_key) select id, 'content.delete' from public.roles where key = 'external_approver'$$,
  'portal_role_internal_action',
  'an internal action is refused in an external role'
);

select throws_ok($$delete from public.roles where key = 'owner'$$, 'role_system_protected', 'the owner role cannot be deleted');
select throws_ok($$update public.roles set name = 'Boss' where key = 'owner'$$, 'role_system_protected', 'the owner role cannot be edited');
select throws_ok($$delete from public.roles where key = 'manager'$$, 'role_in_use', 'a role in use cannot be deleted');
select lives_ok(
  $$insert into public.roles (key, name) values ('temp_role', 'Temporary role'); delete from public.roles where key = 'temp_role'$$,
  'an unused role can be created and deleted'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.organizations), 0, 'an external user does not read the organization');
select is((select count(*)::int from public.roles), 1, 'an external user reads only its own role');
select is((select count(*)::int from public.actions), 0, 'an external user does not read the action catalog');
select is((select count(*)::int from public.role_actions), 0, 'an external user does not read role actions');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.profile_audit), 0, 'an external user does not read the profile audit');
select is((select count(*)::int from public.role_audit), 0, 'an external user does not read the role audit');
select throws_ok($$insert into public.roles (key, name) values ('x', 'X')$$, 'permission denied for table roles', 'a client cannot insert roles');
reset role;

select throws_ok(
  $$update public.profiles set full_name = '' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '23514',
  null,
  'an empty name is refused'
);

select * from finish();
rollback;

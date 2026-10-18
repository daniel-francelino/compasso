begin;

select plan(14);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select lives_ok(
  $$select public.audit_write((select id from public.organizations), null, 'settings.policy_changed', 'organization_setting', null, '{"key":"policies.approvals"}')$$,
  'the writer accepts a catalog action'
);
select is(
  (select actor_kind from public.audit_events where action = 'settings.policy_changed'),
  'system',
  'an event without a session is written by the system'
);
select throws_ok(
  $$select public.audit_write((select id from public.organizations), null, 'made.up_action', 'x', null, '{}')$$,
  'invalid_input',
  'an action outside the catalog is refused'
);
select is((select count(*)::int from public.audit_events), 1, 'a refused event leaves nothing behind');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000d1')::text, true);
select public.audit_write((select id from public.organizations), null, 'comment.created', 'comment', null, '{}');
select is(
  (select actor_kind from public.audit_events where action = 'comment.created'),
  'external',
  'an external actor is recorded as external'
);
select set_config('request.jwt.claims', '', true);

select throws_ok($$update public.audit_events set action = 'client.created'$$, 'audit_immutable', 'events cannot be updated');
select throws_ok($$delete from public.audit_events$$, 'audit_immutable', 'events cannot be deleted by default');
select lives_ok(
  $$select set_config('compasso.audit_purge', 'on', true); delete from public.audit_events where action = 'comment.created'$$,
  'the retention routine can purge with its flag'
);
select is((select count(*)::int from public.audit_events), 1, 'only the purged event is gone');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.audit_events), 1, 'an owner reads organization-level events');
select throws_ok(
  $$select public.audit_write((select id from public.organizations), null, 'client.created', 'client', null, '{}')$$,
  'permission denied for function audit_write',
  'a signed-in user cannot call the writer directly'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.audit_events), 0, 'a manager without audit.view reads nothing');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.audit_events), 0, 'an external user reads nothing');
reset role;

set local role anon;
select throws_ok($$select * from public.audit_events$$, 'permission denied for table audit_events', 'anon cannot read the audit');
reset role;

select * from finish();
rollback;

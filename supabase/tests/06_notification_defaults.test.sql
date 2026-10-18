begin;

select plan(8);

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
select throws_ok(
  $$select public.notification_kind_save('invitation.expiring', '{2}', true)$$,
  'denied',
  'a manager cannot change notification defaults'
);
reset role;

insert into public.notification_kinds (kind, title, required_action, severity, available)
values ('test.hidden', 'Hidden kind', 'site.view', 'info', false);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$select public.notification_kind_save('invitation.expiring', '{3,1}', false)$$,
  'an owner changes the defaults of a schedulable kind'
);
select is(
  (select default_lead_days from public.notification_kinds where kind = 'invitation.expiring'),
  '{3,1}'::int[],
  'the lead days were saved'
);
select throws_ok(
  $$select public.notification_kind_save('invitation.accepted', '{2}', true)$$,
  'invalid_input',
  'lead days are refused on a kind that is not scheduled'
);
select throws_ok(
  $$select public.notification_kind_save('invitation.expiring', '{99}', true)$$,
  'invalid_input',
  'lead days above 30 are refused'
);
select throws_ok(
  $$select public.notification_kind_save('test.hidden', null, true)$$,
  'not_found',
  'a kind that is not available yet is refused'
);
reset role;

select is(
  (select count(*)::int from public.audit_events where action = 'settings.policy_changed'),
  1,
  'the change is audited'
);

select throws_ok(
  $$select public.notify_users('invitation.accepted', null, 'T', 'B', '//evil.test', 'ref', null, 'bad-link', array['00000000-0000-0000-0000-0000000000a1']::uuid[])$$,
  '23514',
  null,
  'a protocol-relative link is refused'
);

select * from finish();
rollback;

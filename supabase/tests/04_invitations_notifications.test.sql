begin;

select plan(44);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'marta@cliente.test', '{"full_name":"Marta Silva"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'wrong@cliente.test', '{}');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'collaborator')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.client', public.client_save('{"name":"Cafe Aurora"}'::jsonb, true) ->> 'id', true);
select set_config('t.brand', (select id::text from public.brands limit 1), true);
select set_config('t.approverRole', (select id::text from public.roles where key = 'external_approver'), true);
select set_config('t.ownerRole', (select id::text from public.roles where key = 'owner'), true);
select set_config('t.managerRole', (select id::text from public.roles where key = 'manager'), true);

select is(
  (public.invitation_create(
    'Marta@Cliente.test', current_setting('t.approverRole')::uuid,
    format('[{"brand_id":"%s","can_decide":true}]', current_setting('t.brand'))::jsonb,
    repeat('a', 64), now() + interval '7 days'
  ) ->> 'id') is not null,
  true,
  'a manager invites an external approver to a linked brand'
);
select throws_ok(
  format($$select public.invitation_create('x@cliente.test', '%s', '[]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.ownerRole'), repeat('b', 64)),
  'role_not_assignable',
  'a non-owner cannot invite someone as owner'
);
select throws_ok(
  format($$select public.invitation_create('x@cliente.test', '%s', '[]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.approverRole'), repeat('b', 64)),
  'invalid_input',
  'a portal role needs at least one brand'
);
select throws_ok(
  format($$select public.invitation_create('x@cliente.test', '%s', '[{"brand_id":"00000000-0000-0000-0000-00000000dead"}]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.approverRole'), repeat('b', 64)),
  'not_found',
  'a brand the inviter cannot access is refused'
);
select throws_ok(
  format($$select public.invitation_create('manager@example.test', '%s', '[]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.managerRole'), repeat('b', 64)),
  'invalid_input',
  'an e-mail that already has an account is refused'
);
select throws_ok(
  format($$select public.invitation_create('not-mail', '%s', '[]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.managerRole'), repeat('b', 64)),
  'invalid_input',
  'an invalid e-mail is refused'
);
select is((select count(*)::int from public.invitations), 1, 'a manager with users.view lists invitations');
select throws_ok($$select token_hash from public.invitations$$, 'permission denied for table invitations', 'the token hash is never readable by clients');
select set_config('t.firstInvitation', (select id::text from public.invitations limit 1), true);
select lives_ok(
  format($$select public.invitation_create('marta@cliente.test', '%s', '[{"brand_id":"%s","can_decide":true}]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.approverRole'), current_setting('t.brand'), repeat('c', 64)),
  're-inviting the same e-mail creates a new invitation'
);
select is(
  (select status from public.invitations where id = current_setting('t.firstInvitation')::uuid),
  'revoked',
  'the previous pending invitation is revoked'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  format($$select public.invitation_create('z@cliente.test', '%s', '[]'::jsonb, '%s', now() + interval '7 days')$$, current_setting('t.managerRole'), repeat('d', 64)),
  'denied',
  'a collaborator cannot invite'
);
select is((select count(*)::int from public.invitations), 0, 'a collaborator does not list invitations');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select throws_ok($$select public.accept_invitation('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')$$, 'invitation_email_mismatch', 'the signed-in e-mail must equal the invited e-mail');
select throws_ok($$select public.accept_invitation('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')$$, 'invitation_invalid', 'an unknown token is refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$select * from public.profiles where false; select public.accept_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$, 'invitation_invalid', 'a revoked invitation cannot be accepted');
select is(
  (public.accept_invitation('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc') ->> 'kind'),
  'external',
  'accepting creates an external profile'
);
select throws_ok($$select public.accept_invitation('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')$$, 'invitation_invalid', 'an accepted invitation cannot be reused');
reset role;

select is(
  (select status || '/' || kind from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  'approved/external',
  'the new profile is approved and external'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  'Marta Silva',
  'the name comes from the account metadata'
);
select is(
  (select can_decide from public.brand_members where user_id = '00000000-0000-0000-0000-0000000000e1' and brand_id = current_setting('t.brand')::uuid),
  true,
  'the brand link keeps the decision right'
);
select is(
  (select count(*)::int from public.audit_events where action = 'invitation.accepted'),
  1,
  'acceptance is audited'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.notifications where kind = 'invitation.accepted'), 1, 'the inviter receives the notification');
select lives_ok(
  $$update public.notifications set read_at = now() where kind = 'invitation.accepted'$$,
  'the owner of a notification marks it as read'
);
select throws_ok($$update public.notifications set title = 'hacked'$$, 'permission denied for table notifications', 'only read_at and snoozed_until are writable');
select throws_ok($$insert into public.notifications (user_id, kind, title, dedupe_key) values ('00000000-0000-0000-0000-0000000000b1', 'site.published', 'x', 'k')$$, 'permission denied for table notifications', 'clients cannot create notifications');
select throws_ok($$select * from public.email_outbox$$, 'permission denied for table email_outbox', 'the outbox is not readable');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.notifications), 0, 'an external user does not see the inviter notification');
select is((select count(*)::int from public.invitations), 0, 'an external user does not see invitations');
select is((select count(*)::int from public.brands), 0, 'the new external member still reads no brand table');
reset role;

select is(
  (select count(*)::int from public.email_outbox where template = 'invitation.accepted' and to_email = 'manager@example.test'),
  1,
  'an e-mail is queued for the inviter by default'
);

select lives_ok(
  $$select public.notify_users('invitation.accepted', null, 'T', 'B', '/admin', 'invitation', gen_random_uuid(), 'dup-key', array['00000000-0000-0000-0000-0000000000b1']::uuid[]);
    select public.notify_users('invitation.accepted', null, 'T', 'B', '/admin', 'invitation', gen_random_uuid(), 'dup-key', array['00000000-0000-0000-0000-0000000000b1']::uuid[])$$,
  'notifying twice with the same key does not fail'
);
select is((select count(*)::int from public.notifications where dedupe_key = 'dup-key'), 1, 'the dedupe key prevents duplicates');

insert into public.notification_preferences (user_id, kind, enabled)
values ('00000000-0000-0000-0000-0000000000b1', 'invitation.accepted', false);
select public.notify_users('invitation.accepted', null, 'T', 'B', '/admin', 'invitation', gen_random_uuid(), 'pref-key', array['00000000-0000-0000-0000-0000000000b1']::uuid[]);
select is((select count(*)::int from public.notifications where dedupe_key = 'pref-key'), 0, 'a disabled kind is not delivered');

select public.notify_users('site.published', null, 'T', 'B', '/admin', 'site', gen_random_uuid(), 'site-key', array['00000000-0000-0000-0000-0000000000b1']::uuid[]);
select is((select count(*)::int from public.notifications where dedupe_key = 'site-key'), 0, 'a person without the required action is skipped');

select public.notify_users('invitation.accepted', current_setting('t.brand')::uuid, 'T', 'B', '/admin', 'invitation', gen_random_uuid(), 'brand-key', array['00000000-0000-0000-0000-0000000000c1']::uuid[]);
select is((select count(*)::int from public.notifications where dedupe_key = 'brand-key'), 0, 'a person not linked to the brand is skipped');

select public.resolve_notifications('invitation', (select ref_id from public.notifications where kind = 'invitation.accepted' and dedupe_key like 'invitation.accepted:%' limit 1));
select is((select count(*)::int from public.notifications where status = 'resolved'), 1, 'resolving the origin resolves the notification');

select throws_ok($$select public.notify_users('made.up', null, 't', 'b', '/x', 'x', null, 'k', null)$$, 'invalid_input', 'an unknown kind is refused');
select is((public.generate_due_notifications() ->> 'failed')::int, 0, 'the scheduled routine runs its scanners without failures');

update public.invitations set expires_at = now() - interval '1 day' where status = 'pending';
select public.notify_scan_invitations();
select is((select count(*)::int from public.invitations where status = 'expired'), 0, 'no pending invitation is left to expire in this scenario');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.generate_due_notifications()$$, 'permission denied for function generate_due_notifications', 'clients cannot trigger the routine');
select throws_ok($$select public.notify_users('invitation.accepted', null, 't', 'b', '/x', 'x', null, 'k2', null)$$, 'permission denied for function notify_users', 'clients cannot call the notification writer');
reset role;

set local role anon;
select throws_ok($$select * from public.notifications$$, 'permission denied for table notifications', 'anon cannot read notifications');
select throws_ok($$select * from public.invitations$$, 'permission denied for table invitations', 'anon cannot read invitations');
select throws_ok($$select public.accept_invitation('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc')$$, 'permission denied for function accept_invitation', 'anon cannot accept an invitation');
reset role;

select * from finish();
rollback;

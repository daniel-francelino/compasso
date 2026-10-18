begin;

select plan(56);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.kinds(p_entries jsonb) returns text language sql as $$
  select coalesce(string_agg(e ->> 'kind', ',' order by e ->> 'kind'), '')
  from jsonb_array_elements(p_entries) e
$$;

create function pg_temp.notes(p_kind text, p_user uuid) returns int language sql as $$
  select count(*)::int from public.notifications where kind = p_kind and user_id = p_user
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver1@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'approver2@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver One', 'approver1@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000d2'::uuid, 'Approver Two', 'approver2@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
select public.brand_member_set(current_setting('t.brandB')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', true, 'active');
reset role;

select set_config('t.today', (now() at time zone (select timezone from public.brands where id = current_setting('t.brand')::uuid))::date::text, true);
select set_config('t.tz', (select timezone from public.brands where id = current_setting('t.brand')::uuid), true);
select set_config('t.from', (now() - interval '1 day')::text, true);
select set_config('t.to', (now() + interval '40 days')::text, true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.item1', public.content_item_save(format('{"brand_id":"%s","title":"Plano A","assignee_id":"00000000-0000-0000-0000-0000000000b1","production_due_date":"%s"}', current_setting('t.brand'), (current_setting('t.today')::date + 20))::jsonb) ->> 'id', true);
select set_config('t.v1', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text","caption":{"text":"Texto"},"planned_at":"%s","planned_timezone":"America/Sao_Paulo"}', current_setting('t.item1'), current_setting('t.channel'), now() + interval '3 days')::jsonb) ->> 'id', true);
select set_config('t.item2', public.content_item_save(format('{"brand_id":"%s","title":"Sem data"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.v2', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text","caption":{"text":"Texto"}}', current_setting('t.item2'), current_setting('t.channel'))::jsonb) ->> 'id', true);

select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 2, 'the calendar lists the planned publication and the production deadline');
select is(pg_temp.kinds(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 'production_deadline,publication', 'each entry carries its kind');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'undated'), 1, 'a variant without a date stays in the side list');
select is((public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) ->> 'truncated')::boolean, false, 'a small range is not truncated');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz, null, null, null, null, array['unplanned']) -> 'entries'), 0, 'the publication filter removes planned entries and their deadlines');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz, null, null, null, array['approved'], null) -> 'entries'), 0, 'the editorial filter removes entries of other statuses');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz, null, null, '00000000-0000-0000-0000-0000000000c1', null, null) -> 'entries'), 0, 'the owner filter removes entries of other owners');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz, array[current_setting('t.brand')::uuid], array[current_setting('t.channel')::uuid], null, null, null) -> 'entries'), 2, 'brand and channel filters keep matching entries');
select throws_ok(format($$select public.list_calendar_entries('%s', '%s'::timestamptz + interval '101 days')$$, current_setting('t.from'), current_setting('t.from')), 'invalid_input', 'a range over 100 days is refused');
select throws_ok(format($$select public.list_calendar_entries('%s', '%s')$$, current_setting('t.to'), current_setting('t.from')), 'invalid_input', 'a range that ends before it starts is refused');
select throws_ok($$select public.list_calendar_entries(null, null)$$, 'invalid_input', 'a missing range is refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 0, 'a manager of another brand sees none of these entries');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'undated'), 0, 'nor the undated list');
select throws_ok(format($$select public.reschedule_variant('%s', now() + interval '5 days', 'America/Sao_Paulo', 1)$$, current_setting('t.v1')), 'not_found', 'a variant of another brand cannot be rescheduled');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 2, 'a collaborator linked to the brand can see the calendar');
select throws_ok(format($$select public.reschedule_variant('%s', now() + interval '5 days', 'America/Sao_Paulo', 1)$$, current_setting('t.v1')), 'denied', 'but cannot reschedule without calendar.manage');
select throws_ok(format($$select public.reschedule_production_deadline('%s', current_date + 3, 1)$$, current_setting('t.item1')), 'denied', 'nor move a production deadline');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$select public.list_calendar_entries(now(), now() + interval '2 days')$$, 'denied', 'an external user cannot read the internal calendar');
select throws_ok(format($$select public.reschedule_variant('%s', now() + interval '5 days', 'America/Sao_Paulo', 1)$$, current_setting('t.v1')), 'denied', 'nor reschedule');
reset role;

set local role anon;
select throws_ok($$select public.list_calendar_entries(now(), now() + interval '2 days')$$, 'permission denied for function list_calendar_entries', 'anon cannot read the calendar');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((public.reschedule_variant(current_setting('t.v1')::uuid, now() + interval '4 days', 'Europe/Lisbon', 1) ->> 'resubmitted')::boolean, false, 'a draft is rescheduled without a new revision');
select is((select planned_timezone from public.content_variants where id = current_setting('t.v1')::uuid), 'Europe/Lisbon', 'the zone chosen at planning is stored');
select is((select version from public.content_variants where id = current_setting('t.v1')::uuid), 2, 'rescheduling bumps the version');
select throws_ok(format($$select public.reschedule_variant('%s', now() + interval '5 days', 'Europe/Lisbon', 1)$$, current_setting('t.v1')), 'conflict', 'a stale version is refused');
select throws_ok(format($$select public.reschedule_variant('%s', now() + interval '5 days', 'Not/AZone', 2)$$, current_setting('t.v1')), 'invalid_input', 'an unknown zone is refused');
select throws_ok(format($$select public.reschedule_variant('%s', null, 'Europe/Lisbon', 2)$$, current_setting('t.v1')), 'invalid_input', 'a missing date is refused');
select lives_ok(format($$select public.reschedule_variant('%s', '2020-01-01T10:00:00Z', 'America/Sao_Paulo', 2)$$, current_setting('t.v1')), 'a past date is allowed (the interface warns first)');
reset role;
select is((select count(*)::int from public.audit_events where action = 'variant.rescheduled' and entity_id = current_setting('t.v1')::uuid), 2, 'each reschedule is audited');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((select version from public.content_variants where id = current_setting('t.v1')::uuid), 3, 'the version moves on');
select lives_ok(format($$select public.reschedule_variant('%s', now() + interval '3 days', 'America/Sao_Paulo', 3)$$, current_setting('t.v1')), 'and the date is restored');

select is((public.reschedule_production_deadline(current_setting('t.item1')::uuid, current_setting('t.today')::date + 10, 1) ->> 'version')::int, 2, 'a production deadline moves without a revision');
select throws_ok(format($$select public.reschedule_production_deadline('%s', current_date + 3, 1)$$, current_setting('t.item1')), 'conflict', 'a stale item version is refused');
select throws_ok(format($$select public.reschedule_production_deadline('%s', null, 2)$$, current_setting('t.item1')), 'invalid_input', 'a missing deadline is refused');

select public.content_variant_move(current_setting('t.v1')::uuid, 'in_production', 4);
select set_config('t.sub1', public.submit_for_approval(current_setting('t.v1')::uuid, '00000000-0000-0000-0000-0000000000d1', current_setting('t.today')::date + 2, null, 5)::text, true);
select is(pg_temp.kinds(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 'approval_deadline,production_deadline,publication', 'a pending request adds its deadline');

select is((public.reschedule_variant(current_setting('t.v1')::uuid, now() + interval '6 days', 'America/Sao_Paulo', 6) ->> 'resubmitted')::boolean, true, 'a variant awaiting approval gets a new revision');
select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'awaiting_approval', 'and stays awaiting approval');
select is((select count(*)::int from public.content_revisions where variant_id = current_setting('t.v1')::uuid), 2, 'the new revision is stored');
select is((select count(*)::int from public.approval_requests where variant_id = current_setting('t.v1')::uuid and status = 'pending'), 1, 'exactly one request is pending');
select is((select count(*)::int from public.approval_requests where variant_id = current_setting('t.v1')::uuid and status = 'superseded'), 1, 'the previous request was superseded');
reset role;
select is(pg_temp.notes('approval.requested', '00000000-0000-0000-0000-0000000000d1'), 2, 'the approver is told about the new request');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
reset role;
select is(pg_temp.notes('approval.superseded', '00000000-0000-0000-0000-0000000000d1'), 1, 'and that the previous one was replaced');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.req2', (select id::text from public.approval_requests where variant_id = current_setting('t.v1')::uuid and status = 'pending'), true);
select is((select snapshot ->> 'planned_timezone' from public.content_revisions where variant_id = current_setting('t.v1')::uuid and revision_no = 2), 'America/Sao_Paulo', 'the snapshot carries the new zone');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(jsonb_array_length(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 1, 'the portal calendar shows the shared variant');
select is(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries' -> 0 ->> 'title', 'Plano A', 'with the title of the revision');
select is(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) ->> 'brand_timezone', current_setting('t.tz'), 'and the zone of the brand');
select is((select count(*)::int from jsonb_object_keys(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries' -> 0) k where k in ('assignee_id', 'internal_notes', 'production_due_date', 'variant_id')), 0, 'and no internal field');
select throws_ok(format($$select public.portal_list_calendar('%s', now(), now() + interval '2 days')$$, current_setting('t.brandB')), 'not_found', 'a brand the person is not linked to is not found');
select throws_ok(format($$select public.portal_list_calendar('%s', now(), now() + interval '101 days')$$, current_setting('t.brand')), 'invalid_input', 'the portal range is limited too');
select public.portal_decide_approval(current_setting('t.req2')::uuid, 'approved', null);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select is(jsonb_array_length(public.portal_list_calendar(current_setting('t.brandB')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'entries'), 0, 'another brand has nothing shared');
select throws_ok(format($$select public.portal_list_calendar('%s', now(), now() + interval '2 days')$$, current_setting('t.brand')), 'not_found', 'and cannot read this one');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.portal_list_calendar('%s', now(), now() + interval '2 days')$$, current_setting('t.brand')), 'denied', 'the team cannot call the portal function');
select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'approved', 'the variant is approved');
select is((public.reschedule_variant(current_setting('t.v1')::uuid, now() + interval '7 days', 'America/Sao_Paulo', (select version from public.content_variants where id = current_setting('t.v1')::uuid)) ->> 'resubmitted')::boolean, true, 'rescheduling an approved variant asks for a new approval');
select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'awaiting_approval', 'the variant returns to awaiting approval');
select is((select approved_revision_id from public.content_variants where id = current_setting('t.v1')::uuid), null, 'and is no longer approved');

select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
select throws_ok(format($$select public.reschedule_variant('%s', now() + interval '8 days', 'America/Sao_Paulo', %s)$$, current_setting('t.v1'), (select version from public.content_variants where id = current_setting('t.v1')::uuid)), 'approver_without_access', 'an approver who lost the right to decide blocks a resubmission');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

select * from finish();
rollback;

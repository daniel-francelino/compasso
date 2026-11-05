begin;

select plan(39);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.answers(p_overall int) returns jsonb language sql as $$
  select jsonb_build_object(
    'overall', p_overall, 'quality', 4, 'communication', null, 'deadlines', 3, 'results', 5,
    'highlight', '  Gostei dos reels  ', 'improvement', ''
  )
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver1@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'commenter@example.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'late@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'approverb@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver One', 'approver1@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000d2'::uuid, 'Commenter', 'commenter@example.test', 'external', 'external_commenter'),
  ('00000000-0000-0000-0000-0000000000d3'::uuid, 'Late Joiner', 'late@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Approver B', 'approverb@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
select public.brand_member_set(current_setting('t.brandB')::uuid, '00000000-0000-0000-0000-0000000000e1', 'external', true, 'active');
reset role;

select set_config('t.period', (date_trunc('month', now() at time zone 'UTC') - interval '1 month')::date::text, true);
select set_config('t.newbrand', (select id::text from public.brands where name = 'Padaria Sol'), true);

update public.brands set created_at = now() - interval '120 days' where id = current_setting('t.brand')::uuid;
update public.brand_members set granted_at = now() - interval '100 days'
where brand_id = current_setting('t.brand')::uuid and kind = 'external';

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d3', 'external', true, 'active');
reset role;

select is(
  public.feedback_period_for(current_setting('t.brand')::uuid),
  null::date,
  'a brand with no content shared in the period is not asked'
);

set local session_replication_role = replica;
insert into public.approval_requests (brand_id, item_id, revision_id, status, requested_at, stage)
values (
  current_setting('t.brand')::uuid, gen_random_uuid(), gen_random_uuid(), 'approved',
  (current_setting('t.period')::date + 9)::timestamptz, 'art'
);
insert into public.approval_requests (brand_id, item_id, revision_id, status, requested_at, stage)
values (
  current_setting('t.brandB')::uuid, gen_random_uuid(), gen_random_uuid(), 'approved',
  (current_setting('t.period')::date + 9)::timestamptz, 'art'
);
set local session_replication_role = origin;

select is(
  public.feedback_period_for(current_setting('t.brand')::uuid),
  current_setting('t.period')::date,
  'a brand older than a month with work shared last month is asked about that month'
);
select is(
  public.feedback_period_for(current_setting('t.brandB')::uuid),
  null::date,
  'a brand younger than one month is not asked, even with work in the period'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(
  public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'state',
  'due',
  'the approver of the brand is asked'
);
select is(
  (public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'period_month')::date,
  current_setting('t.period')::date,
  'the prompt names the closed month'
);
select throws_ok(
  format($$select public.portal_feedback_prompt('%s')$$, current_setting('t.brandB')),
  'not_found',
  'an external member of brand A cannot read the prompt of brand B'
);

select public.portal_feedback_snooze(current_setting('t.brand')::uuid, current_setting('t.period')::date);
select is(
  public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'state',
  'none',
  'after "Responder depois" the prompt is hidden'
);
reset role;
update public.feedback_responses set snoozed_until = now() - interval '1 hour';
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(
  public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'state',
  'due',
  'after the snooze expires the modal is due again'
);
select public.portal_feedback_snooze(current_setting('t.brand')::uuid, current_setting('t.period')::date);
select public.portal_feedback_snooze(current_setting('t.brand')::uuid, current_setting('t.period')::date);
select is(
  public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'state',
  'banner',
  'after three snoozes only the banner remains'
);

select throws_ok(
  format($$select public.portal_feedback_submit('%s', '%s', '{"quality": 4}')$$, current_setting('t.brand'), current_setting('t.period')),
  'invalid_input',
  'the overall score is required'
);
select throws_ok(
  format($$select public.portal_feedback_submit('%s', '%s', '{"overall": 6}')$$, current_setting('t.brand'), current_setting('t.period')),
  'invalid_input',
  'a score above five is refused'
);
select throws_ok(
  format($$select public.portal_feedback_submit('%s', '%s', '{"overall": 3, "highlight": 12}')$$, current_setting('t.brand'), current_setting('t.period')),
  'invalid_input',
  'a comment that is not text is refused'
);
select throws_ok(
  format($$select public.portal_feedback_submit('%s', '%s', %L::jsonb)$$, current_setting('t.brand'), current_setting('t.period'), jsonb_build_object('overall', 3, 'improvement', repeat('a', 1001))),
  'invalid_input',
  'a comment above 1000 characters is refused'
);
select throws_ok(
  format($$select public.portal_feedback_submit('%s', '%s', '{"overall": 3}')$$, current_setting('t.brand'), (current_setting('t.period')::date - 31)::text),
  'feedback_not_open',
  'an old period is refused'
);

select lives_ok(
  format($$select public.portal_feedback_submit('%s', '%s', %L::jsonb)$$, current_setting('t.brand'), current_setting('t.period'), pg_temp.answers(2)),
  'the approver answers the survey'
);
select throws_ok(
  format($$select public.portal_feedback_submit('%s', '%s', '{"overall": 5}')$$, current_setting('t.brand'), current_setting('t.period')),
  'feedback_already_answered',
  'a second answer for the same month is refused'
);
select throws_ok(
  format($$select public.portal_feedback_decline('%s', '%s')$$, current_setting('t.brand'), current_setting('t.period')),
  'feedback_already_answered',
  'an answered month cannot be declined'
);
select is(
  public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'state',
  'none',
  'after answering nothing is due'
);
select is(
  (select count(*)::int from public.feedback_responses),
  0,
  'an external user reads no row of the table, not even their own'
);
reset role;

select is(
  (select score_quality::text || '/' || coalesce(score_communication::text, 'null') || '/' || highlight || '/' || coalesce(improvement, 'null')
   from public.feedback_responses where respondent_id = '00000000-0000-0000-0000-0000000000d1'),
  '4/null/Gostei dos reels/null',
  'a skipped dimension is stored as null and the text is trimmed'
);
select throws_ok(
  $$update public.feedback_responses set score_overall = 5$$,
  'feedback_already_answered',
  'an answered row cannot be updated'
);
select throws_ok(
  $$delete from public.feedback_responses$$,
  'feedback_already_answered',
  'an answered row cannot be deleted'
);
select is(
  (select count(*)::int from public.audit_events where action = 'feedback.answered'
   and metadata ->> 'overall' = '2' and not (metadata ? 'highlight')),
  1,
  'the answer is audited with ids and the score, never the text'
);
select is(
  (select count(*)::int from public.notifications where kind = 'feedback.received'
   and user_id = '00000000-0000-0000-0000-0000000000b1' and body like '%nota 2%Precisa de atenção.%'),
  1,
  'the linked manager is told, and a low score says it needs attention'
);
select is(
  (select count(*)::int from public.notifications where kind = 'feedback.received'
   and user_id in ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1')),
  0,
  'a manager of another brand and a collaborator are not notified'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select public.portal_feedback_decline(current_setting('t.brand')::uuid, current_setting('t.period')::date);
select is(
  public.portal_feedback_prompt(current_setting('t.brand')::uuid) ->> 'state',
  'none',
  'declining the month removes the prompt'
);
reset role;
select is(
  (select status from public.feedback_responses where respondent_id = '00000000-0000-0000-0000-0000000000d2'),
  'declined',
  'the decline is recorded'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  (public.feedback_list(current_setting('t.brand')::uuid, current_setting('t.period')::date, 'answered', false, 1, 12) ->> 'total')::int,
  1,
  'the manager lists the answered cards'
);
select is(
  (public.feedback_list(current_setting('t.brand')::uuid, current_setting('t.period')::date, 'answered', true, 1, 12) ->> 'total')::int,
  1,
  'the attention filter keeps a score of two'
);
select is(
  public.feedback_list(current_setting('t.brand')::uuid, current_setting('t.period')::date, 'answered', false, 1, 12) -> 'rows' -> 0 ->> 'respondent_name',
  'Approver One',
  'a card carries the respondent name'
);
select is(
  (public.feedback_list(current_setting('t.brand')::uuid, current_setting('t.period')::date, 'pending', false, 1, 12) ->> 'total')::int,
  1,
  'the pending list holds the contact who dismissed the month'
);
select is(
  public.feedback_list(current_setting('t.brand')::uuid, current_setting('t.period')::date, 'pending', false, 1, 12) -> 'rows' -> 0 ->> 'state',
  'declined',
  'the pending card says the contact dismissed the month'
);
select is(
  (public.feedback_summary(current_setting('t.brand')::uuid, current_setting('t.period')::date) ->> 'expected')::int,
  2,
  'two contacts were expected (the late joiner and brand B are not)'
);
select is(
  (public.feedback_summary(current_setting('t.brand')::uuid, current_setting('t.period')::date) ->> 'average_overall')::numeric,
  2.0,
  'the summary averages the overall score'
);
select throws_ok(
  format($$select public.feedback_list('%s', '%s', 'answered', false, 1, 12)$$, current_setting('t.brandB'), current_setting('t.period')),
  'not_found',
  'a manager not linked to brand B cannot list its feedback'
);
select is(
  (public.feedback_list(null, current_setting('t.period')::date, 'answered', false, 1, 12) ->> 'total')::int,
  1,
  'without a brand filter the manager sees only the brands they are linked to'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  format($$select public.feedback_list('%s', '%s', 'answered', false, 1, 12)$$, current_setting('t.brand'), current_setting('t.period')),
  'denied',
  'a collaborator without feedback.view is refused'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(
  format($$select public.feedback_list('%s', '%s', 'answered', false, 1, 12)$$, current_setting('t.brand'), current_setting('t.period')),
  'denied',
  'an external user cannot call the manager list'
);
reset role;

set local role anon;
select throws_ok(
  format($$select public.portal_feedback_prompt('%s')$$, current_setting('t.brand')),
  '42501',
  'anon cannot call the portal function'
);
reset role;

select * from finish();
rollback;

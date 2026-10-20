begin;

select plan(42);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.event(p_extra text) returns text language sql as $$
  select format('{"brand_id":"%s","kind":"event",%s}', current_setting('t.brand'), p_extra)
$$;

create function pg_temp.save_sql(p_extra text) returns text language sql as $$
  select format($q$select public.calendar_note_save(%L::jsonb)$q$, pg_temp.event(p_extra))
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'client1@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'client2@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'other@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Client One', 'client1@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000d2'::uuid, 'Client Two', 'client2@example.test', 'external', 'external_commenter'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Other Client', 'other@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
select public.brand_member_set(current_setting('t.brandB')::uuid, '00000000-0000-0000-0000-0000000000e1', 'external', true, 'active');
reset role;

select set_config('t.day', to_char(current_date + 10, 'YYYY-MM-DD'), true);
select set_config('t.start', to_char((current_date + 10)::timestamp + time '13:00', 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00', true);
select set_config('t.end', to_char((current_date + 10)::timestamp + time '15:00', 'YYYY-MM-DD"T"HH24:MI:SS') || '-03:00', true);
select set_config('t.from', to_char(current_date + 8, 'YYYY-MM-DD"T"00:00:00"Z"'), true);
select set_config('t.to', to_char(current_date + 40, 'YYYY-MM-DD"T"00:00:00"Z"'), true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(pg_temp.save_sql('"title":"Captação","note_date":"' || current_setting('t.day') || '"'), 'invalid_input', 'an event needs a type');
select throws_ok(pg_temp.save_sql('"title":"Captação","event_type":"shoot","all_day":false'), 'invalid_input', 'a timed event needs a start and an end');
select throws_ok(pg_temp.save_sql('"title":"Captação","event_type":"shoot","all_day":false,"starts_at":"' || current_setting('t.end') || '","ends_at":"' || current_setting('t.start') || '"'), 'invalid_input', 'an event cannot end before it starts');
select throws_ok(pg_temp.save_sql('"title":"Captação","event_type":"shoot","note_date":"' || current_setting('t.day') || '","end_date":"' || (current_date + 12) || '","repeat":"weekly"'), 'invalid_input', 'a repeating event cannot last several days');
select throws_ok(pg_temp.save_sql('"title":"Reunião","event_type":"meeting","note_date":"' || current_setting('t.day') || '","location":"http://exemplo.test"'), 'invalid_input', 'a place link must be https');
select throws_ok(format($$select public.calendar_note_save('{"brand_id":"%s","kind":"idea","title":"Ideia","note_date":"%s","client_visible":true}'::jsonb)$$, current_setting('t.brand'), current_setting('t.day')), 'invalid_input', 'an idea can never be shared');
select throws_ok(format($$select public.calendar_note_save('{"brand_id":"%s","kind":"date","title":"Data","note_date":"%s","event_type":"shoot"}'::jsonb)$$, current_setting('t.brand'), current_setting('t.day')), 'invalid_input', 'a date carries no event fields');

select set_config('t.meeting', public.calendar_note_save(pg_temp.event('"title":"Reunião de alinhamento","event_type":"meeting","description":"Pauta do mês","internal_notes":"Levar a proposta nova","location":"https://meet.example.test/aurora","all_day":false,"starts_at":"' || current_setting('t.start') || '","ends_at":"' || current_setting('t.end') || '","timezone":"America/Sao_Paulo","client_visible":true')::jsonb) ->> 'id', true);
select set_config('t.shoot', public.calendar_note_save(pg_temp.event('"title":"Dia de captação","event_type":"shoot","note_date":"' || current_setting('t.day') || '","end_date":"' || (current_date + 11) || '","client_visible":true')::jsonb) ->> 'id', true);
select set_config('t.internal', public.calendar_note_save(pg_temp.event('"title":"Alinhamento interno","event_type":"other","note_date":"' || current_setting('t.day') || '","client_visible":false')::jsonb) ->> 'id', true);
select set_config('t.weekly', public.calendar_note_save(pg_temp.event('"title":"Reunião semanal","event_type":"meeting","note_date":"' || current_setting('t.day') || '","all_day":false,"starts_at":"' || current_setting('t.start') || '","ends_at":"' || current_setting('t.end') || '","timezone":"America/Sao_Paulo","repeat":"weekly","client_visible":true')::jsonb) ->> 'id', true);
select set_config('t.shared_date', public.calendar_note_save(format('{"brand_id":"%s","kind":"date","title":"Lançamento","note_date":"%s","client_visible":true}', current_setting('t.brand'), (current_date + 15)::text)::jsonb) ->> 'id', true);

select is((select note_date::text from public.calendar_notes where id = current_setting('t.meeting')::uuid), current_setting('t.day'), 'a timed event takes its day from the start in its zone');
select is((select end_date::text from public.calendar_notes where id = current_setting('t.shoot')::uuid), (current_date + 11)::text, 'an all-day event keeps its last day');
select is((select client_visible from public.calendar_notes where id = current_setting('t.internal')::uuid), false, 'an event is internal unless it is shared');

select is(jsonb_array_length(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz, null, null, null, null, null, array['event']) -> 'entries'), 9, 'the team sees every event occurrence: the meeting, two shoot days, the internal one and the weekly meeting five times');
select is((select (e ->> 'client_visible')::boolean from jsonb_array_elements(public.list_calendar_entries(current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz, null, null, null, null, null, array['event']) -> 'entries') e where e ->> 'title' = 'Alinhamento interno'), false, 'and which ones the client sees');
select is((public.calendar_note_get(current_setting('t.meeting')::uuid) ->> 'internal_notes'), 'Levar a proposta nova', 'the team reads the internal notes of an event');
reset role;

select is((select count(*)::int from public.audit_events where action = 'calendar_note.created' and metadata ->> 'client_visible' = 'true'), 4, 'sharing is audited on creation');
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and user_id = '00000000-0000-0000-0000-0000000000d1' and title = 'Novo evento no calendário'), 4, 'the approver of the brand is told about each shared event');
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and user_id = '00000000-0000-0000-0000-0000000000d2'), 4, 'so is a member who only comments');
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and user_id = '00000000-0000-0000-0000-0000000000e1'), 0, 'but not an approver of another brand');
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and ref_id = current_setting('t.internal')::uuid), 0, 'and nobody is told about an internal event');
select is((select link from public.notifications where kind = 'calendar.event' and user_id = '00000000-0000-0000-0000-0000000000d1' limit 1), '/portal/brands/' || current_setting('t.brand') || '/calendar', 'the notification leads to the portal calendar');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(jsonb_array_length(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events'), 9, 'the client sees the shared events and dates, with the repeats expanded and the shoot on each day');
select is((select count(*)::int from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Alinhamento interno'), 0, 'but not the internal event');
select is((select e ->> 'location' from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Reunião de alinhamento'), 'https://meet.example.test/aurora', 'the place is shown');
select ok(not (public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz)::text like '%Levar a proposta nova%'), 'the internal notes never reach the portal');
select is((select count(*)::int from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Reunião semanal'), 5, 'a weekly meeting shows once a week');
select is((select e ->> 'timezone' from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Reunião de alinhamento'), 'America/Sao_Paulo', 'and carries its time zone');
select throws_ok(format($$select public.calendar_note_get('%s')$$, current_setting('t.meeting')), 'denied', 'the client cannot read a note through the team function');
select throws_ok(format($$select public.calendar_note_save('{"id":"%s","brand_id":"%s","kind":"event","title":"Hackeado","event_type":"meeting","note_date":"%s","expected_version":1}'::jsonb)$$, current_setting('t.meeting'), current_setting('t.brand'), current_setting('t.day')), 'denied', 'nor change an event');
select is((select count(*)::int from public.calendar_notes), 0, 'the client reads no note straight from the table');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.portal_list_calendar('%s', '%s'::timestamptz, '%s'::timestamptz)$$, current_setting('t.brand'), current_setting('t.from'), current_setting('t.to')), 'not_found', 'a client of another brand does not find the calendar');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(pg_temp.save_sql('"title":"Captação","event_type":"shoot","note_date":"' || current_setting('t.day') || '"'), 'denied', 'a collaborator cannot create events');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(pg_temp.save_sql('"title":"Outra marca","event_type":"shoot","note_date":"' || current_setting('t.day') || '"'), 'not_found', 'a manager of another brand cannot create events here');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.calendar_note_save('%s'::jsonb)$$, pg_temp.event(format('"id":"%s","title":"Reunião de alinhamento","event_type":"meeting","description":"Pauta do mês","location":"https://meet.example.test/aurora","all_day":false,"starts_at":"%s","ends_at":"%s","timezone":"America/Sao_Paulo","client_visible":true,"expected_version":1', current_setting('t.meeting'), (current_date + 11)::text || 'T13:00:00-03:00', (current_date + 11)::text || 'T15:00:00-03:00'))), 'a shared event is moved to another day');
reset role;
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and ref_id = current_setting('t.meeting')::uuid and user_id = '00000000-0000-0000-0000-0000000000d1' and title = 'Evento alterado'), 1, 'the client is told that it changed');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.calendar_note_save('%s'::jsonb)$$, pg_temp.event(format('"id":"%s","title":"Reunião de alinhamento","event_type":"meeting","description":"Pauta do mês","location":"https://meet.example.test/aurora","all_day":false,"starts_at":"%s","ends_at":"%s","timezone":"America/Sao_Paulo","client_visible":false,"expected_version":2', current_setting('t.meeting'), (current_date + 11)::text || 'T13:00:00-03:00', (current_date + 11)::text || 'T15:00:00-03:00'))), 'an event can go back to internal');
reset role;
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and ref_id = current_setting('t.meeting')::uuid and user_id = '00000000-0000-0000-0000-0000000000d1' and title = 'Evento cancelado'), 1, 'the client is told it was cancelled');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Reunião de alinhamento'), 0, 'and the portal stops showing it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.calendar_note_archive('%s')$$, current_setting('t.shoot')), 'a shared event is archived');
reset role;
select is((select count(*)::int from public.notifications where kind = 'calendar.event' and ref_id = current_setting('t.shoot')::uuid and title = 'Evento cancelado'), 2, 'the client members are told when it is archived');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Dia de captação'), 0, 'an archived event leaves the portal');
select is((select count(*)::int from jsonb_array_elements(public.portal_list_calendar(current_setting('t.brand')::uuid, current_setting('t.from')::timestamptz, current_setting('t.to')::timestamptz) -> 'events') e where e ->> 'title' = 'Lançamento'), 1, 'while a shared date stays');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.calendar_note_save('{"id":"%s","brand_id":"%s","kind":"idea","title":"Virou ideia","note_date":"%s","expected_version":3}'::jsonb)$$, current_setting('t.meeting'), current_setting('t.brand'), current_setting('t.day')), 'transition_not_allowed', 'an event cannot become an idea');
reset role;

set local role anon;
select throws_ok(format($$select public.portal_list_calendar('%s', now(), now() + interval '1 day')$$, current_setting('t.brand')), 'permission denied for function portal_list_calendar', 'anon cannot read the portal calendar');
reset role;

select * from finish();
rollback;

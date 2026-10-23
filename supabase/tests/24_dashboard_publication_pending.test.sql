begin;

select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

insert into public.organization_settings (key, value)
values ('policies.approvals', '{"deadlineDays":3,"requirePlanApproval":false}')
on conflict (key) do update set value = excluded.value;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');

select set_config('t.past', public.content_item_save(format('{"brand_id":"%s","title":"Ja passou","caption":{"text":"Texto"},"channels":[{"channel_id":"%s","format":"image","planned_at":"2020-01-01T12:00:00Z","planned_timezone":"America/Sao_Paulo"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select set_config('t.future', public.content_item_save(format('{"brand_id":"%s","title":"Ainda vem","caption":{"text":"Texto"},"channels":[{"channel_id":"%s","format":"image","planned_at":"2099-01-01T12:00:00Z","planned_timezone":"America/Sao_Paulo"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);

select is(jsonb_array_length(public.dashboard_publication_pending(null)), 0, 'a content that is not approved is not listed');
select public.approve_on_behalf(current_setting('t.past')::uuid, 'art', null, (select version from public.content_items where id = current_setting('t.past')::uuid));
select public.approve_on_behalf(current_setting('t.future')::uuid, 'art', null, (select version from public.content_items where id = current_setting('t.future')::uuid));

select is(jsonb_array_length(public.dashboard_publication_pending(null)), 1, 'an approved content with a planned date already passed is listed');
select is(public.dashboard_publication_pending(null) -> 0 ->> 'title', 'Ja passou', 'and it is the one that passed');
select is((public.dashboard_publication_pending(null) -> 0 ->> 'pending_rows')::int, 1, 'with the count of rows still to be marked');
select is(jsonb_array_length(public.dashboard_publication_pending(array[gen_random_uuid()])), 0, 'the brand filter is applied');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.dashboard_publication_pending(null)$$, 'denied', 'a role without content.publish_manual is refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is(jsonb_array_length(public.dashboard_publication_pending(null)), 0, 'a manager of another brand sees nothing');
reset role;

select * from finish();
rollback;

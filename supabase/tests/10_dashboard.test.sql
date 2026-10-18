begin;

select plan(18);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.reasons(p_variant uuid) returns text language sql as $$
  select coalesce(
    (select string_agg(r, ',' order by r) from jsonb_array_elements_text(
      (select e -> 'reasons' from jsonb_array_elements(public.dashboard_attention(null)) e where e ->> 'variant_id' = p_variant::text)
    ) r),
    ''
  )
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver1@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver One', 'approver1@example.test', 'external', 'external_approver')
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
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.item1', public.content_item_save(format('{"brand_id":"%s","title":"Atrasado","assignee_id":"00000000-0000-0000-0000-0000000000b1","production_due_date":"2020-01-01"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.v1', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text","caption":{"text":"Texto"}}', current_setting('t.item1'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select is(pg_temp.reasons(current_setting('t.v1')::uuid), 'production_overdue', 'a late production deadline needs attention');
select public.content_variant_move(current_setting('t.v1')::uuid, 'in_production', 1);
select set_config('t.sub1', public.submit_for_approval(current_setting('t.v1')::uuid, '00000000-0000-0000-0000-0000000000d1', current_date + 2, null, 2)::text, true);
select is(pg_temp.reasons(current_setting('t.v1')::uuid), 'production_overdue', 'a pending request within its deadline adds no reason');
reset role;

alter table public.approval_requests disable trigger approval_requests_guard;
update public.approval_requests set due_date = current_date - 2 where id = (current_setting('t.sub1')::jsonb ->> 'request_id')::uuid;
alter table public.approval_requests enable trigger approval_requests_guard;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(pg_temp.reasons(current_setting('t.v1')::uuid), 'approval_overdue,production_overdue', 'an overdue approval is added and the variant is listed once');
select is((select count(*)::int from jsonb_array_elements(public.dashboard_attention(null)) e where e ->> 'variant_id' = current_setting('t.v1')), 1, 'a variant with two reasons appears once');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
select is(pg_temp.reasons(current_setting('t.v1')::uuid), 'approval_overdue,approver_without_access,production_overdue', 'an approver who lost access is flagged');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.portal_decide_approval((current_setting('t.sub1')::jsonb ->> 'request_id')::uuid, 'changes_requested', 'Ajuste o texto da legenda');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(pg_temp.reasons(current_setting('t.v1')::uuid), 'changes_requested,production_overdue', 'a request for changes needs attention');
select set_config('t.item2', public.content_item_save(format('{"brand_id":"%s","title":"Data passou"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.v2', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text","caption":{"text":"Texto"},"planned_at":"2020-01-01T10:00:00Z","planned_timezone":"America/Sao_Paulo"}', current_setting('t.item2'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select is(pg_temp.reasons(current_setting('t.v2')::uuid), 'planned_date_passed', 'a planned date in the past without publication needs attention');
select is((select (public.dashboard_status_counts(null) ->> 'changes_requested')::int), 1, 'the counts include the variant waiting for changes');
select is((select (public.dashboard_status_counts(null) ->> 'draft')::int), 1, 'and the draft one');
select is(jsonb_array_length(public.dashboard_my_items()), 1, 'my items lists the item assigned to me');
select is(jsonb_array_length(public.dashboard_attention(array[gen_random_uuid()])), 0, 'a brand filter with another brand shows nothing');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is(jsonb_array_length(public.dashboard_attention(null)), 0, 'a manager of another brand sees no attention items');
select is(public.dashboard_status_counts(null), '{}'::jsonb, 'nor counts');
select is(jsonb_array_length(public.dashboard_my_items()), 0, 'nor items');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(jsonb_array_length(public.dashboard_my_items()), 0, 'a collaborator sees only the items assigned to them');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$select public.dashboard_attention(null)$$, 'denied', 'an external user cannot read the dashboard');
select throws_ok($$select public.dashboard_status_counts(null)$$, 'denied', 'nor the counts');
reset role;

set local role anon;
select throws_ok($$select public.dashboard_attention(null)$$, 'permission denied for function dashboard_attention', 'anon cannot call the dashboard');
reset role;

select * from finish();
rollback;

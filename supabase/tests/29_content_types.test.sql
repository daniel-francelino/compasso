begin;

select plan(19);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'client@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Client', 'client@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Outra Marca"}'::jsonb, true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select set_config('t.type1', public.content_type_save('{"name":"Produto","color":"coral","emoji":"🛍️"}'::jsonb) ->> 'id', true);
select set_config('t.type2', public.content_type_save('{"name":"Atmosfera","color":"orchid"}'::jsonb) ->> 'id', true);
select is((select count(*)::int from public.content_types), 2, 'the owner creates types');
select throws_ok($$select public.content_type_save('{"name":" produto "}'::jsonb)$$, 'content_type_name_taken', 'a name is unique ignoring case');
select throws_ok($$select public.content_type_save('{"name":"Cor ruim","color":"#ff0000"}'::jsonb)$$, 'invalid_input', 'a color outside the closed list is refused');
select throws_ok($$select public.content_type_save('{"name":""}'::jsonb)$$, 'invalid_input', 'an empty name is refused');
select is((public.content_type_save(format('{"id":"%s","name":"Produto","color":"violet"}', current_setting('t.type1'))::jsonb) ->> 'id')::uuid, current_setting('t.type1')::uuid, 'a type is edited in place');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.content_type_save('{"name":"Novo"}'::jsonb)$$, 'denied', 'a manager cannot manage the catalog');
select throws_ok(format($$select public.content_type_set_archived('%s', true)$$, current_setting('t.type1')), 'denied', 'a manager cannot archive a type');
select is((select count(*)::int from public.content_types), 2, 'a manager reads the catalog');
select set_config('t.item', public.content_item_save(format('{"brand_id":"%s","title":"Tarde boa","type_ids":["%s","%s"]}', current_setting('t.brand'), current_setting('t.type1'), current_setting('t.type2'))::jsonb) ->> 'id', true);
select is((select count(*)::int from public.content_item_types where content_item_id = current_setting('t.item')::uuid), 2, 'a content carries several types');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.content_type_save('{"name":"Colab"}'::jsonb)$$, 'denied', 'a collaborator cannot manage the catalog');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.content_type_set_archived(current_setting('t.type2')::uuid, true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Com tipo arquivado","type_ids":["%s"]}'::jsonb)$$, current_setting('t.brand'), current_setting('t.type2')), 'invalid_input', 'an archived type is not offered to a new content');
select lives_ok(format($$select public.content_item_save(jsonb_build_object('id', %L, 'brand_id', %L, 'title', 'Tarde boa', 'expected_version', 1, 'type_ids', jsonb_build_array(%L, %L)))$$, current_setting('t.item'), current_setting('t.brand'), current_setting('t.type1'), current_setting('t.type2')), 'a content keeps an archived type it already had');
select lives_ok(format($$select public.content_item_save(jsonb_build_object('id', %L, 'brand_id', %L, 'title', 'Tarde boa', 'expected_version', 2, 'type_ids', jsonb_build_array(%L)))$$, current_setting('t.item'), current_setting('t.brand'), current_setting('t.type1')), 'a type is removed by leaving it out');
select is((select count(*)::int from public.content_item_types where content_item_id = current_setting('t.item')::uuid), 1, 'the removed type link is gone');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.content_item_types), 0, 'another brand does not see the links of this content');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.content_types), 0, 'an external user reads no type');
reset role;

set local role anon;
select throws_ok($$select * from public.content_types$$, 'permission denied for table content_types', 'anon cannot read the catalog');
select throws_ok($$select public.content_type_save('{"name":"Anon"}'::jsonb)$$, 'permission denied for function content_type_save', 'anon cannot save a type');
reset role;

select is((select count(*)::int from public.audit_events where action in ('content_type.saved', 'content_type.archived')), 4, 'catalog changes are audited');

select * from finish();
rollback;

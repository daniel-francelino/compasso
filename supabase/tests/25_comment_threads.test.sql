begin;

select plan(14);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands limit 1), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select set_config('t.item', public.content_item_save(format('{"brand_id":"%s","title":"Post de teste"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.c1', public.comment_add(current_setting('t.item')::uuid, 'internal', 'Primeiro')::jsonb ->> 'id', true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.r1', public.comment_add(current_setting('t.item')::uuid, 'external', 'Resposta', current_setting('t.c1')::uuid)::jsonb ->> 'id', true);
select is((select visibility from public.comments where id = current_setting('t.r1')::uuid), 'internal', 'a reply takes the visibility of the comment it answers');
select is((select parent_id::text from public.comments where id = current_setting('t.r1')::uuid), current_setting('t.c1'), 'and points to it');
select set_config('t.r2', public.comment_add(current_setting('t.item')::uuid, 'internal', 'Resposta da resposta', current_setting('t.r1')::uuid)::jsonb ->> 'id', true);
select is((select parent_id::text from public.comments where id = current_setting('t.r2')::uuid), current_setting('t.c1'), 'a reply to a reply stays in the same thread (one level)');
select throws_ok(format($$select public.comment_add('%s', 'internal', 'x', gen_random_uuid())$$, current_setting('t.item')), 'not_found', 'an unknown parent is refused');
select throws_ok(format($$select public.comment_edit('%s', 'Mudei')$$, current_setting('t.c1')), 'denied', 'nobody else can edit a comment');
select lives_ok(format($$select public.comment_edit('%s', '  Resposta editada  ')$$, current_setting('t.r1')), 'the author edits their own comment');
select is((select body from public.comments where id = current_setting('t.r1')::uuid), 'Resposta editada', 'the text is trimmed and saved');
select isnt((select edited_at from public.comments where id = current_setting('t.r1')::uuid), null, 'and the edit time is recorded');
select throws_ok(format($$select public.comment_edit('%s', '')$$, current_setting('t.r1')), 'invalid_input', 'an empty text is refused');
select is((select count(*)::int from jsonb_array_elements(public.comment_list(current_setting('t.item')::uuid)) e where e ->> 'parent_id' is not null), 2, 'the list carries the parent of each reply');
reset role;

select is((select count(*)::int from public.audit_events where action = 'comment.edited'), 1, 'an edit is audited without the text');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.comment_delete('%s')$$, current_setting('t.c1')), 'the author deletes the first comment');
select is((select count(*)::int from jsonb_array_elements(public.comment_list(current_setting('t.item')::uuid)) e where (e ->> 'deleted')::boolean and e ->> 'body' is null), 1, 'it stays as a placeholder because it still has replies');
select is((select count(*)::int from jsonb_array_elements(public.comment_list(current_setting('t.item')::uuid)) e), 3, 'and the replies remain');
reset role;

select * from finish();
rollback;

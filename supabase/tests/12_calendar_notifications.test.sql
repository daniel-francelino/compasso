begin;

select plan(15);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.ver(p_item uuid) returns int language sql as $$
  select version from public.content_items where id = p_item
$$;

create function pg_temp.notes(p_kind text, p_user uuid) returns int language sql as $$
  select count(*)::int from public.notifications where kind = p_kind and user_id = p_user
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

insert into public.organization_settings (key, value)
values ('policies.approvals', '{"deadlineDays":3,"requirePlanApproval":false}')
on conflict (key) do update set value = excluded.value;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

select set_config('t.today', (now() at time zone (select timezone from public.brands where id = current_setting('t.brand')::uuid))::date::text, true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.content_item_save(format('{"brand_id":"%s","title":"Vence logo","assignee_id":"00000000-0000-0000-0000-0000000000b1","production_due_date":"%s"}', current_setting('t.brand'), current_setting('t.today')::date + 2)::jsonb);
select public.content_item_save(format('{"brand_id":"%s","title":"Vence depois","assignee_id":"00000000-0000-0000-0000-0000000000b1","production_due_date":"%s"}', current_setting('t.brand'), current_setting('t.today')::date + 9)::jsonb);
select public.content_item_save(format('{"brand_id":"%s","title":"Vencido","assignee_id":"00000000-0000-0000-0000-0000000000b1","production_due_date":"%s"}', current_setting('t.brand'), current_setting('t.today')::date - 1)::jsonb);
reset role;

select public.notify_scan_content();
select is(pg_temp.notes('content.due_soon', '00000000-0000-0000-0000-0000000000b1'), 1, 'a production deadline within the lead time alerts the owner once');
select public.notify_scan_content();
select is(pg_temp.notes('content.due_soon', '00000000-0000-0000-0000-0000000000b1'), 1, 'running the scanner again creates no duplicate');
select is((select body from public.notifications where kind = 'content.due_soon' limit 1), '«Vence logo» deve ficar pronto em 2 dias.', 'the text names the item and the days left');
select is(pg_temp.notes('content.due_soon', '00000000-0000-0000-0000-0000000000c1'), 0, 'someone who is not the owner is not alerted');
select is(pg_temp.notes('content.overdue', '00000000-0000-0000-0000-0000000000b1'), 1, 'a late deadline alerts the owner and the managers of the brand');
select is(pg_temp.notes('content.overdue', '00000000-0000-0000-0000-0000000000b2'), 0, 'but not a manager of another brand');

insert into public.notification_preferences (user_id, kind, enabled)
values ('00000000-0000-0000-0000-0000000000b1', 'content.due_soon', false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.content_item_save(format('{"brand_id":"%s","title":"Silenciado","assignee_id":"00000000-0000-0000-0000-0000000000b1","production_due_date":"%s"}', current_setting('t.brand'), current_setting('t.today')::date + 2)::jsonb);
reset role;
select public.notify_scan_content();
select is(pg_temp.notes('content.due_soon', '00000000-0000-0000-0000-0000000000b1'), 1, 'a person who turned the kind off gets no new alert');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.v3', public.content_item_save(format('{"brand_id":"%s","title":"Aprovacao parada","caption":{"text":"Texto"},"channels":[{"channel_id":"%s","format":"text"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select public.content_move(current_setting('t.v3')::uuid, 'in_production', pg_temp.ver(current_setting('t.v3')::uuid));
select set_config('t.sub3', public.submit_for_approval(current_setting('t.v3')::uuid, current_setting('t.today')::date, null, pg_temp.ver(current_setting('t.v3')::uuid))::text, true);
reset role;

alter table public.approval_requests disable trigger approval_requests_guard;
update public.approval_requests set due_date = current_setting('t.today')::date - 1 where id = (current_setting('t.sub3')::jsonb ->> 'request_id')::uuid;
alter table public.approval_requests enable trigger approval_requests_guard;

select public.notify_scan_content();
select is(pg_temp.notes('approval.overdue', '00000000-0000-0000-0000-0000000000b1'), 1, 'an overdue approval alerts whoever submitted it');
select is(pg_temp.notes('approval.overdue', '00000000-0000-0000-0000-0000000000d1'), 0, 'the external approver is not sent an internal alert');
select public.notify_scan_content();
select is(pg_temp.notes('approval.overdue', '00000000-0000-0000-0000-0000000000b1'), 1, 'and it is not repeated on the same day');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.portal_decide_approval((current_setting('t.sub3')::jsonb ->> 'request_id')::uuid, 'approved', null);
reset role;
select public.notify_scan_content();
select is((select count(*)::int from public.notifications where kind = 'approval.overdue' and status = 'resolved'), 1, 'deciding the request resolves the overdue alert');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.v4', public.content_item_save(format('{"brand_id":"%s","title":"Publicar ontem","assignee_id":"00000000-0000-0000-0000-0000000000b1","caption":{"text":"Texto"},"channels":[{"channel_id":"%s","format":"text","planned_at":"%s","planned_timezone":"America/Sao_Paulo"}]}', current_setting('t.brand'), current_setting('t.channel'), now() - interval '2 days')::jsonb) ->> 'id', true);
select set_config('t.row4', (select id::text from public.content_channels where content_item_id = current_setting('t.v4')::uuid), true);
select public.content_move(current_setting('t.v4')::uuid, 'in_production', pg_temp.ver(current_setting('t.v4')::uuid));
select set_config('t.sub4', public.submit_for_approval(current_setting('t.v4')::uuid, null, null, pg_temp.ver(current_setting('t.v4')::uuid))::text, true);
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.portal_decide_approval((current_setting('t.sub4')::jsonb ->> 'request_id')::uuid, 'approved', null);
reset role;

select public.notify_scan_content();
select is(pg_temp.notes('content.publish_due', '00000000-0000-0000-0000-0000000000b1'), 1, 'a passed publication date alerts the owner');
select public.notify_scan_content();
select is(pg_temp.notes('content.publish_due', '00000000-0000-0000-0000-0000000000b1'), 1, 'once');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.mark_published(current_setting('t.row4')::uuid, now(), null, null, null);
reset role;
select public.notify_scan_content();
select is((select count(*)::int from public.notifications where kind = 'content.publish_due' and status = 'resolved'), 1, 'recording the publication resolves the alert');

select is((select count(*)::int from public.notification_kinds where available and kind in ('approval.overdue', 'content.due_soon', 'content.overdue', 'content.publish_due')), 4, 'the four scheduled kinds are available');

select * from finish();
rollback;

begin;

select plan(40);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'client@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Client', 'client@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

insert into public.organization_settings (key, value)
values ('policies.approvals', '{"deadlineDays":3,"requirePlanApproval":false}')
on conflict (key) do update set value = excluded.value;

create function pg_temp.make_item(p_title text, p_planned text, p_channel text) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  v_id := (public.content_item_save(format(
    '{"brand_id":"%s","title":"%s","caption":{"text":"Legenda de %s"},"channels":[{"channel_id":"%s","format":"image","planned_at":"%s","planned_timezone":"America/Sao_Paulo"}]}',
    current_setting('t.brand'), p_title, p_title, p_channel, p_planned
  )::jsonb) ->> 'id')::uuid;
  perform public.approve_on_behalf(v_id, 'art', null, (select version from public.content_items where id = v_id));
  return v_id;
end;
$$;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.plain', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.sem.conexao"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
reset role;
select public.channel_connection_store(
  current_setting('t.channel')::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid,
  '{"external_account_id":"17841400000","username":"aurora.cafe","account_type":"BUSINESS"}'::jsonb,
  'ciphertext-ciphertext-ciphertext-1', now() + interval '60 days', array['instagram_business_content_publish']
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');

select set_config('t.a', pg_temp.make_item('Item A', (now() - interval '1 hour')::text, current_setting('t.channel'))::text, true);
select set_config('t.b', pg_temp.make_item('Item B', (now() - interval '2 hours')::text, current_setting('t.channel'))::text, true);
select set_config('t.late', pg_temp.make_item('Item atrasado', (now() - interval '2 days')::text, current_setting('t.channel'))::text, true);
select set_config('t.plainitem', pg_temp.make_item('Item sem conexao', (now() - interval '1 hour')::text, current_setting('t.plain'))::text, true);
select set_config('t.future', pg_temp.make_item('Item futuro', (now() + interval '3 days')::text, current_setting('t.channel'))::text, true);

create function pg_temp.row_of(p_item text) returns uuid language sql as $$
  select id from public.content_channels where content_item_id = p_item::uuid
$$;
create function pg_temp.ver_of(p_item text) returns int language sql as $$
  select version from public.content_channels where content_item_id = p_item::uuid
$$;

select is(
  public.channel_row_set_publish_mode(pg_temp.row_of(current_setting('t.a')), 'automatic', pg_temp.ver_of(current_setting('t.a'))) ->> 'id',
  pg_temp.row_of(current_setting('t.a'))::text,
  'a manager sets a channel row of a connected channel to publish automatically'
);
select public.channel_row_set_publish_mode(pg_temp.row_of(current_setting('t.b')), 'automatic', pg_temp.ver_of(current_setting('t.b')));
select public.channel_row_set_publish_mode(pg_temp.row_of(current_setting('t.late')), 'automatic', pg_temp.ver_of(current_setting('t.late')));
select public.channel_row_set_publish_mode(pg_temp.row_of(current_setting('t.future')), 'automatic', pg_temp.ver_of(current_setting('t.future')));
select throws_ok(
  format($$select public.channel_row_set_publish_mode('%s'::uuid, 'automatic', %s)$$, pg_temp.row_of(current_setting('t.plainitem')), pg_temp.ver_of(current_setting('t.plainitem'))),
  'connection_missing',
  'a channel row of an unconnected channel cannot be automatic'
);
select throws_ok(
  format($$select public.channel_row_set_publish_mode('%s'::uuid, 'automatic', 999)$$, pg_temp.row_of(current_setting('t.a'))),
  'conflict',
  'a stale version is refused'
);
select is(
  jsonb_array_length(public.content_publish_info(current_setting('t.a')::uuid)),
  1,
  'the publish info lists the rows of the content'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  format($$select public.channel_row_set_publish_mode('%s'::uuid, 'manual', %s)$$, pg_temp.row_of(current_setting('t.a')), pg_temp.ver_of(current_setting('t.a'))),
  'denied',
  'a role without content.publish_manual cannot change the mode'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  format($$select public.content_publish_info('%s'::uuid)$$, current_setting('t.a')),
  'not_found',
  'a manager of another brand cannot read the publish info'
);
reset role;

select set_config('t.work', public.publish_work(10, 6)::text, true);
select is(
  jsonb_array_length((current_setting('t.work')::jsonb) -> 'claimed'),
  2,
  'the job claims the two due rows inside the lateness window'
);
select is(
  (select auto_publish_state from public.content_channels where id = pg_temp.row_of(current_setting('t.a'))),
  'publishing',
  'a claimed row is publishing'
);
select is(
  (current_setting('t.work')::jsonb) -> 'claimed' -> 0 ->> 'caption',
  'Legenda de Item B',
  'the payload carries the approved caption (oldest first)'
);
select is(
  (select auto_publish_state from public.content_channels where id = pg_temp.row_of(current_setting('t.late'))),
  'failed',
  'a row past the lateness window fails instead of publishing late'
);
select is(
  (select last_error_code from public.content_channels where id = pg_temp.row_of(current_setting('t.late'))),
  'publish_too_late',
  'with the code publish_too_late'
);
select is(
  (select auto_publish_state from public.content_channels where id = pg_temp.row_of(current_setting('t.future'))),
  null,
  'a row planned for the future is left alone'
);
select is(
  jsonb_array_length(public.publish_work(10, 6) -> 'claimed'),
  0,
  'a second run claims nothing again'
);
select set_config('compasso.publish_job', 'off', true);
select throws_ok(
  format($$update public.content_channels set planned_at = now() + interval '1 day' where id = '%s'$$, pg_temp.row_of(current_setting('t.a'))),
  'publish_in_progress',
  'a row being published cannot be rescheduled'
);

select public.publish_attempt_set(
  ((current_setting('t.work')::jsonb) -> 'claimed' -> 1 -> 'attempt' ->> 'id')::uuid,
  'container_created', '17900000001', null, null
);
select is(
  (select container_id from public.publish_attempts where id = ((current_setting('t.work')::jsonb) -> 'claimed' -> 1 -> 'attempt' ->> 'id')::uuid),
  '17900000001',
  'the container id is saved before publishing'
);
select public.publish_row_complete(
  ((current_setting('t.work')::jsonb) -> 'claimed' -> 1 -> 'attempt' ->> 'id')::uuid,
  '17900000999', 'https://www.instagram.com/p/abc123/'
);
select is(
  (select publication_status from public.content_channels where id = pg_temp.row_of(current_setting('t.a'))),
  'published_manually',
  'a completed publication is recorded as published'
);
select is(
  (select published_via from public.content_channels where id = pg_temp.row_of(current_setting('t.a'))),
  'instagram_api',
  'with the way it was published'
);
select is(
  (select published_url from public.content_channels where id = pg_temp.row_of(current_setting('t.a'))),
  'https://www.instagram.com/p/abc123/',
  'and the link to the post'
);
select ok(
  exists (select 1 from public.audit_events where action = 'content_channel.published_auto')
    and (select count(*) from public.notifications where kind = 'content.published_auto') >= 1,
  'the publication is audited and notified'
);

select public.publish_row_failed(
  ((current_setting('t.work')::jsonb) -> 'claimed' -> 0 -> 'attempt' ->> 'id')::uuid,
  'media_not_ready', 'Media ID is not available', false
);
select is(
  (select auto_publish_state from public.content_channels where id = pg_temp.row_of(current_setting('t.b'))),
  'failed',
  'a failed attempt leaves the row failed'
);
select ok(
  (select count(*) from public.notifications where kind = 'content.publish_failed') >= 1,
  'and the team is notified'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  (public.dashboard_publication_pending(null) -> 0 ->> 'failed_rows')::int,
  1,
  'the dashboard block counts failed rows first'
);
select is(
  public.channel_row_publish_now(pg_temp.row_of(current_setting('t.b')), pg_temp.ver_of(current_setting('t.b'))) ->> 'id',
  pg_temp.row_of(current_setting('t.b'))::text,
  'a manager asks to publish again'
);
reset role;
select is(
  jsonb_array_length(public.publish_work(10, 6) -> 'claimed'),
  1,
  'the retried row is claimed again'
);
select is(
  (select attempt_count from public.content_channels where id = pg_temp.row_of(current_setting('t.b'))),
  2,
  'with the attempt counted'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($$select public.channel_connection_disconnect('%s'::uuid)$$, current_setting('t.channel')),
  'publish_in_progress',
  'a channel with a publication in progress cannot be disconnected'
);
reset role;
select public.publish_row_release(
  (select id from public.publish_attempts where channel_row_id = pg_temp.row_of(current_setting('t.b')) and attempt_no = 2),
  'publish_limit_reached'
);
select is(
  (select auto_publish_state from public.content_channels where id = pg_temp.row_of(current_setting('t.b'))),
  null,
  'a released row waits for the next run'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.channel_connection_disconnect(current_setting('t.channel')::uuid);
reset role;
select is(
  (select publish_mode from public.content_channels where id = pg_temp.row_of(current_setting('t.future'))),
  'manual',
  'disconnecting returns the waiting rows to manual publishing'
);

select set_config('t.rowb', pg_temp.row_of(current_setting('t.b'))::text, true);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(
  (select count(*)::int from public.publish_attempts),
  0,
  'an external user reads no publish attempt'
);
select throws_ok(
  format($$select public.content_publish_info('%s'::uuid)$$, current_setting('t.a')),
  'denied',
  'an external user cannot read the publish info'
);
select throws_ok(
  format($$select public.channel_row_publish_now('%s'::uuid, 1)$$, current_setting('t.rowb')),
  'denied',
  'an external user cannot ask for a publication'
);
select throws_ok(
  $$select public.publish_work(5, 6)$$,
  '42501',
  'an external user cannot run the publishing job'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  format($$select public.channel_row_publish_now('%s'::uuid, 1)$$, current_setting('t.rowb')),
  'not_found',
  'a manager of another brand cannot touch the row'
);
select is(
  (select count(*)::int from public.publish_attempts),
  0,
  'and reads no attempt of this brand'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select ok(
  (select count(*) from public.publish_attempts) >= 1,
  'a manager of the brand reads its attempts'
);
select throws_ok(
  $$select public.publish_row_complete(gen_random_uuid(), 'x', 'https://x.test/')$$,
  '42501',
  'a signed-in user cannot complete a publication'
);
select throws_ok(
  $$select public.publish_payload(gen_random_uuid(), gen_random_uuid())$$,
  '42501',
  'a signed-in user cannot build a payload'
);
reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.publish_attempts$$,
  '42501',
  'anon cannot read the attempts'
);
select throws_ok(
  $$select public.publish_work(5, 6)$$,
  '42501',
  'anon cannot run the publishing job'
);
reset role;

select throws_ok(
  format($$insert into public.publish_attempts (channel_row_id, brand_id, attempt_no) values ('%s', gen_random_uuid(), 99)$$, pg_temp.row_of(current_setting('t.a'))),
  '23503',
  'an attempt cannot carry another brand'
);

select * from finish();
rollback;

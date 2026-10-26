begin;

select plan(34);

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
  ('00000000-0000-0000-0000-0000000000d1', 'client@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'clientb@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Client', 'client@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Client B', 'clientb@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
select public.channel_connection_connect(
  current_setting('t.channel')::uuid,
  '{"external_account_id":"17841400000","username":"aurora.cafe","account_type":"BUSINESS"}'::jsonb,
  'ciphertext-ciphertext-ciphertext-1', now() + interval '60 days', array['instagram_business_manage_insights']
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Outra Marca"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Outra Marca'), true);
select public.brand_member_set(current_setting('t.brandB')::uuid, '00000000-0000-0000-0000-0000000000e1', 'external', false, 'active');
reset role;

select is(
  public.metrics_store_daily(current_setting('t.channel')::uuid, (
    select jsonb_agg(jsonb_build_object('day', (current_date - n)::text, 'metric', m.metric, 'value', m.base + (30 - n)))
    from generate_series(1, 20) n
    cross join (values ('reach', 100), ('views', 300), ('followers_total', 1000), ('follows', 5), ('unfollows', 1)) as m (metric, base)
  )),
  100,
  'the collector stores 20 days of five metrics'
);
select is(
  public.metrics_store_daily(current_setting('t.channel')::uuid, jsonb_build_array(jsonb_build_object('day', (current_date - 1)::text, 'metric', 'reach', 'value', 999))),
  1,
  'storing a day again updates it'
);
select throws_ok(
  format($$select public.metrics_store_daily('%s'::uuid, '[{"day":"2026-01-01","metric":"nonsense","value":1}]'::jsonb)$$, current_setting('t.channel')),
  '23514',
  'an unknown metric is refused by the table'
);
select is(
  public.metrics_store_media(current_setting('t.channel')::uuid, jsonb_build_array(
    jsonb_build_object('external_media_id', 'm1', 'permalink', 'https://www.instagram.com/p/a/', 'media_type', 'IMAGE', 'product_type', 'FEED', 'posted_at', (now() - interval '3 days')::text, 'caption_excerpt', 'Primeiro'),
    jsonb_build_object('external_media_id', 'm2', 'permalink', 'https://www.instagram.com/p/b/', 'media_type', 'VIDEO', 'product_type', 'REELS', 'posted_at', (now() - interval '8 days')::text, 'caption_excerpt', 'Segundo')
  )),
  2,
  'the collector indexes the posts'
);
select public.metrics_store_post(current_setting('t.channel')::uuid, 'm1', 'h24', '{"reach":500,"saves":40,"interactions":90}'::jsonb);
select public.metrics_store_post(current_setting('t.channel')::uuid, 'm2', 'h24', '{"reach":900,"saves":10,"interactions":60}'::jsonb);
select is(
  jsonb_array_length(public.metrics_media_due(current_setting('t.channel')::uuid, 10)),
  2,
  'the collector knows which age buckets are still missing'
);
select public.metrics_store_audience(current_setting('t.channel')::uuid, current_date, '[{"dimension":"country","breakdown":{"BR":90,"PT":10}}]'::jsonb);
select ok(
  public.metrics_collect_targets() @> jsonb_build_array(jsonb_build_object('channel_id', current_setting('t.channel'))),
  'the channel is a collection target'
);
select public.metrics_collection_done(current_setting('t.channel')::uuid, 1500);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  public.metrics_overview(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 20, current_date - 1, 'previous', 'day') -> 'totals' -> 'follows' ->> 'sum',
  '490',
  'the overview sums an additive metric over the period'
);
select is(
  public.metrics_overview(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 20, current_date - 1, 'previous', 'week') -> 'series' -> 'reach' -> 0 ->> 'start' is not null,
  true,
  'the series are bucketed by week'
);
select is(
  (public.metrics_overview(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 20, current_date - 1, 'none', 'day') -> 'previous_totals')::text,
  'null',
  'no comparison means no previous period'
);
select is(
  (public.metrics_overview(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 9, current_date - 1, 'previous', 'day') ->> 'previous_to'),
  (current_date - 10)::text,
  'the previous period ends the day before the current one'
);
select is(
  public.metrics_overview(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 9, current_date - 1, 'previous', 'day') -> 'totals' -> 'followers_total' ->> 'last',
  '1029',
  'the followers total keeps the last value of the period'
);
select is(
  public.metrics_top_posts(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 30, current_date, 'reach', 5) -> 0 ->> 'external_media_id',
  'm2',
  'the best post by reach comes first'
);
select is(
  public.metrics_top_posts(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 30, current_date, 'saves', 5) -> 0 ->> 'external_media_id',
  'm1',
  'and the ranking follows the metric chosen'
);
select is(
  jsonb_array_length(public.metrics_breakdown(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid, current_date - 30, current_date, 'format', 'reach')),
  2,
  'the breakdown by format has one group per format'
);
select is(
  jsonb_array_length(public.metrics_audience(current_setting('t.brand')::uuid, current_setting('t.channel')::uuid)),
  1,
  'the audience returns the latest snapshot'
);
select throws_ok(
  format($$select public.metrics_overview('%s'::uuid, '%s'::uuid, current_date, current_date - 1, 'previous', 'day')$$, current_setting('t.brand'), current_setting('t.channel')),
  'invalid_input',
  'a period that ends before it starts is refused'
);
select is(
  public.metric_mark_save(format('{"brand_id":"%s","kind":"campaign","label":"Campanha de Dia das Maes","starts_on":"%s"}', current_setting('t.brand'), current_date - 5)::jsonb) ->> 'version',
  '1',
  'a manager records a mark'
);
select is(
  jsonb_array_length(public.metric_marks_list(current_setting('t.brand')::uuid, current_date - 30, current_date)),
  1,
  'the mark is listed inside its period'
);
select set_config('t.report', public.metrics_report_save(format('{"brand_id":"%s","channel_id":"%s","period_start":"%s","period_end":"%s","title":"Resultados de outubro","message":"Mes de crescimento","next_steps":["Mais reels"],"blocks":[{"kind":"summary"}]}', current_setting('t.brand'), current_setting('t.channel'), current_date - 20, current_date - 1)::jsonb) ->> 'id', true);
select throws_ok(
  format($$select public.metrics_report_publish('%s'::uuid, 99, '{"x":1}'::jsonb)$$, current_setting('t.report')),
  'conflict',
  'publishing needs the current version'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(
  jsonb_array_length(public.portal_metrics_report_list(current_setting('t.brand')::uuid)),
  0,
  'a draft is not visible'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(
  jsonb_array_length(public.metrics_report_list(current_setting('t.brand')::uuid)),
  1,
  'a collaborator with metrics.view reads the reports'
);
select throws_ok(
  format($$select public.metric_mark_save('{"brand_id":"%s","kind":"event","label":"Evento","starts_on":"2026-10-01"}'::jsonb)$$, current_setting('t.brand')),
  'denied',
  'a collaborator without metrics.report cannot write marks'
);
select throws_ok(
  format($$select public.metrics_report_publish('%s'::uuid, 1, '{"x":1}'::jsonb)$$, current_setting('t.report')),
  'denied',
  'or publish a report'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  format($$select public.metrics_overview('%s'::uuid, '%s'::uuid, current_date - 5, current_date - 1, 'none', 'day')$$, current_setting('t.brand'), current_setting('t.channel')),
  'not_found',
  'a manager of another brand reads nothing'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.metrics_report_publish(current_setting('t.report')::uuid, 1, '{"summary":{"reach":100}}'::jsonb);
reset role;
select is(
  (select status from public.metric_reports where id = current_setting('t.report')::uuid),
  'published',
  'the report is published with a frozen snapshot'
);
select throws_ok(
  format($$update public.metric_reports set title = 'Outro titulo' where id = '%s'$$, current_setting('t.report')),
  'report_already_published',
  'a published report cannot be edited'
);
select throws_ok(
  format($$delete from public.metric_reports where id = '%s'$$, current_setting('t.report')),
  'report_already_published',
  'or deleted'
);
select ok(
  (select count(*) from public.notifications where kind = 'metrics.report_published') >= 1,
  'the client is notified'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(
  jsonb_array_length(public.portal_metrics_report_list(current_setting('t.brand')::uuid)),
  1,
  'the client sees the published report'
);
select is(
  public.portal_metrics_report_get(current_setting('t.report')::uuid) -> 'snapshot' -> 'summary' ->> 'reach',
  '100',
  'with the frozen snapshot'
);
select is(
  (select count(*)::int from public.metric_reports),
  0,
  'but reads no row of the table directly'
);
select throws_ok(
  format($$select public.metrics_overview('%s'::uuid, '%s'::uuid, current_date - 5, current_date - 1, 'none', 'day')$$, current_setting('t.brand'), current_setting('t.channel')),
  'denied',
  'or the internal analysis'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(
  format($$select public.portal_metrics_report_get('%s'::uuid)$$, current_setting('t.report')),
  'not_found',
  'a client of another brand cannot read the report'
);
reset role;

set local role anon;
select throws_ok(
  format($$select public.portal_metrics_report_list('%s'::uuid)$$, current_setting('t.brand')),
  '42501',
  'anon cannot call the portal function'
);
reset role;

select * from finish();
rollback;

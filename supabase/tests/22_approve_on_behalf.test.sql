begin;

select plan(31);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.upload(p_user uuid, p_brand uuid, p_name text, p_key text) returns uuid language plpgsql as $$
declare
  v_up jsonb;
begin
  perform pg_temp.act_as(p_user);
  v_up := public.media_request_upload('brand', p_brand, p_name, 1000, 'image/jpeg', p_key);
  perform public.media_confirm_upload((v_up ->> 'version_id')::uuid, repeat('a', 64), 800, 600, null, 0);
  reset role;
  return (v_up ->> 'version_id')::uuid;
end;
$$;

create function pg_temp.ver(p_item uuid) returns int language sql as $$
  select version from public.content_items where id = p_item
$$;

create function pg_temp.body(p_item uuid, p_summary text, p_date text, p_art boolean, p_caption text default 'Texto')
returns jsonb language plpgsql as $$
declare
  v_row uuid;
begin
  select id into v_row from public.content_channels where content_item_id = p_item order by position limit 1;
  return jsonb_strip_nulls(jsonb_build_object(
    'id', p_item,
    'brand_id', current_setting('t.brand'),
    'expected_version', case when p_item is null then null else pg_temp.ver(p_item) end,
    'title', 'Campanha de outono',
    'plan_summary', case when p_summary is null then null else jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', p_summary))))) end,
    'plan_media', jsonb_build_array(jsonb_build_object('media_version_id', current_setting('t.media1'))),
    'caption', jsonb_build_object('text', p_caption),
    'working_media', case
      when p_art then jsonb_build_array(jsonb_build_object('media_version_id', current_setting('t.media2')))
      else '[]'::jsonb
    end,
    'channels', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', v_row, 'channel_id', current_setting('t.channel'), 'format', 'image',
      'planned_at', p_date, 'planned_timezone', 'America/Sao_Paulo'
    )))
  ));
end;
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
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
reset role;

select set_config('t.media1', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'ref.jpg', 'idem-obo-0001')::text, true);
select set_config('t.media2', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'arte.jpg', 'idem-obo-0002')::text, true);
select set_config('t.date1', to_char(now() + interval '10 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.itemA', public.content_item_save(pg_temp.body(null, 'Resumo do plano', current_setting('t.date1'), true))::jsonb ->> 'id', true);
reset role;

select set_config('t.verA', pg_temp.ver(current_setting('t.itemA')::uuid)::text, true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select public.approve_on_behalf('%s', 'plan', null, %s)$$, current_setting('t.itemA'), current_setting('t.verA')), 'denied', 'a collaborator cannot approve on behalf');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.approve_on_behalf('%s', 'plan', null, %s)$$, current_setting('t.itemA'), current_setting('t.verA')), 'denied', 'neither can an external approver');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok(format($$select public.approve_on_behalf('%s', 'plan', null, %s)$$, current_setting('t.itemA'), current_setting('t.verA')), 'not_found', 'a manager of another brand does not find the content');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.approve_on_behalf('%s', 'art', null, %s)$$, current_setting('t.itemA'), pg_temp.ver(current_setting('t.itemA')::uuid)), 'plan_not_approved', 'the art needs the plan approved first');
select throws_ok(format($$select public.approve_on_behalf('%s', 'plan', null, 999)$$, current_setting('t.itemA')), 'conflict', 'a stale version conflicts');
select throws_ok(format($$select public.approve_on_behalf('%s', 'video', null, %s)$$, current_setting('t.itemA'), pg_temp.ver(current_setting('t.itemA')::uuid)), 'invalid_input', 'an unknown stage is refused');
select lives_ok(format($$select public.approve_on_behalf('%s', 'plan', 'Cliente confia na equipe', %s)$$, current_setting('t.itemA'), pg_temp.ver(current_setting('t.itemA')::uuid)), 'the manager approves a plan that was never sent');
reset role;

select is((select editorial_status from public.content_items where id = current_setting('t.itemA')::uuid), 'plan_approved', 'the content has its plan approved');
select isnt((select plan_approved_revision_id from public.content_items where id = current_setting('t.itemA')::uuid), null, 'with a frozen plan version');
select is((select d.on_behalf and d.reason = 'Cliente confia na equipe' from public.approval_decisions d join public.approval_requests q on q.id = d.request_id where q.item_id = current_setting('t.itemA')::uuid), true, 'the decision records the origin and the reason');
select is((select count(*)::int from public.audit_events where action = 'approval.approved_by_team' and metadata ->> 'had_pending' = 'false' and metadata ->> 'stage' = 'plan'), 1, 'the approval is audited without a pending request');
select is((select count(*)::int from public.notifications where kind = 'approval.approved_by_team'), 0, 'nobody is notified when nothing had been sent');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.approve_on_behalf('%s', 'plan', null, %s)$$, current_setting('t.itemA'), pg_temp.ver(current_setting('t.itemA')::uuid)), 'transition_not_allowed', 'an approved plan cannot be approved again');
select throws_ok(format($$select public.content_move('%s', 'approved', %s)$$, current_setting('t.itemA'), pg_temp.ver(current_setting('t.itemA')::uuid)), 'transition_not_allowed', 'a plain status move still cannot approve');
select lives_ok(format($$select public.approve_on_behalf('%s', 'art', null, %s)$$, current_setting('t.itemA'), pg_temp.ver(current_setting('t.itemA')::uuid)), 'the art is approved right after the plan');
reset role;

select is((select editorial_status from public.content_items where id = current_setting('t.itemA')::uuid), 'approved', 'the content is approved');
select isnt((select approved_revision_id from public.content_items where id = current_setting('t.itemA')::uuid), null, 'with a frozen art version');
select is((select count(*)::int from public.content_revisions where item_id = current_setting('t.itemA')::uuid), 2, 'one plan version and one art version exist');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.reopen_content('%s', 'Rever a arte', 'art')$$, current_setting('t.itemA')), 'reopening the art works as after a client approval');
reset role;
select is((select editorial_status from public.content_items where id = current_setting('t.itemA')::uuid), 'in_production', 'and returns the content to production');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.itemB', public.content_item_save(pg_temp.body(null, 'Resumo do plano', current_setting('t.date1'), false))::jsonb ->> 'id', true);
select set_config('t.subB', public.submit_for_approval(current_setting('t.itemB')::uuid, null, null, pg_temp.ver(current_setting('t.itemB')::uuid))::text, true);
select set_config('t.reqB', current_setting('t.subB')::jsonb ->> 'request_id', true);
select lives_ok(format($$select public.approve_on_behalf('%s', 'plan', null, %s)$$, current_setting('t.itemB'), pg_temp.ver(current_setting('t.itemB')::uuid)), 'the manager approves while the client has not answered');
reset role;

select is((select status from public.approval_requests where id = current_setting('t.reqB')::uuid), 'approved', 'the pending request is closed as approved');
select is((select count(*)::int from public.content_revisions where item_id = current_setting('t.itemB')::uuid), 1, 'and no new version was created');
select is((select d.on_behalf and d.reason is null from public.approval_decisions d where d.request_id = current_setting('t.reqB')::uuid), true, 'the decision is on behalf with no reason');
select is((select count(*)::int from public.audit_events where action = 'approval.approved_by_team' and metadata ->> 'had_pending' = 'true'), 1, 'the audit tells that a request was pending');
select is((select body from public.notifications where kind = 'approval.approved_by_team' and user_id = '00000000-0000-0000-0000-0000000000d1'), 'A equipe aprovou «Campanha de outono» (Planejamento).', 'the approver is told the team approved');
select is((select count(*)::int from public.notifications where kind = 'approval.requested' and ref_id = current_setting('t.reqB')::uuid and status = 'active'), 0, 'and the request stops waiting for them');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.reqB')), 'request_not_pending', 'the client can no longer decide the closed request');
select is((public.portal_get_approval(current_setting('t.reqB')::uuid) -> 'decision' ->> 'decided_on_behalf')::boolean, true, 'the portal says the team approved');
select is(public.portal_get_approval(current_setting('t.reqB')::uuid) -> 'decision' ->> 'decided_by_name', null, 'without the name of the manager');
reset role;

set local role anon;
select throws_ok($$select public.approve_on_behalf(gen_random_uuid(), 'plan', null, 1)$$, 'permission denied for function approve_on_behalf', 'anon cannot approve on behalf');
reset role;

select * from finish();
rollback;

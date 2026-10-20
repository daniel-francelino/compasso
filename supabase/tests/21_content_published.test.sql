begin;

select plan(67);

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
    'plan_summary', p_summary,
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
  ('00000000-0000-0000-0000-0000000000d1', 'approver1@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'approver2@example.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'commenter@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'approverb@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver One', 'approver1@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000d2'::uuid, 'Approver Two', 'approver2@example.test', 'external', 'external_approver'),
  ('00000000-0000-0000-0000-0000000000d3'::uuid, 'Commenter', 'commenter@example.test', 'external', 'external_commenter'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Approver B', 'approverb@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select set_config('t.channel', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"aurora.cafe"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', true, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d3', 'external', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
select public.brand_member_set(current_setting('t.brandB')::uuid, '00000000-0000-0000-0000-0000000000e1', 'external', true, 'active');
reset role;

select set_config('t.media1', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'ref.jpg', 'idem-plan-0001')::text, true);
select set_config('t.media2', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'arte.jpg', 'idem-plan-0002')::text, true);
select set_config('t.date1', to_char(now() + interval '10 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), true);
select set_config('t.date2', to_char(now() + interval '12 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), true);

select is(public.plan_approval_required(), true, 'the plan approval is required by default');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.item', public.content_item_save(pg_temp.body(null, 'Resumo do plano', null, false))::jsonb ->> 'id', true);
select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'planning', 'a new content starts in planning');
select is((select plan_required from public.content_items where id = current_setting('t.item')::uuid), true, 'and remembers that its plan is required');
select lives_ok(format($$select public.content_item_save('%s'::jsonb)$$, pg_temp.body(current_setting('t.item')::uuid, 'Resumo do plano', null, true)), 'art files can be attached before the plan is approved');
select throws_ok(format($$select public.content_move('%s', 'in_production', %s)$$, current_setting('t.item'), pg_temp.ver(current_setting('t.item')::uuid)), 'transition_not_allowed', 'the art cannot start from planning');
select throws_ok(format($$select public.submit_for_approval('%s', null, null, %s)$$, current_setting('t.item'), pg_temp.ver(current_setting('t.item')::uuid)), 'plan_incomplete', 'a plan without a planned date cannot be sent');
select lives_ok(format($$select public.content_item_save('%s'::jsonb)$$, pg_temp.body(current_setting('t.item')::uuid, 'Resumo do plano', current_setting('t.date1'), false)), 'the plan gets a planned date');
select is((select jsonb_array_length(plan_media) from public.content_items where id = current_setting('t.item')::uuid), 1, 'and keeps its planning image');
select is((select count(*)::int from public.content_channels where content_item_id = current_setting('t.item')::uuid), 1, 'with one channel row');
select throws_ok(format($$select public.submit_for_approval('%s', null, null, 1)$$, current_setting('t.item')), 'conflict', 'a stale version conflicts on submission');
select set_config('t.sub1', public.submit_for_approval(current_setting('t.item')::uuid, current_date + 3, 'Planejamento de outono', pg_temp.ver(current_setting('t.item')::uuid))::text, true);
select set_config('t.req1', current_setting('t.sub1')::jsonb ->> 'request_id', true);
select set_config('t.rev1', current_setting('t.sub1')::jsonb ->> 'revision_id', true);
reset role;

select is(current_setting('t.sub1')::jsonb ->> 'stage', 'plan', 'sending from planning creates a plan version');
select is((select stage from public.content_revisions where id = current_setting('t.rev1')::uuid), 'plan', 'the version is a plan version');
select is((select stage from public.approval_requests where id = current_setting('t.req1')::uuid), 'plan', 'and so is the request');
select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'awaiting_plan_approval', 'the content waits for the plan decision');
select is((select count(*)::int from public.content_revision_media where revision_id = current_setting('t.rev1')::uuid), 1, 'the plan version carries the planning image');
select is((select snapshot ->> 'plan_summary' from public.content_revisions where id = current_setting('t.rev1')::uuid), 'Resumo do plano', 'and the planning summary');
select is((select count(*)::int from public.notifications where kind = 'approval.requested' and ref_id = current_setting('t.req1')::uuid and user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')), 2, 'every approver of the brand is asked');
select is((select count(*)::int from public.notifications where kind = 'approval.requested' and ref_id = current_setting('t.req1')::uuid and user_id in ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1')), 0, 'but not a commenter or an approver of another brand');
select is((select title from public.notifications where ref_id = current_setting('t.req1')::uuid and user_id = '00000000-0000-0000-0000-0000000000d1'), 'Planejamento aguarda sua decisão', 'the notification names the stage');
select is((select count(*)::int from public.audit_events where action = 'content.submitted' and metadata ->> 'stage' = 'plan'), 1, 'the submission is audited with its stage');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'can_decide')::boolean, true, 'the first approver sees the decision controls');
select is(public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'stage', 'plan', 'and the stage of the request');
select is((public.portal_list_brands() -> 0 ->> 'pending_count')::int, 1, 'the brand counts one request waiting');
select is(public.portal_get_approval(current_setting('t.req1')::uuid) ->> 'plan_summary', 'Resumo do plano', 'the approval shows the planning summary');
select is(jsonb_array_length(public.portal_get_approval(current_setting('t.req1')::uuid) -> 'media'), 1, 'and the planning image');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d3');
select is((public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'can_decide')::boolean, false, 'a member without the right to decide does not get the controls');
select is((public.portal_list_brands() -> 0 ->> 'pending_count')::int, 0, 'and the brand shows nothing waiting for them');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req1')), 'denied', 'nor can they decide');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req1')), 'not_found', 'an approver of another brand does not find the request');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select is((public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'can_decide')::boolean, true, 'the second approver also sees the controls');
select is(public.portal_decide_approval(current_setting('t.req1')::uuid, 'approved', null) ->> 'stage', 'plan', 'the second approver decides the plan');
reset role;

select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'plan_approved', 'the content has its plan approved');
select is((select plan_approved_revision_id::text from public.content_items where id = current_setting('t.item')::uuid), current_setting('t.rev1'), 'pointing to the version that was approved');
select is((select decided_by::text from public.approval_decisions where request_id = current_setting('t.req1')::uuid), '00000000-0000-0000-0000-0000000000d2', 'the decision records who decided');
select is((select count(*)::int from public.notifications where ref_id = current_setting('t.req1')::uuid and kind = 'approval.requested' and status = 'active'), 0, 'the request stops waiting for the other approvers');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_decide_approval('%s', 'changes_requested', 'Quero mudar tudo')$$, current_setting('t.req1')), 'request_not_pending', 'the first decision wins and the other approver is refused');
select is(public.portal_get_approval(current_setting('t.req1')::uuid) -> 'decision' ->> 'decided_by_name', 'Approver Two', 'and sees who decided');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.content_item_save('%s'::jsonb)$$, pg_temp.body(current_setting('t.item')::uuid, 'Outro resumo', current_setting('t.date1'), false)), 'plan_locked', 'the planning summary is locked after the approval');
select throws_ok(format($$select public.content_item_save('%s'::jsonb)$$, pg_temp.body(current_setting('t.item')::uuid, 'Resumo do plano', current_setting('t.date2'), false)), 'plan_locked', 'and so is the planned date');
select throws_ok(format($$select public.reschedule_channel('%s', now() + interval '20 days', 'America/Sao_Paulo', %s)$$, (select id from public.content_channels where content_item_id = current_setting('t.item')::uuid), (select version from public.content_channels where content_item_id = current_setting('t.item')::uuid)), 'plan_locked', 'rescheduling from the calendar is refused too');
select throws_ok(format($$select public.submit_for_approval('%s', null, null, %s)$$, current_setting('t.item'), pg_temp.ver(current_setting('t.item')::uuid)), 'transition_not_allowed', 'the art is not sent before production starts');
select lives_ok(format($$select public.content_move('%s', 'in_production', %s)$$, current_setting('t.item'), pg_temp.ver(current_setting('t.item')::uuid)), 'production of the art starts after the plan approval');
select lives_ok(format($$select public.content_item_save('%s'::jsonb)$$, pg_temp.body(current_setting('t.item')::uuid, 'Resumo do plano', current_setting('t.date1'), true, 'Texto final')), 'the art files and the final text can be saved');
select set_config('t.sub2', public.submit_for_approval(current_setting('t.item')::uuid, null, null, pg_temp.ver(current_setting('t.item')::uuid))::text, true);
select set_config('t.req2', current_setting('t.sub2')::jsonb ->> 'request_id', true);
reset role;

select is(current_setting('t.sub2')::jsonb ->> 'stage', 'art', 'sending from production creates an art version');
select is((select revision_no from public.content_revisions where id = (current_setting('t.sub2')::jsonb ->> 'revision_id')::uuid), 2, 'numbered after the plan version');
select is((select title from public.notifications where ref_id = current_setting('t.req2')::uuid and user_id = '00000000-0000-0000-0000-0000000000d2'), 'Artes aguardam sua decisão', 'the approvers are told the art waits');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(public.portal_decide_approval(current_setting('t.req2')::uuid, 'approved', null) ->> 'stage', 'art', 'an approver approves the art');
reset role;

select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'approved', 'the content is approved');
select is((select plan_approved_revision_id::text from public.content_items where id = current_setting('t.item')::uuid), current_setting('t.rev1'), 'and the plan approval is untouched');
select is((select approved_revision_id::text from public.content_items where id = current_setting('t.item')::uuid), current_setting('t.sub2')::jsonb ->> 'revision_id', 'while the art approval points to the art version');

select set_config('request.jwt.claims', '', true);
select set_config('t.size_before', public.media_storage_used()::text, true);
select set_config('t.row', (select id::text from public.content_channels where content_item_id = current_setting('t.item')::uuid limit 1), true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.publish_content('%s', %s)$$, current_setting('t.item'), pg_temp.ver(current_setting('t.item')::uuid)), 'channels_not_published', 'a content with an unpublished channel row cannot be marked as published');
select lives_ok(format($$select public.mark_published('%s', now() - interval '1 hour', 'https://instagram.com/p/abc', null, null)$$, current_setting('t.row')), 'the channel row is recorded as published');
select throws_ok(format($$select public.publish_content('%s', 1)$$, current_setting('t.item')), 'conflict', 'a stale version conflicts');
select set_config('t.pub', public.publish_content(current_setting('t.item')::uuid, pg_temp.ver(current_setting('t.item')::uuid))::text, true);
reset role;

select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'published', 'the content becomes published');
select is((current_setting('t.pub')::jsonb ->> 'queued')::int, 2, 'the plan file and the art file are queued for clean-up');
select is((select purge_keep_preview from public.media_versions where id = current_setting('t.media2')::uuid), true, 'the approved art keeps its preview');
select is((select purge_keep_preview from public.media_versions where id = current_setting('t.media1')::uuid), false, 'the planning file keeps nothing');
select is((select count(*)::int from public.audit_events where action = 'content.published'), 1, 'the publication is audited');

select set_config('request.jwt.claims', '', true);
select is(jsonb_array_length(public.media_purge_pending()), 2, 'both files are pending removal');
select is(public.media_purge_confirm(array[current_setting('t.media1')::uuid, current_setting('t.media2')::uuid]), 2, 'the removal is confirmed');
select is((select count(*)::int from public.media_versions where id in (current_setting('t.media1')::uuid, current_setting('t.media2')::uuid) and original_purged_at is not null), 2, 'the originals are marked as purged');
select is(public.media_storage_used(), current_setting('t.size_before')::bigint - 2000, 'the storage used drops by the removed originals');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.publish_content('%s', %s)$$, current_setting('t.item'), pg_temp.ver(current_setting('t.item')::uuid)), 'not_approved', 'a published content cannot be published again');
select throws_ok(format($$select public.reopen_content('%s', 'Mudou tudo', 'art')$$, current_setting('t.item')), 'transition_not_allowed', 'a published content cannot be reopened');
select throws_ok(format($$select public.content_item_save('%s'::jsonb)$$, pg_temp.body(current_setting('t.item')::uuid, 'Resumo do plano', current_setting('t.date1'), false, 'Outro texto')), 'requires_new_revision', 'a published content refuses new text and files');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.publish_content('%s', 1)$$, current_setting('t.item')), 'denied', 'an external user cannot publish');
reset role;

set local role anon;
select throws_ok($$select public.publish_content(gen_random_uuid(), 1)$$, 'permission denied for function publish_content', 'anon cannot publish');
reset role;

select * from finish();
rollback;

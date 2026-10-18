begin;

select plan(158);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.upload(p_user uuid, p_brand uuid, p_name text, p_key text, p_confirm boolean) returns uuid language plpgsql as $$
declare
  v_up jsonb;
begin
  perform pg_temp.act_as(p_user);
  v_up := public.media_request_upload('brand', p_brand, p_name, 1000, 'image/jpeg', p_key);
  if p_confirm then
    perform public.media_confirm_upload((v_up ->> 'version_id')::uuid, repeat('a', 64), 800, 600, null, 0);
  end if;
  reset role;
  return (v_up ->> 'version_id')::uuid;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver1@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'approver2@example.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'commenter@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'approverb@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
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
select set_config('t.channel2', public.channel_save(format('{"brand_id":"%s","platform":"linkedin","profile_name":"Aurora"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d3', 'external', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
select set_config('t.channelB', public.channel_save(format('{"brand_id":"%s","platform":"instagram","profile_name":"padaria.sol"}', current_setting('t.brandB'))::jsonb) ->> 'id', true);
select public.brand_member_set(current_setting('t.brandB')::uuid, '00000000-0000-0000-0000-0000000000e1', 'external', true, 'active');
reset role;

select set_config('t.media1', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'a.jpg', 'idem-content-01', true)::text, true);
select set_config('t.media2', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'b.jpg', 'idem-content-02', true)::text, true);
select set_config('t.mediaPending', pg_temp.upload('00000000-0000-0000-0000-0000000000b1', current_setting('t.brand')::uuid, 'c.jpg', 'idem-content-03', false)::text, true);
select set_config('t.mediaB', pg_temp.upload('00000000-0000-0000-0000-0000000000b2', current_setting('t.brandB')::uuid, 'd.jpg', 'idem-content-04', true)::text, true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.item', public.content_item_save(format('{"brand_id":"%s","title":"Lançamento de outono","tags":["Outono"," outono ","Campanha"]}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select is((select tags from public.content_items where id = current_setting('t.item')::uuid), array['Campanha', 'Outono', 'outono'], 'tags are trimmed and deduplicated');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"x"}'::jsonb)$$, current_setting('t.brand')), 'invalid_input', 'a title below two characters is refused');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Com responsavel","assignee_id":"00000000-0000-0000-0000-0000000000b2"}'::jsonb)$$, current_setting('t.brand')), 'invalid_input', 'an assignee who is not linked to the brand is refused');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Outra marca"}'::jsonb)$$, current_setting('t.brandB')), 'not_found', 'an item cannot be created on a brand the person is not linked to');
select is((public.content_item_save(format('{"id":"%s","brand_id":"%s","title":"Lançamento de outono","objective":"Vender","expected_version":1}', current_setting('t.item'), current_setting('t.brand'))::jsonb) ->> 'version')::int, 2, 'editing an item increments its version');
select throws_ok(format($$select public.content_item_save('{"id":"%s","brand_id":"%s","title":"Outro titulo","expected_version":1}'::jsonb)$$, current_setting('t.item'), current_setting('t.brand')), 'conflict', 'a stale item version conflicts');

select set_config('t.v1', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"carousel","caption":{"text":"Chegou o outono"},"working_media":[{"media_version_id":"%s","alt_text":"Xicara"},{"media_version_id":"%s"}]}', current_setting('t.item'), current_setting('t.channel'), current_setting('t.media1'), current_setting('t.media2'))::jsonb) ->> 'id', true);
select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'draft', 'a variant starts as a draft');
select is((select publication_status from public.content_variants where id = current_setting('t.v1')::uuid), 'unplanned', 'and unplanned');
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"image"}'::jsonb)$$, current_setting('t.item'), current_setting('t.channelB')), 'channel_brand_mismatch', 'a channel of another brand is refused');
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"poster"}'::jsonb)$$, current_setting('t.item'), current_setting('t.channel')), 'invalid_input', 'an unknown format is refused');
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"image","working_media":[{"media_version_id":"%s"}]}'::jsonb)$$, current_setting('t.item'), current_setting('t.channel'), current_setting('t.mediaB')), 'media_not_available', 'a file of another brand cannot be attached');
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"image","working_media":[{"media_version_id":"%s"}]}'::jsonb)$$, current_setting('t.item'), current_setting('t.channel'), current_setting('t.mediaPending')), 'media_not_available', 'a file that is not available cannot be attached');
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"image","working_media":[{"media_version_id":"%s"},{"media_version_id":"%s"}]}'::jsonb)$$, current_setting('t.item'), current_setting('t.channel'), current_setting('t.media1'), current_setting('t.media1')), 'invalid_input', 'the same file twice is refused');
select public.channel_set_archived(current_setting('t.channel2')::uuid, true);
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"text"}'::jsonb)$$, current_setting('t.item'), current_setting('t.channel2')), 'channel_archived', 'an archived channel is refused');
select public.channel_set_archived(current_setting('t.channel2')::uuid, false);
select throws_ok(format($$select public.content_variant_save('{"id":"%s","content_item_id":"%s","channel_id":"%s","format":"carousel","caption":{"text":"x"}}'::jsonb, 99)$$, current_setting('t.v1'), current_setting('t.item'), current_setting('t.channel')), 'conflict', 'a stale variant version conflicts');

select throws_ok(format($$select public.content_variant_move('%s', 'awaiting_approval', 1)$$, current_setting('t.v1')), 'transition_not_allowed', 'the board cannot jump to awaiting approval');
select throws_ok(format($$select public.content_variant_move('%s', 'approved', 1)$$, current_setting('t.v1')), 'transition_not_allowed', 'nor to approved');
select lives_ok(format($$select public.content_variant_move('%s', 'in_production', 1)$$, current_setting('t.v1')), 'a draft moves to production');
select lives_ok(format($$select public.content_variant_move('%s', 'internal_review', 2)$$, current_setting('t.v1')), 'production moves to internal review');
select is((select version from public.content_variants where id = current_setting('t.v1')::uuid), 3, 'each move increments the version');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d1', null, null, 3)$$, current_setting('t.v1')), 'denied', 'a collaborator cannot send for approval');
select lives_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Item do colaborador"}'::jsonb)$$, current_setting('t.brand')), 'a collaborator creates items');
select throws_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item')), 'denied', 'a collaborator cannot delete items');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(jsonb_array_length(public.approver_options(current_setting('t.brand')::uuid) -> 'approvers'), 1, 'only the member who can decide is offered as approver');
select is((public.approver_options(current_setting('t.brand')::uuid) ->> 'default_deadline_days')::int, 3, 'the default deadline comes from the approvals policy');
select throws_ok(format($$select public.approver_options('%s')$$, current_setting('t.brandB')), 'not_found', 'approvers of another brand are not listed');
select throws_ok(format($$select public.submit_for_approval('%s', null, null, null, 3)$$, current_setting('t.v1')), 'approver_required', 'an approver is required');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d2', null, null, 3)$$, current_setting('t.v1')), 'approver_without_access', 'a member without can_decide cannot be the approver');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d3', null, null, 3)$$, current_setting('t.v1')), 'approver_without_access', 'a commenter cannot be the approver');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000e1', null, null, 3)$$, current_setting('t.v1')), 'approver_without_access', 'an approver of another brand is refused');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000b1', null, null, 3)$$, current_setting('t.v1')), 'approver_without_access', 'an internal user cannot be the approver');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d1', null, null, 1)$$, current_setting('t.v1')), 'conflict', 'a stale version conflicts on submission');
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d1', current_date - 3, null, 3)$$, current_setting('t.v1')), 'invalid_input', 'an approval deadline in the past is refused');
select set_config('t.empty', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text"}', current_setting('t.item'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select public.content_variant_move(current_setting('t.empty')::uuid, 'in_production', 1);
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d1', null, null, 2)$$, current_setting('t.empty')), 'invalid_input', 'a variant with no text and no files cannot be sent');
select set_config('t.draft', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text","caption":{"text":"Rascunho"}}', current_setting('t.item'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select throws_ok(format($$select public.submit_for_approval('%s', '00000000-0000-0000-0000-0000000000d1', null, null, 1)$$, current_setting('t.draft')), 'transition_not_allowed', 'a draft cannot be sent');

select set_config('t.sub1', public.submit_for_approval(current_setting('t.v1')::uuid, '00000000-0000-0000-0000-0000000000d1', current_date + 3, 'Pode olhar?', 3)::text, true);
select set_config('t.req1', current_setting('t.sub1')::jsonb ->> 'request_id', true);
select set_config('t.rev1', current_setting('t.sub1')::jsonb ->> 'revision_id', true);
select is((current_setting('t.sub1')::jsonb ->> 'revision_no')::int, 1, 'the first submission creates revision 1');
select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'awaiting_approval', 'the variant waits for approval');
select is((select count(*)::int from public.content_revision_media where revision_id = current_setting('t.rev1')::uuid), 2, 'the revision freezes the files in order');
select is((select snapshot ->> 'title' from public.content_revisions where id = current_setting('t.rev1')::uuid), 'Lançamento de outono', 'the revision freezes the title');
select is((select count(*)::int from public.media_usages where usage_type = 'content_revision' and usage_ref_id = current_setting('t.rev1')::uuid), 2, 'the files are marked as used by the revision');
reset role;
select is((select count(*)::int from public.audit_events where action = 'variant.submitted' and entity_id = current_setting('t.v1')::uuid), 1, 'the submission is audited');
select is((select count(*)::int from public.audit_events where action = 'approval.requested'), 1, 'the request is audited');

select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'approval.requested'), 1, 'the approver receives the notification in the same transaction');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.content_variant_save('{"id":"%s","content_item_id":"%s","channel_id":"%s","format":"carousel","caption":{"text":"Texto novo"},"working_media":[{"media_version_id":"%s"},{"media_version_id":"%s"}]}'::jsonb, 4)$$, current_setting('t.v1'), current_setting('t.item'), current_setting('t.channel'), current_setting('t.media1'), current_setting('t.media2')), 'the working copy of a pending variant can be edited');
select is((select snapshot -> 'caption' ->> 'text' from public.content_revisions where id = current_setting('t.rev1')::uuid), 'Chegou o outono', 'editing the working copy does not change the revision');
select is((select count(*)::int from public.content_revision_media where revision_id = current_setting('t.rev1')::uuid), 2, 'nor the revision files');
reset role;

select throws_ok(format($$update public.content_revisions set snapshot = '{}' where id = '%s'$$, current_setting('t.rev1')), 'record_immutable', 'a revision cannot be updated');
select throws_ok(format($$delete from public.content_revision_media where revision_id = '%s'$$, current_setting('t.rev1')), 'record_immutable', 'revision files cannot be deleted');
select throws_ok(format($$update public.approval_requests set approver_user_id = '00000000-0000-0000-0000-0000000000d2' where id = '%s'$$, current_setting('t.req1')), 'record_immutable', 'the approver of a request cannot be rewritten');
select throws_ok($$insert into public.content_variants (brand_id, content_item_id, channel_id, format) values (current_setting('t.brandB')::uuid, current_setting('t.item')::uuid, current_setting('t.channelB')::uuid, 'text')$$, '23503', 'a variant cannot point to an item of another brand');
select throws_ok(format($$update public.content_variants set channel_id = '%s' where id = '%s'$$, current_setting('t.channelB'), current_setting('t.v1')), '23503', 'nor to a channel of another brand');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$select public.media_set_trashed(a.id, true) from public.media_versions v join public.media_assets a on a.id = v.asset_id where v.id = '%s'$$, current_setting('t.media1')), 'the owner trashes a used file');
select throws_ok(format($$select public.media_delete_permanently(a.id) from public.media_versions v join public.media_assets a on a.id = v.asset_id where v.id = '%s'$$, current_setting('t.media1')), 'media_in_use', 'a file used by a revision cannot be deleted permanently');
select lives_ok(format($$select public.media_set_trashed(a.id, false) from public.media_versions v join public.media_assets a on a.id = v.asset_id where v.id = '%s'$$, current_setting('t.media1')), 'and is restored');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.sub2', public.submit_for_approval(current_setting('t.v1')::uuid, '00000000-0000-0000-0000-0000000000d1', null, null, 5)::text, true);
select set_config('t.req2', current_setting('t.sub2')::jsonb ->> 'request_id', true);
select is((select status from public.approval_requests where id = current_setting('t.req1')::uuid), 'superseded', 'a new submission supersedes the pending request');
select is((select count(*)::int from public.approval_requests where variant_id = current_setting('t.v1')::uuid and status = 'pending'), 1, 'and only one request is pending');
select is((current_setting('t.sub2')::jsonb ->> 'revision_no')::int, 2, 'the second submission is revision 2');
select is((select snapshot -> 'caption' ->> 'text' from public.content_revisions where id = (current_setting('t.sub2')::jsonb ->> 'revision_id')::uuid), 'Texto novo', 'revision 2 carries the new text');
reset role;
select is((select count(*)::int from public.audit_events where action = 'approval.superseded'), 1, 'the supersession is audited');

select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'approval.superseded'), 1, 'the previous approver is told the version was replaced');
select is((select status from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and ref_id = current_setting('t.req1')::uuid and kind = 'approval.requested'), 'resolved', 'the old request notification is resolved');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.content_items), 0, 'an external user reads no content item');
select is((select count(*)::int from public.content_revisions), 0, 'nor revisions');
select is((select count(*)::int from public.approval_requests), 0, 'nor approval requests');
select is((select count(*)::int from public.comments), 0, 'nor comments');
select is((public.portal_list_brands() -> 0 ->> 'pending_count')::int, 1, 'the portal lists the brand with one pending request');
select is(jsonb_array_length(public.portal_list_brands()), 1, 'and only the linked brand');
select is(jsonb_array_length(public.portal_list_pending(current_setting('t.brand')::uuid)), 1, 'the pending list has the current request');
select throws_ok(format($$select public.portal_list_pending('%s')$$, current_setting('t.brandB')), 'not_found', 'another brand is not found');
select is((public.portal_get_approval(current_setting('t.req2')::uuid) ->> 'can_decide')::boolean, true, 'the designated approver can decide');
select is(jsonb_array_length(public.portal_get_approval(current_setting('t.req2')::uuid) -> 'media'), 2, 'the screen shows the revision files');
select ok(position('storage_key' in public.portal_get_approval(current_setting('t.req2')::uuid)::text) = 0, 'and exposes no storage key');
select ok(position('internal' in public.portal_get_approval(current_setting('t.req2')::uuid)::text) = 0, 'nor internal notes');
select is((public.portal_get_approval(current_setting('t.req1')::uuid) ->> 'is_current')::boolean, false, 'the old request is marked as not current');
select is((public.portal_get_approval(current_setting('t.req1')::uuid) ->> 'current_request_id'), current_setting('t.req2'), 'and points to the current one');
select is((public.portal_get_approval(current_setting('t.req1')::uuid) ->> 'can_decide')::boolean, false, 'a superseded request cannot be decided');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req1')), 'revision_superseded', 'deciding a superseded revision is refused');
select throws_ok(format($$select public.portal_decide_approval('%s', 'changes_requested', 'ok')$$, current_setting('t.req2')), 'comment_required', 'requesting changes needs a real comment');
select throws_ok(format($$select public.portal_decide_approval('%s', 'maybe', null)$$, current_setting('t.req2')), 'invalid_input', 'an unknown outcome is refused');
select is((select count(*)::int from public.media_assets), 0, 'an external user reads no media');
select lives_ok(format($$select public.portal_record_view('%s')$$, current_setting('t.req2')), 'opening the request records the view');
reset role;

select isnt((select viewed_at from public.approval_requests where id = current_setting('t.req2')::uuid), null, 'the first view is recorded for the approver');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'not_designated_approver', 'another member cannot decide');
select is((public.portal_get_approval(current_setting('t.req2')::uuid) ->> 'can_decide')::boolean, false, 'and does not get the decision controls');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d3');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'denied', 'a commenter cannot decide');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.portal_get_approval('%s')$$, current_setting('t.req2')), 'not_found', 'an approver of brand B cannot read a request of brand A');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'not_found', 'nor decide it');
select throws_ok(format($$select public.portal_media_urls('%s', array['%s']::uuid[])$$, current_setting('t.rev1'), current_setting('t.media1')), 'not_found', 'nor sign its files');
select throws_ok(format($$select public.portal_list_comments('%s')$$, current_setting('t.v1')), 'not_found', 'nor list its comments');
select throws_ok(format($$select public.portal_add_comment('%s', 'oi')$$, current_setting('t.v1')), 'not_found', 'nor comment on it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'denied', 'an internal manager cannot decide through the portal');
select throws_ok($$select public.portal_list_brands()$$, 'denied', 'nor open the portal functions');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is(jsonb_array_length(public.portal_media_urls(current_setting('t.rev1')::uuid, array[current_setting('t.media1')::uuid])), 1, 'the approver gets the file keys of a revision shared with them');
select throws_ok(format($$select public.portal_media_urls('%s', array['%s']::uuid[])$$, current_setting('t.rev1'), current_setting('t.mediaB')), 'denied', 'but not a file outside that revision');
select lives_ok(format($$select public.portal_decide_approval('%s', 'changes_requested', 'Troque a foto da capa')$$, current_setting('t.req2')), 'the approver requests changes');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'request_not_pending', 'a decision is recorded only once');
reset role;

select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'changes_requested', 'the variant shows the request for changes');
select is((select count(*)::int from public.approval_decisions where request_id = current_setting('t.req2')::uuid), 1, 'the decision is stored');
select throws_ok(format($$update public.approval_decisions set comment = 'x' where request_id = '%s'$$, current_setting('t.req2')), 'record_immutable', 'a decision cannot be changed');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'approval.decided'), 1, 'the sender is notified of the decision');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.content_variant_move('%s', 'in_production', (select version from public.content_variants where id = '%s'))$$, current_setting('t.v1'), current_setting('t.v1')), 'the team resumes production');
select set_config('t.sub3', public.submit_for_approval(current_setting('t.v1')::uuid, '00000000-0000-0000-0000-0000000000d1', null, null, (select version from public.content_variants where id = current_setting('t.v1')::uuid))::text, true);
select set_config('t.req3', current_setting('t.sub3')::jsonb ->> 'request_id', true);
select is((current_setting('t.sub3')::jsonb ->> 'revision_no')::int, 3, 'a new revision is sent after the change request');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req3')), 'the approver approves');
select is(jsonb_array_length(public.portal_get_approval(current_setting('t.req3')::uuid) -> 'history'), 2, 'the history lists the earlier requests');
reset role;

select is((select approved_revision_id::text from public.content_variants where id = current_setting('t.v1')::uuid), current_setting('t.sub3')::jsonb ->> 'revision_id', 'the approved revision is the exact one sent');
select is((select editorial_status from public.content_variants where id = current_setting('t.v1')::uuid), 'approved', 'the variant is approved');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.content_variant_save('{"id":"%s","content_item_id":"%s","channel_id":"%s","format":"carousel","caption":{"text":"Mudei"}}'::jsonb, (select version from public.content_variants where id = '%s'))$$, current_setting('t.v1'), current_setting('t.item'), current_setting('t.channel'), current_setting('t.v1')), 'requires_new_revision', 'editing an approved variant needs a new revision');
select throws_ok(format($$select public.mark_published('%s', now(), null, null, null)$$, current_setting('t.empty')), 'not_approved', 'only an approved variant can be recorded as published');
select throws_ok(format($$select public.mark_published('%s', now() + interval '2 days', null, null, null)$$, current_setting('t.v1')), 'invalid_input', 'a publication in the future is refused');
select throws_ok(format($$select public.mark_published('%s', now(), 'http://x.test/p', null, null)$$, current_setting('t.v1')), 'invalid_input', 'a publication link must be https');
select lives_ok(format($$select public.mark_published('%s', now() - interval '1 hour', 'https://instagram.com/p/abc', '%s', 'Publicado pelo cliente')$$, current_setting('t.v1'), current_setting('t.media2')), 'the approved variant is recorded as published manually');
select is((select publication_status from public.content_variants where id = current_setting('t.v1')::uuid), 'published_manually', 'the publication status changes');
select throws_ok(format($$select public.mark_published('%s', now(), null, null, null)$$, current_setting('t.v1')), 'transition_not_allowed', 'it cannot be recorded twice');
select throws_ok(format($$select public.reopen_variant('%s', 'x')$$, current_setting('t.v1')), 'reason_required', 'reopening needs a reason');
select throws_ok(format($$select public.reopen_variant('%s', 'Cliente mudou de ideia')$$, current_setting('t.v1')), 'transition_not_allowed', 'a published variant cannot be reopened');
reset role;
select is((select count(*)::int from public.audit_events where action = 'variant.published_manually'), 1, 'the manual publication is audited');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.item2', public.content_item_save(format('{"brand_id":"%s","title":"Segundo item"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.v2', public.content_variant_save(format('{"content_item_id":"%s","channel_id":"%s","format":"text","caption":{"text":"Texto pronto"}}', current_setting('t.item2'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select public.content_variant_move(current_setting('t.v2')::uuid, 'in_production', 1);
select set_config('t.sub4', public.submit_for_approval(current_setting('t.v2')::uuid, '00000000-0000-0000-0000-0000000000d1', null, null, 2)::text, true);
select set_config('t.req4', current_setting('t.sub4')::jsonb ->> 'request_id', true);
select throws_ok(format($$select public.reassign_approver('%s', '00000000-0000-0000-0000-0000000000d2')$$, current_setting('t.req4')), 'approver_without_access', 'a request cannot be reassigned to someone who cannot decide');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', true, 'active');
select set_config('t.reassigned', public.reassign_approver(current_setting('t.req4')::uuid, '00000000-0000-0000-0000-0000000000d2')::text, true);
select is((select status from public.approval_requests where id = current_setting('t.req4')::uuid), 'superseded', 'reassigning supersedes the old request');
select is((select approver_user_id::text from public.approval_requests where id = (current_setting('t.reassigned')::jsonb ->> 'request_id')::uuid), '00000000-0000-0000-0000-0000000000d2', 'and creates one for the new approver on the same revision');
select lives_ok(format($$select public.send_approval_reminder('%s')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'a reminder is sent');
select lives_ok(format($$select public.send_approval_reminder('%s')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'a second reminder in the same hour is accepted');
reset role;

select is((select count(*)::int from public.audit_events where action = 'approval.approver_reassigned'), 1, 'the reassignment is audited');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d2' and kind = 'approval.requested'), 2, 'reminders in the same hour are not duplicated');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.cancel_request('%s', '')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'reason_required', 'cancelling a request needs a reason');
select lives_ok(format($$select public.cancel_request('%s', 'Mudança de plano')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'a pending request is cancelled');
select is((select editorial_status from public.content_variants where id = current_setting('t.v2')::uuid), 'in_production', 'and the variant returns to production');
select throws_ok(format($$select public.cancel_request('%s', 'De novo')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'request_not_pending', 'a cancelled request cannot be cancelled again');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.sub5', public.submit_for_approval(current_setting('t.v2')::uuid, '00000000-0000-0000-0000-0000000000d1', null, null, (select version from public.content_variants where id = current_setting('t.v2')::uuid))::text, true);
select set_config('t.req5', current_setting('t.sub5')::jsonb ->> 'request_id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req5')), 'approver_without_access', 'revoking can_decide blocks the decision immediately');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'revoked');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_get_approval('%s')$$, current_setting('t.req5')), 'not_found', 'a revoked link blocks the next read');
select is(jsonb_array_length(public.portal_list_brands()), 0, 'and removes the brand from the portal');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.comment_add('%s', 'internal', 'Lembrar do tom mais leve')$$, current_setting('t.v1')), 'the team writes an internal comment');
select throws_ok(format($$select public.comment_add('%s', 'external', 'Olá')$$, current_setting('t.v1')), 'denied', 'a manager without comments.create_external cannot write an external comment');
select is(jsonb_array_length(public.comment_list(current_setting('t.v1')::uuid)), 1, 'the team lists the comments');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select is(jsonb_array_length(public.portal_list_comments(current_setting('t.v1')::uuid)), 0, 'the portal does not list internal comments');
select set_config('t.comment', public.portal_add_comment(current_setting('t.v1')::uuid, 'Adorei a ideia') ->> 'id', true);
select is(jsonb_array_length(public.portal_list_comments(current_setting('t.v1')::uuid)), 1, 'the portal lists the external comment');
select throws_ok(format($$select public.comment_add('%s', 'internal', 'x')$$, current_setting('t.v1')), 'denied', 'an external user cannot write internal comments');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(jsonb_array_length(public.comment_list(current_setting('t.v1')::uuid)), 2, 'the team sees the external comment next to the internal one');
select throws_ok(format($$select public.comment_delete('%s')$$, current_setting('t.comment')), 'denied', 'only the author can delete a comment');
reset role;

select is((select count(*)::int from public.notifications where kind = 'comment.created'), 1, 'an external comment notifies the team');

select throws_ok(format($$update public.comments set body = 'editado' where id = '%s'$$, current_setting('t.comment')), 'record_immutable', 'a comment body cannot be edited');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select lives_ok(format($$select public.portal_media_urls(%L, array[%L]::uuid[])$$, current_setting('t.rev1'), current_setting('t.media2')), 'another member of the brand also reads the shared revision files');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.content_variant_cancel('%s', '')$$, current_setting('t.v2')), 'reason_required', 'cancelling a variant needs a reason');
select lives_ok(format($$select public.content_variant_cancel('%s', 'Campanha encerrada')$$, current_setting('t.v2')), 'a variant is cancelled');
select is((select status from public.approval_requests where id = current_setting('t.req5')::uuid), 'cancelled', 'its pending request is cancelled');
select throws_ok(format($$select public.content_variant_save('{"id":"%s","content_item_id":"%s","channel_id":"%s","format":"text"}'::jsonb, 99)$$, current_setting('t.v2'), current_setting('t.item2'), current_setting('t.channel')), 'conflict', 'a cancelled variant refuses stale edits');
select lives_ok(format($$select public.content_item_cancel('%s', 'Item encerrado')$$, current_setting('t.item2')), 'an item is cancelled');
select throws_ok(format($$select public.content_variant_save('{"content_item_id":"%s","channel_id":"%s","format":"text"}'::jsonb)$$, current_setting('t.item2'), current_setting('t.channel')), 'transition_not_allowed', 'a cancelled item takes no new variants');
select throws_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item')), 'denied', 'a manager has no content.delete');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item')), 'content_has_history', 'an item with revisions cannot be deleted');
select set_config('t.item3', public.content_item_save(format('{"brand_id":"%s","title":"Rascunho solto"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select lives_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item3')), 'an empty item can be deleted');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.content_items), 0, 'a manager of another brand reads no item');
select is((select count(*)::int from public.content_variants), 0, 'nor variant');
select is((select count(*)::int from public.approval_requests), 0, 'nor request');
select throws_ok(format($$select public.content_variant_move('%s', 'internal_review', 1)$$, current_setting('t.v1')), 'not_found', 'nor move a variant by id');
select throws_ok(format($$select public.comment_list('%s')$$, current_setting('t.v1')), 'not_found', 'nor list its comments');
reset role;

set local role anon;
select throws_ok($$select * from public.content_items$$, 'permission denied for table content_items', 'anon cannot read items');
select throws_ok($$select public.portal_list_brands()$$, 'permission denied for function portal_list_brands', 'anon cannot call the portal');
select throws_ok($$select public.submit_for_approval(gen_random_uuid(), gen_random_uuid(), null, null, 1)$$, 'permission denied for function submit_for_approval', 'anon cannot submit');
reset role;

select * from finish();
rollback;

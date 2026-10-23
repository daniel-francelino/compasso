begin;

select plan(180);

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

create function pg_temp.ver(p_item uuid) returns int language sql as $$
  select version from public.content_items where id = p_item
$$;

create function pg_temp.save(p_item uuid, p_extra text) returns jsonb language plpgsql as $$
declare
  v_brand uuid := current_setting('t.brand')::uuid;
begin
  return public.content_item_save(
    format('{"id":"%s","brand_id":"%s","expected_version":%s,%s}', p_item, v_brand, pg_temp.ver(p_item), p_extra)::jsonb
  );
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

insert into public.organization_settings (key, value)
values ('policies.approvals', '{"deadlineDays":3,"requirePlanApproval":false}')
on conflict (key) do update set value = excluded.value;

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
select is((select array_agg(t order by t collate "C") from public.content_items i, unnest(i.tags) t where i.id = current_setting('t.item')::uuid), array['Campanha', 'Outono', 'outono'], 'tags are trimmed and deduplicated');
select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'draft', 'a content starts as a draft');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"x"}'::jsonb)$$, current_setting('t.brand')), 'invalid_input', 'a title below two characters is refused');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Com responsavel","assignee_id":"00000000-0000-0000-0000-0000000000b2"}'::jsonb)$$, current_setting('t.brand')), 'invalid_input', 'an assignee who is not linked to the brand is refused');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Objetivo estranho","objective_kind":"fame"}'::jsonb)$$, current_setting('t.brand')), 'invalid_input', 'an objective outside the closed list is refused');
select throws_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Outra marca"}'::jsonb)$$, current_setting('t.brandB')), 'not_found', 'a content cannot be created on a brand the person is not linked to');
select is((pg_temp.save(current_setting('t.item')::uuid, '"title":"Lançamento de outono","objective":"Vender","objective_kind":"sales"') ->> 'version')::int, 2, 'editing a content increments its version');
select throws_ok(format($$select public.content_item_save('{"id":"%s","brand_id":"%s","title":"Outro titulo","expected_version":1}'::jsonb)$$, current_setting('t.item'), current_setting('t.brand')), 'conflict', 'a stale content version conflicts');
select lives_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","briefing_audience":"  Clientes do bairro  ","briefing_key_message":"Chocolate quente"')$$, current_setting('t.item')), 'the guided briefing fields are saved');
select is((select briefing_audience from public.content_items where id = current_setting('t.item')::uuid), 'Clientes do bairro', 'a guided briefing field is trimmed');
select is((select briefing_constraints from public.content_items where id = current_setting('t.item')::uuid), null, 'a guided briefing field left out is stored as null');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","briefing_constraints":"%s"')$$, current_setting('t.item'), repeat('a', 2001)), 'invalid_input', 'a guided briefing field above 2000 characters is refused');

select set_config('t.saved', pg_temp.save(current_setting('t.item')::uuid, format('"title":"Lançamento de outono","caption":{"text":"Chegou o outono"},"working_media":[{"media_version_id":"%s","alt_text":"Xicara"},{"media_version_id":"%s"}],"channels":[{"channel_id":"%s","format":"carousel"}]', current_setting('t.media1'), current_setting('t.media2'), current_setting('t.channel')))::text, true);
select set_config('t.row1', current_setting('t.saved')::jsonb -> 'channels' -> 0 ->> 'id', true);
select is((select publication_status from public.content_channels where id = current_setting('t.row1')::uuid), 'unplanned', 'a channel row starts unplanned');
select is((select count(*)::int from public.content_channels where content_item_id = current_setting('t.item')::uuid), 1, 'the content has one channel row');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","channels":[{"channel_id":"%s","format":"image"}]')$$, current_setting('t.item'), current_setting('t.channelB')), 'channel_brand_mismatch', 'a channel of another brand is refused');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","channels":[{"channel_id":"%s","format":"poster"}]')$$, current_setting('t.item'), current_setting('t.channel')), 'invalid_input', 'an unknown format is refused');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","working_media":[{"media_version_id":"%s"}]')$$, current_setting('t.item'), current_setting('t.mediaB')), 'media_not_available', 'a file of another brand cannot be attached');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","working_media":[{"media_version_id":"%s"}]')$$, current_setting('t.item'), current_setting('t.mediaPending')), 'media_not_available', 'a file that is not available cannot be attached');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","working_media":[{"media_version_id":"%s"},{"media_version_id":"%s"}]')$$, current_setting('t.item'), current_setting('t.media1'), current_setting('t.media1')), 'invalid_input', 'the same file twice is refused');
select public.channel_set_archived(current_setting('t.channel2')::uuid, true);
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","channels":[{"channel_id":"%s","format":"text"}]')$$, current_setting('t.item'), current_setting('t.channel2')), 'channel_archived', 'an archived channel is refused');
select public.channel_set_archived(current_setting('t.channel2')::uuid, false);
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","channels":[%s]')$$, current_setting('t.item'), (select string_agg(format('{"channel_id":"%s","format":"text"}', current_setting('t.channel')), ',') from generate_series(1, 21))), 'invalid_input', 'more than 20 channel rows are refused');

select throws_ok(format($$select public.content_move('%s', 'awaiting_approval', pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'transition_not_allowed', 'the board cannot jump to awaiting approval');
select throws_ok(format($$select public.content_move('%s', 'approved', pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'transition_not_allowed', 'nor to approved');
select lives_ok(format($$select public.content_move('%s', 'in_production', pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'a draft moves to production');
select lives_ok(format($$select public.content_move('%s', 'internal_review', pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'production moves to internal review');
select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'internal_review', 'the content is in internal review');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select public.submit_for_approval('%s', null, null, pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'denied', 'a collaborator cannot send for approval');
select lives_ok(format($$select public.content_item_save('{"brand_id":"%s","title":"Item do colaborador"}'::jsonb)$$, current_setting('t.brand')), 'a collaborator creates contents');
select throws_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item')), 'denied', 'a collaborator cannot delete contents');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(jsonb_array_length(public.approver_options(current_setting('t.brand')::uuid) -> 'approvers'), 1, 'only the member who can decide is offered as approver');
select is((public.approver_options(current_setting('t.brand')::uuid) ->> 'default_deadline_days')::int, 3, 'the default deadline comes from the approvals policy');
select throws_ok(format($$select public.approver_options('%s')$$, current_setting('t.brandB')), 'not_found', 'approvers of another brand are not listed');
select throws_ok(format($$select public.submit_for_approval('%s', null, null, 1)$$, current_setting('t.item')), 'conflict', 'a stale version conflicts on submission');
select throws_ok(format($$select public.submit_for_approval('%s', current_date - 3, null, pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'invalid_input', 'an approval deadline in the past is refused');

select set_config('t.empty', public.content_item_save(format('{"brand_id":"%s","title":"Sem texto","channels":[{"channel_id":"%s","format":"text"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select set_config('t.emptyRow', (select id::text from public.content_channels where content_item_id = current_setting('t.empty')::uuid), true);
select public.content_move(current_setting('t.empty')::uuid, 'in_production', pg_temp.ver(current_setting('t.empty')::uuid));
select throws_ok(format($$select public.submit_for_approval('%s', null, null, pg_temp.ver('%s'))$$, current_setting('t.empty'), current_setting('t.empty')), 'invalid_input', 'a content with no text and no files cannot be sent');
select set_config('t.draft', public.content_item_save(format('{"brand_id":"%s","title":"Rascunho","caption":{"text":"Rascunho"},"channels":[{"channel_id":"%s","format":"text"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select throws_ok(format($$select public.submit_for_approval('%s', null, null, pg_temp.ver('%s'))$$, current_setting('t.draft'), current_setting('t.draft')), 'transition_not_allowed', 'a draft cannot be sent');
select set_config('t.nochannel', public.content_item_save(format('{"brand_id":"%s","title":"Sem canal","caption":{"text":"Texto"}}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select public.content_move(current_setting('t.nochannel')::uuid, 'in_production', pg_temp.ver(current_setting('t.nochannel')::uuid));
select throws_ok(format($$select public.submit_for_approval('%s', null, null, pg_temp.ver('%s'))$$, current_setting('t.nochannel'), current_setting('t.nochannel')), 'channel_required', 'a content with no channel cannot be sent');

select pg_temp.save(current_setting('t.item')::uuid, format('"title":"Lançamento de outono","caption":{"text":"Chegou o outono"},"working_media":[{"media_version_id":"%s","alt_text":"Xicara"},{"media_version_id":"%s"}],"channels":[{"id":"%s","channel_id":"%s","format":"carousel"},{"channel_id":"%s","format":"text","caption":"Versão para o LinkedIn"}]', current_setting('t.media1'), current_setting('t.media2'), current_setting('t.row1'), current_setting('t.channel'), current_setting('t.channel2')));
select is((select count(*)::int from public.content_channels where content_item_id = current_setting('t.item')::uuid), 2, 'a second channel row is added to the same content');
select set_config('t.sub1', public.submit_for_approval(current_setting('t.item')::uuid, current_date + 3, 'Pode olhar?', pg_temp.ver(current_setting('t.item')::uuid))::text, true);
select set_config('t.req1', current_setting('t.sub1')::jsonb ->> 'request_id', true);
select set_config('t.rev1', current_setting('t.sub1')::jsonb ->> 'revision_id', true);
select is((current_setting('t.sub1')::jsonb ->> 'revision_no')::int, 1, 'the first submission creates revision 1');
select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'awaiting_approval', 'the content waits for approval');
select is((select count(*)::int from public.content_revision_media where revision_id = current_setting('t.rev1')::uuid), 2, 'the revision freezes the files in order');
select is((select snapshot ->> 'title' from public.content_revisions where id = current_setting('t.rev1')::uuid), 'Lançamento de outono', 'the revision freezes the title');
select is((select jsonb_array_length(snapshot -> 'channels') from public.content_revisions where id = current_setting('t.rev1')::uuid), 2, 'the revision freezes every channel row');
select is((select snapshot -> 'channels' -> 1 -> 'caption' ->> 'text' from public.content_revisions where id = current_setting('t.rev1')::uuid), 'Versão para o LinkedIn', 'with its caption adjustment');
select is((select count(*)::int from public.media_usages where usage_type = 'content_revision' and usage_ref_id = current_setting('t.rev1')::uuid), 2, 'the files are marked as used by the revision');
reset role;
select is((select count(*)::int from public.audit_events where action = 'content.submitted' and entity_id = current_setting('t.item')::uuid), 1, 'the submission is audited');
select is((select count(*)::int from public.audit_events where action = 'content_channel.added' and entity_id = current_setting('t.row1')::uuid), 1, 'adding a channel row is audited');
select is((select count(*)::int from public.audit_events where action = 'approval.requested'), 1, 'the request is audited');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'approval.requested'), 1, 'the approver receives the notification in the same transaction');
select ok((select body like '%aurora.cafe%Aurora%' from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'approval.requested'), 'the notification names every channel');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","caption":{"text":"Texto novo"},"working_media":[{"media_version_id":"%s"},{"media_version_id":"%s"}],"channels":[{"id":"%s","channel_id":"%s","format":"carousel"}]')$$, current_setting('t.item'), current_setting('t.media1'), current_setting('t.media2'), current_setting('t.row1'), current_setting('t.channel')), 'the working copy of a pending content can be edited, even removing a channel row');
select is((select snapshot -> 'caption' ->> 'text' from public.content_revisions where id = current_setting('t.rev1')::uuid), 'Chegou o outono', 'editing the working copy does not change the revision');
select is((select jsonb_array_length(snapshot -> 'channels') from public.content_revisions where id = current_setting('t.rev1')::uuid), 2, 'nor the channels of the revision');
select is((select count(*)::int from public.content_revision_media where revision_id = current_setting('t.rev1')::uuid), 2, 'nor the revision files');
reset role;
select is((select count(*)::int from public.audit_events where action = 'content_channel.removed'), 1, 'removing a channel row is audited');

select throws_ok(format($$update public.content_revisions set snapshot = '{}' where id = '%s'$$, current_setting('t.rev1')), 'record_immutable', 'a revision cannot be updated');
select throws_ok(format($$delete from public.content_revision_media where revision_id = '%s'$$, current_setting('t.rev1')), 'record_immutable', 'revision files cannot be deleted');
select throws_ok(format($$update public.approval_requests set stage = 'plan' where id = '%s'$$, current_setting('t.req1')), 'record_immutable', 'the approver of a request cannot be rewritten');
select throws_ok($$insert into public.content_channels (brand_id, content_item_id, channel_id, format) values (current_setting('t.brandB')::uuid, current_setting('t.item')::uuid, current_setting('t.channelB')::uuid, 'text')$$, '23503', null, 'a channel row cannot point to a content of another brand');
select throws_ok(format($$update public.content_channels set channel_id = '%s' where id = '%s'$$, current_setting('t.channelB'), current_setting('t.row1')), '23503', null, 'nor to a channel of another brand');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$select public.media_set_trashed(a.id, true) from public.media_versions v join public.media_assets a on a.id = v.asset_id where v.id = '%s'$$, current_setting('t.media1')), 'the owner trashes a used file');
select throws_ok(format($$select public.media_delete_permanently(a.id) from public.media_versions v join public.media_assets a on a.id = v.asset_id where v.id = '%s'$$, current_setting('t.media1')), 'media_in_use', 'a file used by a revision cannot be deleted permanently');
select lives_ok(format($$select public.media_set_trashed(a.id, false) from public.media_versions v join public.media_assets a on a.id = v.asset_id where v.id = '%s'$$, current_setting('t.media1')), 'and is restored');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.sub2', public.submit_for_approval(current_setting('t.item')::uuid, null, null, pg_temp.ver(current_setting('t.item')::uuid))::text, true);
select set_config('t.req2', current_setting('t.sub2')::jsonb ->> 'request_id', true);
select is((select status from public.approval_requests where id = current_setting('t.req1')::uuid), 'superseded', 'a new submission supersedes the pending request');
select is((select count(*)::int from public.approval_requests where item_id = current_setting('t.item')::uuid and status = 'pending'), 1, 'and only one request is pending');
select is((current_setting('t.sub2')::jsonb ->> 'revision_no')::int, 2, 'the second submission is revision 2');
select is((select snapshot -> 'caption' ->> 'text' from public.content_revisions where id = (current_setting('t.sub2')::jsonb ->> 'revision_id')::uuid), 'Texto novo', 'revision 2 carries the new text');
select is((select jsonb_array_length(snapshot -> 'channels') from public.content_revisions where id = (current_setting('t.sub2')::jsonb ->> 'revision_id')::uuid), 1, 'and the remaining channel only');
reset role;
select is((select count(*)::int from public.audit_events where action = 'approval.superseded'), 1, 'the supersession is audited');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'approval.superseded'), 1, 'the previous approver is told the version was replaced');
select is((select status from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and ref_id = current_setting('t.req1')::uuid and kind = 'approval.requested'), 'resolved', 'the old request notification is resolved');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.content_items), 0, 'an external user reads no content');
select is((select count(*)::int from public.content_channels), 0, 'nor channel rows');
select is((select count(*)::int from public.content_revisions), 0, 'nor revisions');
select is((select count(*)::int from public.approval_requests), 0, 'nor approval requests');
select is((select count(*)::int from public.comments), 0, 'nor comments');
select is((public.portal_list_brands() -> 0 ->> 'pending_count')::int, 1, 'the portal lists the brand with one pending request');
select is(jsonb_array_length(public.portal_list_brands()), 1, 'and only the linked brand');
select is(jsonb_array_length(public.portal_list_pending(current_setting('t.brand')::uuid)), 1, 'the pending list has the current request');
select is(jsonb_array_length(public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 -> 'channels'), 1, 'and the channels of the content');
select is((public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'revision_id')::uuid, (current_setting('t.sub2')::jsonb ->> 'revision_id')::uuid, 'the list identifies the exact shared revision');
select is(jsonb_array_length(public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 -> 'media'), 2, 'the list includes safe preview media metadata');
select is((public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'can_decide')::boolean, true, 'the designated approver can decide from the list');
select ok(position('storage_key' in public.portal_list_pending(current_setting('t.brand')::uuid)::text) = 0, 'the preview list exposes no storage keys');
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
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'denied', 'another member cannot decide');
select is((public.portal_get_approval(current_setting('t.req2')::uuid) ->> 'can_decide')::boolean, false, 'and does not get the decision controls');
select is((public.portal_list_pending(current_setting('t.brand')::uuid) -> 0 ->> 'can_decide')::boolean, false, 'the list also hides decisions from another member');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d3');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'denied', 'a commenter cannot decide');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.portal_get_approval('%s')$$, current_setting('t.req2')), 'not_found', 'an approver of brand B cannot read a request of brand A');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req2')), 'not_found', 'nor decide it');
select throws_ok(format($$select public.portal_media_urls('%s', array['%s']::uuid[])$$, current_setting('t.rev1'), current_setting('t.media1')), 'not_found', 'nor sign its files');
select throws_ok(format($$select public.portal_list_comments('%s')$$, current_setting('t.item')), 'not_found', 'nor list its comments');
select throws_ok(format($$select public.portal_add_comment('%s', 'oi')$$, current_setting('t.item')), 'not_found', 'nor comment on it');
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

select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'changes_requested', 'the content shows the request for changes');
select is((select count(*)::int from public.approval_decisions where request_id = current_setting('t.req2')::uuid), 1, 'the decision is stored');
select throws_ok(format($$update public.approval_decisions set comment = 'x' where request_id = '%s'$$, current_setting('t.req2')), 'record_immutable', 'a decision cannot be changed');
select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'approval.decided'), 1, 'the sender is notified of the decision');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.content_move('%s', 'in_production', pg_temp.ver('%s'))$$, current_setting('t.item'), current_setting('t.item')), 'the team resumes production');
select set_config('t.sub3', public.submit_for_approval(current_setting('t.item')::uuid, null, null, pg_temp.ver(current_setting('t.item')::uuid))::text, true);
select set_config('t.req3', current_setting('t.sub3')::jsonb ->> 'request_id', true);
select is((current_setting('t.sub3')::jsonb ->> 'revision_no')::int, 3, 'a new revision is sent after the change request');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select lives_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req3')), 'the approver approves');
select is(jsonb_array_length(public.portal_get_approval(current_setting('t.req3')::uuid) -> 'history'), 2, 'the history lists the earlier requests');
reset role;

select is((select approved_revision_id::text from public.content_items where id = current_setting('t.item')::uuid), current_setting('t.sub3')::jsonb ->> 'revision_id', 'the approved revision is the exact one sent');
select is((select editorial_status from public.content_items where id = current_setting('t.item')::uuid), 'approved', 'the content is approved');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Lançamento de outono","caption":{"text":"Mudei"},"channels":[{"id":"%s","channel_id":"%s","format":"carousel"}]')$$, current_setting('t.item'), current_setting('t.row1'), current_setting('t.channel')), 'requires_new_revision', 'editing the text of an approved content needs a new revision');
select throws_ok(format($$select pg_temp.save('%s', format('"title":"Lançamento de outono","caption":{"text":"Texto novo"},"working_media":[{"media_version_id":"%%s"},{"media_version_id":"%%s"}],"channels":[{"id":"%%s","channel_id":"%%s","format":"carousel"},{"channel_id":"%%s","format":"text"}]', '%s', '%s', '%s', '%s', '%s'))$$, current_setting('t.item'), current_setting('t.media1'), current_setting('t.media2'), current_setting('t.row1'), current_setting('t.channel'), current_setting('t.channel2')), 'requires_new_revision', 'adding a channel to an approved content needs a new revision');
select lives_ok(format($$select pg_temp.save('%s', format('"title":"Novo titulo interno","caption":{"text":"Texto novo"},"working_media":[{"media_version_id":"%%s"},{"media_version_id":"%%s"}],"channels":[{"id":"%%s","channel_id":"%%s","format":"carousel"}]', '%s', '%s', '%s', '%s'))$$, current_setting('t.item'), current_setting('t.media1'), current_setting('t.media2'), current_setting('t.row1'), current_setting('t.channel')), 'the internal title of an approved content can change without a new revision');
select throws_ok(format($$select public.mark_published('%s', now(), null, null, null)$$, current_setting('t.emptyRow')), 'not_approved', 'only an approved content can be recorded as published');
select throws_ok(format($$select public.mark_published('%s', now() + interval '2 days', null, null, null)$$, current_setting('t.row1')), 'invalid_input', 'a publication in the future is refused');
select throws_ok(format($$select public.mark_published('%s', now(), 'http://x.test/p', null, null)$$, current_setting('t.row1')), 'invalid_input', 'a publication link must be https');
select lives_ok(format($$select public.mark_published('%s', now() - interval '1 hour', 'https://instagram.com/p/abc', '%s', 'Publicado pelo cliente')$$, current_setting('t.row1'), current_setting('t.media2')), 'the approved channel row is recorded as published manually');
select is((select publication_status from public.content_channels where id = current_setting('t.row1')::uuid), 'published_manually', 'the publication status changes');
select throws_ok(format($$select public.mark_published('%s', now(), null, null, null)$$, current_setting('t.row1')), 'transition_not_allowed', 'it cannot be recorded twice');
select throws_ok(format($$select public.reopen_content('%s', 'x')$$, current_setting('t.item')), 'reason_required', 'reopening needs a reason');
select throws_ok(format($$select public.reopen_content('%s', 'Cliente mudou de ideia')$$, current_setting('t.item')), 'transition_not_allowed', 'a content with a published channel cannot be reopened');
select throws_ok(format($$select pg_temp.save('%s', '"title":"Novo titulo interno","caption":{"text":"Texto novo"},"channels":[]')$$, current_setting('t.item')), 'requires_new_revision', 'removing every channel of an approved content needs a new revision');
reset role;
select is((select count(*)::int from public.audit_events where action = 'content_channel.published_manually'), 1, 'the manual publication is audited');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.item2', public.content_item_save(format('{"brand_id":"%s","title":"Segundo conteudo","caption":{"text":"Texto pronto"},"channels":[{"channel_id":"%s","format":"text"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select public.content_move(current_setting('t.item2')::uuid, 'in_production', pg_temp.ver(current_setting('t.item2')::uuid));
select set_config('t.sub4', public.submit_for_approval(current_setting('t.item2')::uuid, null, null, pg_temp.ver(current_setting('t.item2')::uuid))::text, true);
select set_config('t.req4', current_setting('t.sub4')::jsonb ->> 'request_id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d2', 'external', true, 'active');
select set_config('t.reassigned', jsonb_build_object('request_id', current_setting('t.req4'))::text, true);
select lives_ok(format($$select public.send_approval_reminder('%s')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'a reminder is sent');
select lives_ok(format($$select public.send_approval_reminder('%s')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'a second reminder in the same hour is accepted');
reset role;

select is((select count(*)::int from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d2' and kind = 'approval.requested'), 1, 'reminders in the same hour are not duplicated');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.cancel_request('%s', '')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'reason_required', 'cancelling a request needs a reason');
select lives_ok(format($$select public.cancel_request('%s', 'Mudança de plano')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'a pending request is cancelled');
select is((select editorial_status from public.content_items where id = current_setting('t.item2')::uuid), 'in_production', 'and the content returns to production');
select throws_ok(format($$select public.cancel_request('%s', 'De novo')$$, current_setting('t.reassigned')::jsonb ->> 'request_id'), 'request_not_pending', 'a cancelled request cannot be cancelled again');
select set_config('t.sub5', public.submit_for_approval(current_setting('t.item2')::uuid, null, null, pg_temp.ver(current_setting('t.item2')::uuid))::text, true);
select set_config('t.req5', current_setting('t.sub5')::jsonb ->> 'request_id', true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_decide_approval('%s', 'approved', null)$$, current_setting('t.req5')), 'denied', 'revoking can_decide blocks the decision immediately');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'revoked');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($$select public.portal_get_approval('%s')$$, current_setting('t.req5')), 'not_found', 'a revoked link blocks the next read');
select is(jsonb_array_length(public.portal_list_brands()), 0, 'and removes the brand from the portal');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select lives_ok(format($$select public.comment_add('%s', 'internal', 'Lembrar do tom mais leve')$$, current_setting('t.item')), 'the team writes an internal comment');
select throws_ok(format($$select public.comment_add('%s', 'external', 'Olá')$$, current_setting('t.item')), 'denied', 'a manager without comments.create_external cannot write an external comment');
select is(jsonb_array_length(public.comment_list(current_setting('t.item')::uuid)), 1, 'the team lists the comments');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select is(jsonb_array_length(public.portal_list_comments(current_setting('t.item')::uuid)), 0, 'the portal does not list internal comments');
select set_config('t.comment', public.portal_add_comment(current_setting('t.item')::uuid, 'Adorei a ideia') ->> 'id', true);
select is(jsonb_array_length(public.portal_list_comments(current_setting('t.item')::uuid)), 1, 'the portal lists the external comment');
select throws_ok(format($$select public.comment_add('%s', 'internal', 'x')$$, current_setting('t.item')), 'denied', 'an external user cannot write internal comments');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(jsonb_array_length(public.comment_list(current_setting('t.item')::uuid)), 2, 'the team sees the external comment next to the internal one');
select throws_ok(format($$select public.comment_delete('%s')$$, current_setting('t.comment')), 'denied', 'only the author can delete a comment');
reset role;

select is((select count(*)::int from public.notifications where kind = 'comment.created'), 1, 'an external comment notifies the team');
select throws_ok(format($$update public.comments set created_at = created_at - interval '1 day' where id = '%s'$$, current_setting('t.comment')), 'record_immutable', 'a comment date cannot be changed');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select lives_ok(format($$select public.portal_media_urls(%L, array[%L]::uuid[])$$, current_setting('t.rev1'), current_setting('t.media2')), 'another member of the brand also reads the shared revision files');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.two', public.content_item_save(format('{"brand_id":"%s","title":"Dois canais","caption":{"text":"Texto"},"channels":[{"channel_id":"%s","format":"text"},{"channel_id":"%s","format":"text"}]}', current_setting('t.brand'), current_setting('t.channel'), current_setting('t.channel2'))::jsonb) ->> 'id', true);
select set_config('t.twoRow', (select id::text from public.content_channels where content_item_id = current_setting('t.two')::uuid order by position limit 1), true);
select set_config('t.twoRow2', (select id::text from public.content_channels where content_item_id = current_setting('t.two')::uuid order by position desc limit 1), true);
select throws_ok(format($$select public.content_channel_cancel('%s', '')$$, current_setting('t.twoRow')), 'reason_required', 'cancelling a channel row needs a reason');
select lives_ok(format($$select public.content_channel_cancel('%s', 'Rede descartada')$$, current_setting('t.twoRow')), 'one channel row of a content is cancelled');
select is((select publication_status from public.content_channels where id = current_setting('t.twoRow')::uuid), 'cancelled', 'it is marked as cancelled');
select throws_ok(format($$select public.content_channel_cancel('%s', 'Ultima rede')$$, current_setting('t.twoRow2')), 'transition_not_allowed', 'the last active channel row cannot be cancelled alone');
select throws_ok(format($$select public.content_item_cancel('%s', '')$$, current_setting('t.item2')), 'reason_required', 'cancelling a content needs a reason');
select lives_ok(format($$select public.content_item_cancel('%s', 'Campanha encerrada')$$, current_setting('t.item2')), 'a content is cancelled');
select is((select status from public.approval_requests where id = current_setting('t.req5')::uuid), 'cancelled', 'its pending request is cancelled');
select is((select publication_status from public.content_channels where content_item_id = current_setting('t.item2')::uuid), 'cancelled', 'and its channel rows');
select throws_ok(format($$select public.content_item_save('{"id":"%s","brand_id":"%s","title":"Mudei","expected_version":99}'::jsonb)$$, current_setting('t.item2'), current_setting('t.brand')), 'conflict', 'a cancelled content refuses stale edits');
select throws_ok(format($$select public.content_item_save('{"id":"%s","brand_id":"%s","title":"Mudei"}'::jsonb)$$, current_setting('t.item2'), current_setting('t.brand')), 'conflict', 'and edits without a version');
select throws_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item')), 'denied', 'a manager has no content.delete');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item')), 'content_has_history', 'a content with revisions cannot be deleted');
select set_config('t.item3', public.content_item_save(format('{"brand_id":"%s","title":"Rascunho solto","channels":[{"channel_id":"%s","format":"text"}]}', current_setting('t.brand'), current_setting('t.channel'))::jsonb) ->> 'id', true);
select lives_ok(format($$select public.content_item_delete('%s')$$, current_setting('t.item3')), 'an empty content can be deleted');
select is((select count(*)::int from public.content_channels where content_item_id = current_setting('t.item3')::uuid), 0, 'with its channel rows');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.content_items), 0, 'a manager of another brand reads no content');
select is((select count(*)::int from public.content_channels), 0, 'nor channel row');
select is((select count(*)::int from public.approval_requests), 0, 'nor request');
select throws_ok(format($$select public.content_move('%s', 'internal_review', 1)$$, current_setting('t.item')), 'not_found', 'nor move a content by id');
select throws_ok(format($$select public.comment_list('%s')$$, current_setting('t.item')), 'not_found', 'nor list its comments');
reset role;

set local role anon;
select throws_ok($$select * from public.content_items$$, 'permission denied for table content_items', 'anon cannot read contents');
select throws_ok($$select * from public.content_channels$$, 'permission denied for table content_channels', 'nor channel rows');
select throws_ok($$select public.portal_list_brands()$$, 'permission denied for function portal_list_brands', 'anon cannot call the portal');
select throws_ok($$select public.submit_for_approval(gen_random_uuid(), null, null, 1)$$, 'permission denied for function submit_for_approval', 'anon cannot submit');
reset role;

select * from finish();
rollback;

begin;

select plan(55);

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
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.client', public.client_save('{"name":"Cafe Aurora"}'::jsonb, true) ->> 'id', true);
select set_config('t.brand', (select id::text from public.brands limit 1), true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.up1', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'foto.jpg', 1000, 'image/jpeg', 'idem-key-0001')::text, true);
select set_config('t.asset1', (current_setting('t.up1')::jsonb ->> 'asset_id'), true);
select set_config('t.version1', (current_setting('t.up1')::jsonb ->> 'version_id'), true);
select is((current_setting('t.up1')::jsonb ->> 'kind'), 'image', 'an image upload is requested');
select ok((current_setting('t.up1')::jsonb ->> 'thumb_key') is not null and (current_setting('t.up1')::jsonb ->> 'display_key') is not null, 'an image gets thumb and display keys');
select is(
  public.media_request_upload('brand', current_setting('t.brand')::uuid, 'foto.jpg', 1000, 'image/jpeg', 'idem-key-0001') ->> 'version_id',
  current_setting('t.version1'),
  'repeating the same idempotency key returns the same upload'
);
select is((select count(*)::int from public.media_assets), 1, 'the repeated request created nothing new');
select is(
  public.media_request_upload('brand', current_setting('t.brand')::uuid, 'foto.jpg', 1000, 'image/jpeg', 'idem-key-0002') ->> 'kind',
  'image',
  'a second upload with the same name is accepted'
);
select is((select display_name from public.media_assets order by created_at desc, id limit 1) like 'foto (1).jpg' or (select count(*)::int from public.media_assets where display_name = 'foto (1).jpg') = 1, true, 'repeated names get a number');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'x.exe', 10, 'application/x-msdownload', 'idem-key-0003')$$, 'upload_type_not_allowed', 'a type outside the allowlist is refused');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'big.jpg', 99999999999, 'image/jpeg', 'idem-key-0004')$$, 'upload_too_large', 'a file above the limit is refused');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brandB')::uuid, 'b.jpg', 10, 'image/jpeg', 'idem-key-0005')$$, 'not_found', 'a brand the person is not linked to is refused');
select throws_ok($$select public.media_request_upload('site', null, 's.jpg', 10, 'image/jpeg', 'idem-key-0006')$$, 'denied', 'site scope needs site.view');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'a.jpg', 10, 'image/jpeg', 'short')$$, 'invalid_input', 'a weak idempotency key is refused');

select throws_ok(
  format($$select public.media_confirm_upload('%s', 'not-a-hash', 10, 10, null, 0)$$, current_setting('t.version1')),
  'upload_content_mismatch',
  'a malformed checksum is refused'
);
select throws_ok(
  format($$select public.media_confirm_upload('%s', '%s', 9000, 9000, null, 0)$$, current_setting('t.version1'), repeat('a', 64)),
  'upload_content_mismatch',
  'an image above the pixel limit is refused'
);
select lives_ok(
  format($$select public.media_confirm_upload('%s', '%s', 800, 600, null, 500)$$, current_setting('t.version1'), repeat('a', 64)),
  'the author confirms the upload'
);
select lives_ok(
  format($$select public.media_confirm_upload('%s', '%s', 800, 600, null, 500)$$, current_setting('t.version1'), repeat('a', 64)),
  'confirming twice is idempotent'
);
select is((select current_version_id::text from public.media_assets where id = current_setting('t.asset1')::uuid), current_setting('t.version1'), 'the confirmed version becomes the current one');
select is((select status from public.media_versions where id = current_setting('t.version1')::uuid), 'available', 'the version is available');
select ok(public.media_storage_used() >= 1500, 'the quota counts the original and its copies');
reset role;

select throws_ok(
  format($$update public.media_versions set storage_key = 'hacked' where id = '%s'$$, current_setting('t.version1')),
  'media_version_immutable',
  'a version binary cannot be re-pointed'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.media_assets), 0, 'an unlinked manager sees no asset of the other brand');
select is((select count(*)::int from public.media_versions), 0, 'nor its versions');
select throws_ok(format($$select public.media_update(jsonb_build_object('id', '%s', 'display_name', 'x', 'expected_version', 1))$$, current_setting('t.asset1')), 'not_found', 'nor edit it by id');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.media_assets), 0, 'an external user reads no asset');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'e.jpg', 10, 'image/jpeg', 'idem-key-0007')$$, 'denied', 'an external user cannot upload');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is(
  (public.media_update(format('{"id":"%s","display_name":"logo.jpg","tags":["Logo"," logo ","Marca"],"expected_version":2}', current_setting('t.asset1'))::jsonb) ->> 'version')::int,
  3,
  'editing metadata increments the version'
);
select is((select tags from public.media_assets where id = current_setting('t.asset1')::uuid), array['logo', 'marca'], 'tags are normalized and deduplicated');
select throws_ok(format($$select public.media_update(jsonb_build_object('id', '%s', 'display_name', 'x', 'expected_version', 1))$$, current_setting('t.asset1')), 'conflict', 'a stale version conflicts');
select throws_ok(format($$select public.media_set_trashed('%s', true)$$, current_setting('t.asset1')), 'denied', 'a manager has no media.delete');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.up2', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'logo.jpg', 2000, 'image/jpeg', 'idem-key-0008', current_setting('t.asset1')::uuid)::text, true);
select set_config('t.version2', (current_setting('t.up2')::jsonb ->> 'version_id'), true);
select is((select version_no from public.media_versions where id = current_setting('t.version2')::uuid), 2, 'a replacement creates version 2');
select throws_ok(format($$select public.media_replace_version('%s', '%s')$$, current_setting('t.asset1'), current_setting('t.version2')), 'conflict', 'a version that is not available yet cannot replace');
select public.media_confirm_upload(current_setting('t.version2')::uuid, repeat('b', 64), 100, 100, null, 0);
select is((select current_version_id::text from public.media_assets where id = current_setting('t.asset1')::uuid), current_setting('t.version1'), 'confirming a new version does not move the current one');
select lives_ok(format($$select public.media_replace_version('%s', '%s')$$, current_setting('t.asset1'), current_setting('t.version2')), 'the replacement is applied explicitly');
reset role;

select is((select count(*)::int from public.audit_events where action = 'media.version_replaced'), 1, 'the replacement is audited');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.up3', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'ruim.jpg', 500, 'image/jpeg', 'idem-key-0009')::text, true);
select set_config('t.version3', (current_setting('t.up3')::jsonb ->> 'version_id'), true);
select set_config('t.asset3', (current_setting('t.up3')::jsonb ->> 'asset_id'), true);
select is(
  jsonb_array_length(public.media_mark_failed(current_setting('t.version3')::uuid, 'fake content') -> 'keys'),
  3,
  'a failed upload returns the object keys to delete'
);
select is((select count(*)::int from public.media_assets where id = current_setting('t.asset3')::uuid), 0, 'an asset with only a failed version is removed');
select is((select count(*)::int from public.notifications where kind = 'media.upload_failed'), 1, 'the uploader is notified');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'velho.jpg', 500, 'image/jpeg', 'idem-key-0010');
reset role;
update public.media_upload_sessions set expires_at = now() - interval '1 hour' where status = 'open';
select is(jsonb_array_length(public.media_expire_sessions() -> 'keys'), 6, 'expired sessions return the keys of every abandoned upload');
select is((select count(*)::int from public.media_assets where display_name = 'velho.jpg'), 0, 'the abandoned asset is removed');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.media_delete_permanently('%s')$$, current_setting('t.asset1')), 'invalid_input', 'only trashed files can be deleted permanently');
select lives_ok(format($$select public.media_set_trashed('%s', true)$$, current_setting('t.asset1')), 'the owner moves a file to the trash');
reset role;

insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
values (current_setting('t.version2')::uuid, 'brand_identity', gen_random_uuid());

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.media_delete_permanently('%s')$$, current_setting('t.asset1')), 'media_in_use', 'a file in use cannot be deleted');
reset role;
delete from public.media_usages;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.media_delete_permanently(current_setting('t.asset1')::uuid) -> 'keys'), 6, 'permanent deletion returns every object key of every version');
select is((select count(*)::int from public.media_assets where id = current_setting('t.asset1')::uuid), 0, 'the asset is gone');
reset role;
select is((select count(*)::int from public.audit_events where action = 'media.deleted_permanently'), 1, 'permanent deletion is audited');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.c1', public.media_collection_save(format('{"scope":"brand","brand_id":"%s","name":"Campanhas"}', current_setting('t.brand'))::jsonb) ->> 'id', true);
select set_config('t.c2', public.media_collection_save(format('{"scope":"brand","brand_id":"%s","parent_id":"%s","name":"Verao"}', current_setting('t.brand'), current_setting('t.c1'))::jsonb) ->> 'id', true);
select set_config('t.c3', public.media_collection_save(format('{"scope":"brand","brand_id":"%s","parent_id":"%s","name":"Posts"}', current_setting('t.brand'), current_setting('t.c2'))::jsonb) ->> 'id', true);
select throws_ok(
  format($$select public.media_collection_save('{"scope":"brand","brand_id":"%s","parent_id":"%s","name":"Fundo"}'::jsonb)$$, current_setting('t.brand'), current_setting('t.c3')),
  'invalid_input',
  'collections nest at most three levels'
);
select throws_ok(
  format($$select public.media_collection_save('{"scope":"brand","brand_id":"%s","name":"campanhas"}'::jsonb)$$, current_setting('t.brand')),
  'invalid_input',
  'a collection name is unique at its level, ignoring case'
);
select throws_ok(
  format($$select public.media_collection_save('{"scope":"brand","brand_id":"%s","name":"X"}'::jsonb)$$, current_setting('t.brandB')),
  'not_found',
  'a collection cannot be created on a brand the person cannot access'
);
select set_config('t.asset4', (public.media_request_upload('brand', current_setting('t.brand')::uuid, 'moveme.jpg', 100, 'image/jpeg', 'idem-key-0011') ->> 'asset_id'), true);
select lives_ok(format($$select public.media_collection_move_items('%s', array['%s']::uuid[])$$, current_setting('t.c3'), current_setting('t.asset4')), 'files move into a collection');
select is((select count(*)::int from public.media_collection_items where collection_id = current_setting('t.c3')::uuid), 1, 'the collection holds the reference');
select throws_ok(format($$select public.media_collection_delete('%s')$$, current_setting('t.c3')), 'denied', 'a manager has no media.delete for collections');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.media_collection_delete('%s')$$, current_setting('t.c3')), 'invalid_input', 'a collection with files is not deleted');
select throws_ok(format($$select public.media_collection_move_items('%s', array['%s']::uuid[])$$, current_setting('t.c1'), gen_random_uuid()), 'invalid_input', 'unknown assets are refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.organization_setting_save('policies.uploads', '{"maxImageMb":25,"maxVideoMb":100,"maxDocumentMb":50,"quotaMb":1}'::jsonb, 0);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($$select public.media_request_upload('brand', '%s', 'cheio.jpg', 900000, 'image/jpeg', 'idem-key-0012')$$, current_setting('t.brand')),
  'quota_exceeded',
  'uploads past the quota are refused'
);
reset role;

set local role anon;
select throws_ok($$select * from public.media_assets$$, 'permission denied for table media_assets', 'anon cannot read assets');
select throws_ok($$select public.media_storage_used()$$, 'permission denied for function media_storage_used', 'anon cannot read the quota');
reset role;

select * from finish();
rollback;

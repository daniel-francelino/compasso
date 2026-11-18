begin;

select plan(28);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.doc3(p_elements jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 3,
    'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'background', null, 'elements', p_elements))
  )
$$;

create function pg_temp.raster(p_id text, p_pixels text default null) returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'kind', 'raster', 'pixelsVersionId', p_pixels, 'pixelWidth', 512, 'pixelHeight', 512)
$$;

create function pg_temp.draft_version() returns int language sql as $$
  select version from public.designs where id = current_setting('t.design')::uuid
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'outsider@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000c2'::uuid, 'Outsider', 'outsider@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

set local session_replication_role = replica;
insert into public.media_assets (id, organization_id, scope, brand_id, display_name, hidden, trashed_at)
values
  ('00000000-0000-0000-0000-00000000bb01', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'layer.png', true, null),
  ('00000000-0000-0000-0000-00000000bb02', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'loose.png', true, null),
  ('00000000-0000-0000-0000-00000000bb03', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'pending.png', true, null),
  ('00000000-0000-0000-0000-00000000bb04', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'trashed.png', true, now()),
  ('00000000-0000-0000-0000-00000000bb05', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'filler.png', true, null);
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, width, height)
select ('00000000-0000-0000-0000-00000000cc0' || n)::uuid, '00000000-0000-0000-0000-00000000bb01', n, 'k/l' || n, 'layer.png', 'image/png', 10, 'available', 512, 512
from generate_series(1, 6) n;
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, width, height)
values
  ('00000000-0000-0000-0000-00000000cd01', '00000000-0000-0000-0000-00000000bb02', 1, 'k/s1', 'loose.png', 'image/png', 10, 'available', 512, 512),
  ('00000000-0000-0000-0000-00000000cd02', '00000000-0000-0000-0000-00000000bb03', 1, 'k/s2', 'pending.png', 'image/png', 10, 'pending', 512, 512),
  ('00000000-0000-0000-0000-00000000cd03', '00000000-0000-0000-0000-00000000bb04', 1, 'k/s3', 'trashed.png', 'image/png', 10, 'available', 512, 512);
update public.media_assets set current_version_id = '00000000-0000-0000-0000-00000000cc06' where id = '00000000-0000-0000-0000-00000000bb01';
update public.media_assets set current_version_id = '00000000-0000-0000-0000-00000000cd01' where id = '00000000-0000-0000-0000-00000000bb02';
insert into public.media_usages (media_version_id, usage_type, usage_ref_id)
values ('00000000-0000-0000-0000-00000000cc01', 'content_revision', '00000000-0000-0000-0000-00000000ee01');
set local session_replication_role = origin;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.design', (public.design_create(current_setting('t.brand')::uuid, 'Camadas', 'feed_square', pg_temp.doc3('[]'::jsonb)) ->> 'id'), true);
select throws_ok(
  format($f$select public.design_save_draft(%L::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cd02'))), pg_temp.draft_version())$f$, current_setting('t.design')),
  'invalid_input', 'design_assert_media refuses a version that is still pending'
);
select throws_ok(
  format($f$select public.design_save_draft(%L::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cd03'))), pg_temp.draft_version())$f$, current_setting('t.design')),
  'invalid_input', 'design_assert_media refuses a file in the trash'
);
select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cc02'))), pg_temp.draft_version()) ->> 'version')::int > 1,
  'an available file outside the trash is accepted');

select ok((public.media_request_upload('brand', current_setting('t.brand')::uuid, 'camada-aaaa.png', 100, 'image/png', 'collab-hidden-1', null, true) ->> 'asset_id') is not null,
  'a collaborator with design.update creates a hidden asset');
select set_config('t.own', (select a.id::text from public.media_assets a where a.created_by = '00000000-0000-0000-0000-0000000000c1' and a.hidden), true);
select ok((public.media_request_upload('brand', current_setting('t.brand')::uuid, 'camada-aaaa.png', 100, 'image/png', 'collab-hidden-2', current_setting('t.own')::uuid, true) ->> 'version_id') is not null,
  'S2: the creator adds a version to its hidden asset without media.update');
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'x.png', 100, 'image/png', 'collab-hidden-3', %L::uuid, false)$f$, current_setting('t.brand'), current_setting('t.own')),
  'denied', 'S2: without the hidden flag a new version still needs media.update'
);
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'x.png', 100, 'image/png', 'collab-hidden-4', '00000000-0000-0000-0000-00000000bb01', true)$f$, current_setting('t.brand')),
  'denied', 'S2: a hidden asset of another user still needs media.update'
);
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'x.png', 100, 'image/png', 'collab-vis-1', '00000000-0000-0000-0000-00000000bb02', false)$f$, current_setting('t.brand')),
  'denied', 'S2: a visible-flag request on a foreign asset keeps requiring media.update'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select ok((public.media_request_upload('brand', current_setting('t.brand')::uuid, 'x.png', 100, 'image/png', 'mgr-version-1', current_setting('t.own')::uuid, true) ->> 'version_id') is not null,
  'a manager with media.update adds a version to another user''s hidden asset');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'x.png', 100, 'image/png', 'out-hidden-1', %L::uuid, true)$f$, current_setting('t.brand'), current_setting('t.own')),
  null, 'a collaborator without a brand link is refused'
);
select throws_ok(format($f$select public.design_purge_hidden_versions(%L::uuid)$f$, current_setting('t.design')), null, 'a collaborator without a brand link cannot purge');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(format($f$select public.design_purge_hidden_versions(%L::uuid)$f$, current_setting('t.design')), null, 'an external user cannot purge');
reset role;

set local role anon;
select throws_ok(format($f$select public.design_purge_hidden_versions(%L::uuid)$f$, current_setting('t.design')), '42501', 'anon cannot execute the purge');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cc02'))), pg_temp.draft_version()) ->> 'version') is not null,
  'the draft references version 2 of the layer asset');
select is((public.design_purge_hidden_versions(current_setting('t.design')::uuid) ->> 'purged')::int, 1,
  'S1: the purge queues the one old version beyond the 2 most recent');
reset role;

select is(
  (select array_agg(version_no order by version_no) from public.media_versions where asset_id = '00000000-0000-0000-0000-00000000bb01' and purge_requested_at is not null),
  array[3], 'S1: only version 3 is queued'
);
select is(
  (select count(*)::int from public.media_versions where asset_id = '00000000-0000-0000-0000-00000000bb01' and purge_requested_at is null),
  5, 'S1: the draft version, the current version, the used version and the 2 most recent are kept'
);
select is(
  (select count(*)::int from public.audit_events where action = 'design.hidden_purged'), 1, 'S1: the purge is audited'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((public.design_purge_hidden_versions(current_setting('t.design')::uuid) ->> 'purged')::int, 0, 'S1: running the purge again changes nothing');
select throws_ok(format($f$select public.media_set_trashed('00000000-0000-0000-0000-00000000bb01', true)$f$), 'media_in_use', 'S3: a hidden asset referenced by a draft cannot be trashed');
select ok((public.media_set_trashed('00000000-0000-0000-0000-00000000bb02', true) ->> 'id') is not null, 'S3: an unreferenced hidden asset can be trashed');
select is((select count(*)::int from public.audit_events where action = 'media.hidden_removed'), 1, 'S3: removing a hidden asset is audited');
reset role;

set local session_replication_role = replica;
update public.media_assets set trashed_at = now() where id = '00000000-0000-0000-0000-00000000bb01';
set local session_replication_role = origin;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($f$select public.media_delete_permanently('00000000-0000-0000-0000-00000000bb01')$f$), 'media_in_use', 'S3: a draft-referenced hidden asset cannot be deleted permanently');
select ok((public.media_delete_permanently('00000000-0000-0000-0000-00000000bb02') -> 'keys') is not null, 'S3: an unreferenced hidden asset can be deleted permanently');
reset role;

set local session_replication_role = replica;
insert into public.media_versions (asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, uploaded_by)
select '00000000-0000-0000-0000-00000000bb05', n, 'k/f' || n, 'filler.png', 'image/png', 1, 'available', '00000000-0000-0000-0000-0000000000c1'
from generate_series(1, 300) n;
set local session_replication_role = origin;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'camada-bbbb.png', 100, 'image/png', 'collab-hidden-9', null, true)$f$, current_setting('t.brand')),
  'hidden_limit_reached', 'S1: the cap of 300 live hidden versions refuses a new hidden upload'
);
select ok((public.media_request_upload('brand', current_setting('t.brand')::uuid, 'visible.png', 100, 'image/png', 'collab-vis-9', null, false) ->> 'asset_id') is not null,
  'the cap does not apply to a normal upload');
reset role;

select is(public.media_policy_mb('quotaMb', 10240), 10240, 'S5: the default quota is 10240 MB');
select is((select count(*)::int from pg_proc where proname = 'media_hidden_in_draft' and has_function_privilege('anon', oid, 'execute')), 0, 'the draft reference helper is private');

select * from finish();
rollback;

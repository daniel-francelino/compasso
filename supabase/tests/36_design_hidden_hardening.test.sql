begin;

select plan(6);

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
reset role;

set local session_replication_role = replica;
insert into public.media_assets (id, organization_id, scope, brand_id, display_name, hidden, trashed_at, created_by)
values
  ('00000000-0000-0000-0000-00000000bb01', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'layer.png', true, null, '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000bb02', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'trashed.png', true, now(), '00000000-0000-0000-0000-0000000000b1');
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, width, height)
select ('00000000-0000-0000-0000-00000000cc0' || n)::uuid, '00000000-0000-0000-0000-00000000bb01', n, 'k/l' || n, 'layer.png', 'image/png', 10, 'available', 512, 512
from generate_series(1, 6) n;
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, width, height)
values
  ('00000000-0000-0000-0000-00000000cd01', '00000000-0000-0000-0000-00000000bb01', 7, 'k/big', 'big.png', 'image/png', 10, 'available', 5000, 512),
  ('00000000-0000-0000-0000-00000000cd02', '00000000-0000-0000-0000-00000000bb01', 8, 'k/max', 'max.png', 'image/png', 10, 'available', 4096, 4096),
  ('00000000-0000-0000-0000-00000000cd03', '00000000-0000-0000-0000-00000000bb02', 1, 'k/t', 'trashed.png', 'image/png', 10, 'available', 512, 512);
update public.media_assets set current_version_id = '00000000-0000-0000-0000-00000000cc06' where id = '00000000-0000-0000-0000-00000000bb01';
set local session_replication_role = origin;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select set_config('t.design', (public.design_create(current_setting('t.brand')::uuid, 'Camadas', 'feed_square', pg_temp.doc3('[]'::jsonb)) ->> 'id'), true);
select set_config('t.other', (public.design_create(current_setting('t.brand')::uuid, 'Outro', 'feed_square', pg_temp.doc3('[]'::jsonb)) ->> 'id'), true);
select throws_ok(
  format($f$select public.design_save_draft(%L::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cd01'))), pg_temp.draft_version())$f$, current_setting('t.design')),
  'invalid_input', 'a raster file wider than 4096 is refused'
);
select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cd02'))), pg_temp.draft_version()) ->> 'version') is not null,
  'a raster file of exactly 4096 by 4096 is accepted');

select public.design_save_draft(current_setting('t.other')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r9', '00000000-0000-0000-0000-00000000cc01'))),
  (select version from public.designs where id = current_setting('t.other')::uuid));
select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('r1', '00000000-0000-0000-0000-00000000cc02'))), pg_temp.draft_version());
select is((public.design_purge_hidden_versions(current_setting('t.design')::uuid) ->> 'purged')::int, 3,
  'the purge spares a version referenced by another design draft of the brand');
reset role;

select is(
  (select count(*)::int from public.media_versions where id = '00000000-0000-0000-0000-00000000cc01' and purge_requested_at is not null),
  0, 'the version referenced by the other draft was not queued'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'x.png', 100, 'image/png', 'mgr-trashed-1', '00000000-0000-0000-0000-00000000bb02', true)$f$, current_setting('t.brand')),
  'invalid_input', 'a hidden new version on a trashed asset is refused'
);
reset role;

update public.brands set archived_at = now() where id = current_setting('t.brand')::uuid;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  format($f$select public.media_request_upload('brand', %L::uuid, 'x.png', 100, 'image/png', 'mgr-archived-1', '00000000-0000-0000-0000-00000000bb01', true)$f$, current_setting('t.brand')),
  null, 'a hidden new version on an archived brand is refused'
);
reset role;

select * from finish();
rollback;

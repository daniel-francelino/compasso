begin;

select plan(67);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.el(p_id text, p_kind text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'kind', p_kind) || p_extra
$$;

create function pg_temp.doc3(p_elements jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 3,
    'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'background', null, 'elements', p_elements))
  )
$$;

create function pg_temp.raster(p_id text, p_pixels text default null) returns jsonb language sql as $$
  select pg_temp.el(p_id, 'raster', jsonb_build_object('pixelsVersionId', p_pixels, 'pixelWidth', 512, 'pixelHeight', 512))
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'outsider@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
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

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
reset role;

set local session_replication_role = replica;
insert into public.media_assets (id, organization_id, scope, brand_id, display_name, hidden)
values
  ('00000000-0000-0000-0000-00000000aa01', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'photo.jpg', false),
  ('00000000-0000-0000-0000-00000000aa11', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'layer-1.png', true),
  ('00000000-0000-0000-0000-00000000aa12', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'mask-1.png', true),
  ('00000000-0000-0000-0000-00000000aa13', (select id from public.organizations limit 1), 'brand', current_setting('t.brandB')::uuid, 'layer-b.png', true),
  ('00000000-0000-0000-0000-00000000aa14', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'layer-2.png', true);
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status)
values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000aa01', 1, 'k/a', 'photo.jpg', 'image/jpeg', 10, 'available'),
  ('00000000-0000-0000-0000-00000000ab11', '00000000-0000-0000-0000-00000000aa11', 1, 'k/b', 'layer-1.png', 'image/png', 10, 'available'),
  ('00000000-0000-0000-0000-00000000ab12', '00000000-0000-0000-0000-00000000aa12', 1, 'k/c', 'mask-1.png', 'image/png', 10, 'available'),
  ('00000000-0000-0000-0000-00000000ab13', '00000000-0000-0000-0000-00000000aa13', 1, 'k/d', 'layer-b.png', 'image/png', 10, 'available'),
  ('00000000-0000-0000-0000-00000000ab14', '00000000-0000-0000-0000-00000000aa14', 1, 'k/e', 'layer-2.png', 'image/png', 10, 'available');
update public.media_assets set current_version_id = '00000000-0000-0000-0000-00000000ab11' where id = '00000000-0000-0000-0000-00000000aa11';
update public.media_assets set current_version_id = '00000000-0000-0000-0000-00000000ab01' where id = '00000000-0000-0000-0000-00000000aa01';
set local session_replication_role = origin;

select is(
  public.design_upgrade_document('{"version":1,"background":null,"elements":[{"id":"x","kind":"rect"}]}'::jsonb) -> 'pages' -> 0 -> 'elements' -> 0,
  '{"id":"x","kind":"rect","blendMode":"normal","fillOpacity":1,"hidden":false,"name":"","parentId":null,"clipToBelow":false,"mask":null}'::jsonb,
  'a version 1 document is upgraded through version 2 to version 3 with the defaults'
);
select is(
  (public.design_upgrade_document('{"version":2,"pages":[{"id":"a","background":"#aabbcc","elements":[{"id":"x","kind":"rect","hidden":true,"name":"Fundo"}]}]}'::jsonb) -> 'pages' -> 0 -> 'elements' -> 0) ->> 'hidden',
  'true', 'an existing value wins over the default'
);
select is(public.design_upgrade_document('{"version":2,"pages":[{"id":"a","background":null,"elements":[]}]}'::jsonb) ->> 'version', '3', 'a version 2 document becomes version 3');
select is(
  public.design_upgrade_document('{"version":3,"pages":[{"id":"a","background":null,"elements":[]}]}'::jsonb),
  '{"version":3,"pages":[{"id":"a","background":null,"elements":[]}]}'::jsonb,
  'a version 3 document is left as it is'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.design', (public.design_create(
  current_setting('t.brand')::uuid, 'Camadas', 'feed_square',
  '{"version":2,"pages":[{"id":"p1","background":null,"elements":[{"id":"a","kind":"rect"}]}]}'::jsonb
) ->> 'id'), true);
select ok(current_setting('t.design')::uuid is not null, 'a version 2 document is still accepted');

select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(
  pg_temp.el('g1', 'group', '{"collapsed":false,"passThrough":true}'),
  pg_temp.el('r1', 'rect', '{"parentId":"g1","blendMode":"multiply","fillOpacity":0.5,"hidden":false,"name":"Forma","clipToBelow":true}'),
  pg_temp.raster('ra1', '00000000-0000-0000-0000-00000000ab11'),
  pg_temp.el('ad1', 'adjustment', '{"adjustment":{"type":"curves","params":{"points":[[0,0],[1,1]]}}}'),
  pg_temp.el('im1', 'image', '{"mediaVersionId":"00000000-0000-0000-0000-00000000ab01","mask":{"mediaVersionId":"00000000-0000-0000-0000-00000000ab12","enabled":true,"linked":true}}')
)), 1) ->> 'version')::int = 2, 'a version 3 document with every new kind is accepted');

select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('s1', 'star'))), 2)$$, 'invalid_input', 'an unknown kind is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, jsonb_build_object('version', 2, 'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'background', null, 'elements', jsonb_build_array(pg_temp.el('g1', 'group'))))), 2)$$, 'invalid_input', 'a version 2 document cannot hold a version 3 kind');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('ra1', '00000000-0000-0000-0000-00000000ab13'))), 2)$$, 'invalid_input', 'pixels of another brand are refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('ra1', '00000000-0000-0000-0000-00000000ab01'))), 2)$$, 'invalid_input', 'pixels must be a PNG');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('ra1', '00000000-0000-0000-0000-0000000000ff'))), 2)$$, 'invalid_input', 'pixels that do not exist are refused');
select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.raster('ra1'))), 2) ->> 'version')::int = 3, 'a raster layer without pixels yet is accepted');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('ra1', 'raster', '{"pixelWidth":5000,"pixelHeight":10}'))), 3)$$, 'invalid_input', 'a raster above 4096 pixels is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"mask":{"mediaVersionId":"00000000-0000-0000-0000-00000000ab13","enabled":true,"linked":false}}'))), 3)$$, 'invalid_input', 'a mask of another brand is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"mask":{"mediaVersionId":null,"enabled":"yes","linked":false}}'))), 3)$$, 'invalid_input', 'a mask flag must be a boolean');
select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"mask":{"mediaVersionId":null,"enabled":true,"linked":false}}'))), 3) ->> 'version')::int = 4, 'a mask without a file yet is accepted');

select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('g1', 'group', '{"parentId":"g2"}'), pg_temp.el('g2', 'group', '{"parentId":"g1"}'))), 4)$$, 'invalid_input', 'a cycle of groups is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('g1', 'group', '{"parentId":"g1"}'))), 4)$$, 'invalid_input', 'a group inside itself is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"parentId":"nope"}'))), 4)$$, 'invalid_input', 'an orphan parentId is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r0', 'rect'), pg_temp.el('r1', 'rect', '{"parentId":"r0"}'))), 4)$$, 'invalid_input', 'a parent that is not a group is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, jsonb_build_object('version', 3, 'pages', jsonb_build_array(
  jsonb_build_object('id', 'p1', 'background', null, 'elements', jsonb_build_array(pg_temp.el('g1', 'group'))),
  jsonb_build_object('id', 'p2', 'background', null, 'elements', jsonb_build_array(pg_temp.el('r1', 'rect', '{"parentId":"g1"}'))))), 4)$$, 'invalid_input', 'a parent on another page is refused');

select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3((
  select jsonb_agg(pg_temp.el('g' || n, 'group', case when n = 1 then '{}'::jsonb else jsonb_build_object('parentId', 'g' || (n - 1)) end) order by n)
  from generate_series(1, 9) n
)), 4) ->> 'version')::int = 5, 'groups nested down to depth 8 are accepted');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3((
  select jsonb_agg(el order by o) from (
    select n as o, pg_temp.el('g' || n, 'group', case when n = 1 then '{}'::jsonb else jsonb_build_object('parentId', 'g' || (n - 1)) end) as el from generate_series(1, 9) n
    union all select 10, pg_temp.el('leaf', 'rect', '{"parentId":"g9"}')
  ) s
)), 5)$$, 'invalid_input', 'nesting deeper than 8 is refused');

select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"blendMode":"dissolve"}'))), 5)$$, 'invalid_input', 'an unknown blend mode is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"fillOpacity":1.5}'))), 5)$$, 'invalid_input', 'a fill opacity above 1 is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', jsonb_build_object('name', repeat('x', 81))))), 5)$$, 'invalid_input', 'a layer name above 80 characters is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('r1', 'rect', '{"hidden":"yes"}'))), 5)$$, 'invalid_input', 'hidden must be a boolean');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('ad1', 'adjustment', '{"adjustment":{"type":"sepia","params":{}}}'))), 5)$$, 'invalid_input', 'an unknown adjustment type is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('ad1', 'adjustment'))), 5)$$, 'invalid_input', 'an adjustment layer needs its adjustment');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(pg_temp.el('g1', 'group', '{"collapsed":1}'))), 5)$$, 'invalid_input', 'group flags must be booleans');

select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, jsonb_set(pg_temp.doc3('[]'::jsonb), '{pages,0,width}', '5000'::jsonb), 5)$$, 'invalid_input', 'a page width above 4096 is refused');
select ok((public.design_save_draft(current_setting('t.design')::uuid, jsonb_set(jsonb_set(pg_temp.doc3('[]'::jsonb), '{pages,0,width}', '1200'::jsonb), '{pages,0,height}', '800'::jsonb), 5) ->> 'version')::int = 6, 'a page with its own size is accepted');

select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3((select jsonb_agg(pg_temp.el('e' || n, 'rect')) from generate_series(1, 200) n)), 6) ->> 'version')::int = 7, '200 elements are accepted');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3((select jsonb_agg(pg_temp.el('e' || n, 'rect')) from generate_series(1, 201) n)), 7)$$, 'design_too_large', '201 elements are too large');
select throws_ok($$select public.design_create(current_setting('t.brand')::uuid, 'Antigo', 'story', jsonb_build_object('version', 2, 'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'background', null, 'elements', (select jsonb_agg(pg_temp.el('e' || n, 'rect')) from generate_series(1, 101) n)))))$$, 'design_too_large', 'a version 2 document keeps its limit of 100 elements');

select ok((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3(jsonb_build_array(
  pg_temp.raster('ra1', '00000000-0000-0000-0000-00000000ab11'),
  pg_temp.el('im1', 'image', '{"mediaVersionId":"00000000-0000-0000-0000-00000000ab01","mask":{"mediaVersionId":"00000000-0000-0000-0000-00000000ab12","enabled":true,"linked":true}}')
)), 7) ->> 'version')::int = 8, 'the draft holds a pixel file, a mask file and an image');
select is((public.design_save_version(current_setting('t.design')::uuid, 8) ->> 'version_no')::int, 1, 'the version 3 document is saved as version 1');
reset role;

select is(
  (select array_agg(media_version_id order by media_version_id) from public.media_usages where usage_type = 'design_version'),
  array['00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000ab11', '00000000-0000-0000-0000-00000000ab12']::uuid[],
  'the image, the pixel file and the mask file are registered as used'
);
select ok(public.media_version_in_use('00000000-0000-0000-0000-00000000ab11'), 'the library sees the pixel file as in use');
select is((select document ->> 'version' from public.design_versions where design_id = current_setting('t.design')::uuid and version_no = 1), '3', 'the saved version is a version 3 document');

update public.media_assets set trashed_at = now() where id in ('00000000-0000-0000-0000-00000000aa11', '00000000-0000-0000-0000-00000000aa14');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.media_delete_permanently('00000000-0000-0000-0000-00000000aa14')$$, 'denied', 'a manager has no media.delete');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.media_delete_permanently('00000000-0000-0000-0000-00000000aa11')$$, 'media_in_use', 'a hidden pixel file that a saved version uses cannot be deleted');
select ok((public.media_delete_permanently('00000000-0000-0000-0000-00000000aa14') ->> 'keys') is not null, 'a hidden file that nothing uses can be deleted');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$update public.design_versions set document = '{}'::jsonb$$, '42501', null, 'saved versions cannot be changed through the table');
reset role;
select throws_ok($$update public.design_versions set document = '{}'::jsonb$$, 'design_version_immutable', 'saved versions are immutable even for the owner of the table');

set local session_replication_role = replica;
insert into public.design_versions (design_id, brand_id, version_no, document)
values (current_setting('t.design')::uuid, current_setting('t.brand')::uuid, 2, '{"version":2,"pages":[{"id":"p1","background":null,"elements":[{"id":"old","kind":"rect"}]}]}'::jsonb);
update public.designs set current_version_no = 2 where id = current_setting('t.design')::uuid;
set local session_replication_role = origin;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select ok((public.design_restore_version(current_setting('t.design')::uuid, 2, 9) ->> 'version')::int = 10, 'a saved version 2 document is restored');
select is((select draft_document ->> 'version' from public.designs where id = current_setting('t.design')::uuid), '3', 'the restored draft is upgraded to version 3');
select is((select draft_document -> 'pages' -> 0 -> 'elements' -> 0 ->> 'blendMode' from public.designs where id = current_setting('t.design')::uuid), 'normal', 'the restored draft carries the defaults');
select ok((public.design_restore_version(current_setting('t.design')::uuid, 1, 10) ->> 'version')::int = 11, 'a saved version 3 document is restored');
reset role;
select is((select document ->> 'version' from public.design_versions where design_id = current_setting('t.design')::uuid and version_no = 2), '2', 'the saved version 2 document stays as it was written');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.hid', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'camada.png', 1000, 'image/png', 'idem-design-0001', null, true)::text, true);
select set_config('t.vis', public.media_request_upload('brand', current_setting('t.brand')::uuid, 'visivel.png', 1000, 'image/png', 'idem-design-0002')::text, true);
reset role;
select ok((select hidden from public.media_assets where id = (current_setting('t.hid')::jsonb ->> 'asset_id')::uuid), 'a layer file is stored hidden');
select ok(not (select hidden from public.media_assets where id = (current_setting('t.vis')::jsonb ->> 'asset_id')::uuid), 'a normal upload stays visible');
select is(
  (select count(*)::int from public.media_assets where not hidden and id in ((current_setting('t.hid')::jsonb ->> 'asset_id')::uuid, (current_setting('t.vis')::jsonb ->> 'asset_id')::uuid)),
  1, 'the library filter (not hidden) leaves out the layer file'
);
select is((select count(*)::int from public.media_assets where hidden and display_name = 'camada.png'), 1, 'the hidden file keeps its own row');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.media_request_upload('site', null, 'x.png', 1000, 'image/png', 'idem-design-0003', null, true)$$, 'invalid_input', 'a hidden file must belong to a brand');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'x.png', 1000, 'image/png', 'idem-design-0004', '00000000-0000-0000-0000-00000000aa01', true)$$, 'invalid_input', 'an existing asset cannot be turned hidden by a new version');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brandB')::uuid, 'x.png', 1000, 'image/png', 'idem-design-0005', null, true)$$, 'not_found', 'a hidden file for an unlinked brand is refused');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'x.png', 1000, 'image/png', 'idem-design-0006', null, null)$$, 'invalid_input', 'a null flag is refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$select public.media_request_upload('brand', current_setting('t.brand')::uuid, 'x.png', 1000, 'image/png', 'idem-design-0007', null, true)$$, 'denied', 'an external user cannot upload a layer file');
select throws_ok($$select public.design_save_version(current_setting('t.design')::uuid, 10)$$, 'denied', 'an external user cannot save a version');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3('[]'::jsonb), 10)$$, 'not_found', 'a collaborator without the brand link cannot save a draft');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$select public.design_save_version(current_setting('t.design')::uuid, 10)$$, 'not_found', 'a manager of brand B cannot save a version of a design of brand A');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc3('[]'::jsonb), 10)$$, 'not_found', 'nor a draft');
reset role;

set local role anon;
select throws_ok($$select public.design_create('00000000-0000-0000-0000-000000000001', 'X', 'story')$$, '42501', null, 'anon cannot create a design');
select throws_ok($$select public.media_request_upload('brand', '00000000-0000-0000-0000-000000000001', 'x.png', 1000, 'image/png', 'idem-design-0008', null, true)$$, '42501', null, 'anon cannot request a hidden upload');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.design_assert_document('{"version":3,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, current_setting('t.brand')::uuid)$$, '42501', null, 'the document validator is not callable from the client');
select throws_ok($$select public.design_upgrade_document('{"version":2}'::jsonb)$$, '42501', null, 'the upgrade function is not callable from the client');
reset role;

select * from finish();
rollback;

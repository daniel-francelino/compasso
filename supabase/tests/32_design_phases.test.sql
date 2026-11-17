begin;

select plan(24);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.doc(p_media text, p_pages int) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 2,
    'pages', (
      select jsonb_agg(jsonb_build_object(
        'id', 'p' || g,
        'background', null,
        'elements', jsonb_build_array(
          jsonb_build_object('id', 'img' || g, 'kind', 'image', 'mediaVersionId', p_media),
          jsonb_build_object('id', 'ln' || g, 'kind', 'line')
        )
      ))
      from generate_series(1, p_pages) g
    )
  )
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'collaborator')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
select set_config('t.brandB', (select id::text from public.brands where name = 'Padaria Sol'), true);
reset role;

set local session_replication_role = replica;
insert into public.media_assets (id, organization_id, scope, brand_id, display_name)
values
  ('00000000-0000-0000-0000-00000000aa01', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'photo.jpg'),
  ('00000000-0000-0000-0000-00000000aa02', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'export.png'),
  ('00000000-0000-0000-0000-00000000aa03', (select id from public.organizations limit 1), 'brand', current_setting('t.brandB')::uuid, 'other.png');
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, uploaded_by)
values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000aa01', 1, 'k/a', 'photo.jpg', 'image/jpeg', 10, 'available', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-00000000aa02', 1, 'k/b', 'export.png', 'image/png', 10, 'available', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000ab04', '00000000-0000-0000-0000-00000000aa02', 2, 'k/d', 'export.png', 'image/png', 10, 'available', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000ab03', '00000000-0000-0000-0000-00000000aa03', 1, 'k/c', 'other.png', 'image/png', 10, 'available', '00000000-0000-0000-0000-0000000000b2');
set local session_replication_role = origin;

select is(
  public.design_upgrade_document('{"version":1,"background":"#aabbcc","elements":[{"id":"x","kind":"rect"}]}'::jsonb),
  '{"version":2,"pages":[{"id":"page-1","background":"#aabbcc","elements":[{"id":"x","kind":"rect"}]}]}'::jsonb,
  'a version 1 document becomes a version 2 document with one page'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.design', (public.design_create(
  current_setting('t.brand')::uuid, 'Carrossel', 'feed_square',
  pg_temp.doc('00000000-0000-0000-0000-00000000ab01', 3)
) ->> 'id'), true);
select is(jsonb_array_length((select draft_document -> 'pages' from public.designs where id = current_setting('t.design')::uuid)), 3, 'a design can start from a document with several pages');
select throws_ok(
  $$select public.design_create(current_setting('t.brand')::uuid, 'X', 'story', pg_temp.doc('00000000-0000-0000-0000-00000000ab03', 1))$$,
  'invalid_input', 'a copy that references an image of another brand is refused'
);
select throws_ok(
  $$select public.design_create(current_setting('t.brand')::uuid, 'X', 'story', pg_temp.doc('00000000-0000-0000-0000-00000000ab01', 11))$$,
  'design_too_large', 'more than 10 pages is too large'
);
select is(jsonb_array_length((select draft_document -> 'pages' from public.designs where name = 'Carrossel')), 3, 'only the valid design was created');

select is((public.design_save_version(current_setting('t.design')::uuid, 1) ->> 'version_no')::int, 1, 'the carousel is saved as version 1');
reset role;

select is(
  (select count(*)::int from public.media_usages where usage_type = 'design_version' and media_version_id = '00000000-0000-0000-0000-00000000ab01'),
  1, 'the image of the saved version is registered once as used'
);
select ok(public.media_version_in_use('00000000-0000-0000-0000-00000000ab01'), 'the library sees the image as in use');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select ok(
  (public.design_record_export(current_setting('t.design')::uuid, 1, 2, 'png', 2, '00000000-0000-0000-0000-00000000ab02') ->> 'id') is not null,
  'a page of a saved version is recorded as exported'
);
select throws_ok(
  $$select public.design_record_export(current_setting('t.design')::uuid, 1, 1, 'jpeg', 1, '00000000-0000-0000-0000-00000000ab02')$$,
  'invalid_input', 'the format must match the file type'
);
select throws_ok(
  $$select public.design_record_export(current_setting('t.design')::uuid, 1, 1, 'png', 1, '00000000-0000-0000-0000-00000000ab04')$$,
  'invalid_input', 'a file uploaded by another person cannot be recorded'
);
select throws_ok(
  $$select public.design_record_export(current_setting('t.design')::uuid, 1, 4, 'png', 1, '00000000-0000-0000-0000-00000000ab02')$$,
  'invalid_input', 'a page that the version does not have is refused'
);
select throws_ok(
  $$select public.design_record_export(current_setting('t.design')::uuid, 9, 1, 'png', 1, '00000000-0000-0000-0000-00000000ab02')$$,
  'not_found', 'an unknown version is not found'
);

select is((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000ab01', 1), 2) ->> 'version')::int, 3, 'the draft changes to one page');
select is((public.design_restore_version(current_setting('t.design')::uuid, 1, 3) ->> 'version')::int, 4, 'restoring a version bumps the draft version');
select is(jsonb_array_length((select draft_document -> 'pages' from public.designs where id = current_setting('t.design')::uuid)), 3, 'the restored draft has the three pages again');
select throws_ok($$select public.design_restore_version(current_setting('t.design')::uuid, 7, 4)$$, 'not_found', 'an unknown version cannot be restored');

select is((public.design_set_template(current_setting('t.design')::uuid, true, 4) ->> 'version')::int, 5, 'a collaborator marks the design as a template');
select ok((select is_template from public.designs where id = current_setting('t.design')::uuid), 'the design is a template');
select throws_ok($$select public.design_set_template(current_setting('t.design')::uuid, false, 4)$$, 'conflict', 'a stale version cannot change the template flag');
reset role;

select is(
  (select array_agg(action order by action) from public.audit_events where entity_id = current_setting('t.design')::uuid and action in ('design.exported', 'design.version_restored', 'design.template_changed')),
  array['design.exported', 'design.template_changed', 'design.version_restored'],
  'export, restore and template change are audited'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.design_exports), 0, 'a manager of brand B does not see the exports of brand A');
select throws_ok(
  $$select public.design_record_export(current_setting('t.design')::uuid, 1, 1, 'png', 1, '00000000-0000-0000-0000-00000000ab03')$$,
  'not_found', 'a manager of brand B cannot record an export of a design of brand A'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$delete from public.design_exports$$, '42501', null, 'nobody deletes exports through the table');
reset role;

select * from finish();
rollback;

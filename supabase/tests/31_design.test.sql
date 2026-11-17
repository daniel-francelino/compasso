begin;

select plan(30);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.doc(p_media text) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 2,
    'pages', jsonb_build_array(jsonb_build_object(
      'id', 'p1',
      'background', '#f4efe6',
      'elements', jsonb_build_array(
        jsonb_build_object('id', 'a1', 'kind', 'text', 'text', 'Olá'),
        jsonb_build_object('id', 'a2', 'kind', 'image', 'mediaVersionId', p_media)
      )
    ))
  )
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'outsider@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
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
insert into public.media_assets (id, organization_id, scope, brand_id, display_name)
values
  ('00000000-0000-0000-0000-00000000aa01', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'logo-a.png'),
  ('00000000-0000-0000-0000-00000000aa02', (select id from public.organizations limit 1), 'brand', current_setting('t.brandB')::uuid, 'logo-b.png'),
  ('00000000-0000-0000-0000-00000000aa03', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'brief.pdf');
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status)
values
  ('00000000-0000-0000-0000-00000000ab01', '00000000-0000-0000-0000-00000000aa01', 1, 'k/a', 'logo-a.png', 'image/png', 10, 'available'),
  ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-00000000aa02', 1, 'k/b', 'logo-b.png', 'image/png', 10, 'available'),
  ('00000000-0000-0000-0000-00000000ab03', '00000000-0000-0000-0000-00000000aa03', 1, 'k/c', 'brief.pdf', 'application/pdf', 10, 'available');
set local session_replication_role = origin;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.design', (public.design_create(current_setting('t.brand')::uuid, '  Post de lançamento ', 'feed_portrait') ->> 'id'), true);
select is((select name from public.designs where id = current_setting('t.design')::uuid), 'Post de lançamento', 'a collaborator creates a design with a trimmed name');
select is((select version from public.designs where id = current_setting('t.design')::uuid), 1, 'a new design starts at version 1');
select is((select current_version_no from public.designs where id = current_setting('t.design')::uuid), 0, 'a new design has no saved version');
select is((select draft_document -> 'pages' -> 0 -> 'elements' from public.designs where id = current_setting('t.design')::uuid), '[]'::jsonb, 'a new design starts empty');
select throws_ok($$select public.design_create(current_setting('t.brand')::uuid, '   ', 'feed_square')$$, 'invalid_input', 'an empty name is refused');
select throws_ok($$select public.design_create(current_setting('t.brand')::uuid, 'X', 'banner')$$, 'invalid_input', 'an unknown preset is refused');
select throws_ok($$select public.design_create(current_setting('t.brandB')::uuid, 'X', 'story')$$, 'not_found', 'a design cannot be created for an unlinked brand');

select is((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000ab01'), 1) ->> 'version')::int, 2, 'saving the draft bumps the version');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000ab01'), 1)$$, 'conflict', 'a stale version is a conflict, never a silent overwrite');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000ab02'), 2)$$, 'invalid_input', 'an image of another brand is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000ab03'), 2)$$, 'invalid_input', 'a media version that is not an image is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":3,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 2)$$, 'invalid_input', 'an unknown document version is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":2,"pages":[{"id":"p","background":"red","elements":[]}]}'::jsonb, 2)$$, 'invalid_input', 'a background that is not #rrggbb is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":2,"pages":[{"id":"p","background":null,"elements":[{"id":"x","kind":"video"}]}]}'::jsonb, 2)$$, 'invalid_input', 'an unknown element kind is refused');
select throws_ok(
  $$select public.design_save_draft(current_setting('t.design')::uuid, jsonb_build_object('version', 2, 'pages', jsonb_build_array(jsonb_build_object('id', 'p', 'background', null, 'elements', (select jsonb_agg(jsonb_build_object('id', g::text, 'kind', 'rect')) from generate_series(1, 101) g)))), 2)$$,
  'design_too_large', 'more than 100 elements is too large'
);

select is((public.design_rename(current_setting('t.design')::uuid, 'Post final', 2) ->> 'version')::int, 3, 'renaming bumps the version');
select is((public.design_save_version(current_setting('t.design')::uuid, 3) ->> 'version_no')::int, 1, 'the first saved version is number 1');
select is((select document from public.design_versions where design_id = current_setting('t.design')::uuid and version_no = 1), pg_temp.doc('00000000-0000-0000-0000-00000000ab01'), 'the saved version freezes the draft');
select throws_ok($$select public.design_set_trashed(current_setting('t.design')::uuid, true)$$, 'denied', 'a collaborator cannot move a design to the trash');
reset role;

select throws_ok($$update public.design_versions set version_no = 9$$, 'design_version_immutable', 'saved versions cannot be updated');
select throws_ok($$delete from public.design_versions$$, 'design_version_immutable', 'saved versions cannot be deleted');
select is((select count(*)::int from public.audit_events where entity_id = current_setting('t.design')::uuid and action in ('design.created', 'design.version_saved')), 2, 'creation and saved version are audited, the draft is not');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((public.design_set_trashed(current_setting('t.design')::uuid, true) ->> 'version')::int, 5, 'a manager moves the design to the trash');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":2,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 5)$$, 'design_trashed', 'a trashed design cannot be edited');
select is((public.design_set_trashed(current_setting('t.design')::uuid, false) ->> 'version')::int, 6, 'a manager restores the design');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.designs), 0, 'a manager of brand B does not see designs of brand A');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":2,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 6)$$, 'not_found', 'a manager of brand B cannot edit a design of brand A by id');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.design_versions), 0, 'an unlinked collaborator does not see saved versions');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.designs), 0, 'an external member of the brand reaches no design');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.designs$$, '42501', null, 'anon cannot read designs');
reset role;

select * from finish();
rollback;

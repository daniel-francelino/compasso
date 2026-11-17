begin;

select plan(34);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.doc(p_video text, p_image text, p_main_ms int) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1,
    'background', '#1f1d2b',
    'fadeInMs', 0,
    'fadeOutMs', 0,
    'main', jsonb_build_array(
      jsonb_build_object('id', 'm1', 'kind', 'video', 'mediaVersionId', p_video, 'durationMs', p_main_ms, 'sourceInMs', 0, 'volume', 1, 'fit', 'cover')
    ),
    'overlays', jsonb_build_array(
      jsonb_build_object('id', 'o1', 'mediaVersionId', p_image, 'startMs', 0, 'durationMs', 1000)
    ),
    'texts', jsonb_build_array(jsonb_build_object('id', 't1', 'text', 'Olá', 'startMs', 500, 'durationMs', 2000)),
    'audio', '[]'::jsonb
  )
$$;

create function pg_temp.empty_doc() returns jsonb language sql as $$
  select '{"version":1,"background":"#1f1d2b","fadeInMs":0,"fadeOutMs":0,"main":[],"overlays":[],"texts":[],"audio":[]}'::jsonb
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
  ('00000000-0000-0000-0000-00000000ba01', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'clip-a.mp4'),
  ('00000000-0000-0000-0000-00000000ba02', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'logo-a.png'),
  ('00000000-0000-0000-0000-00000000ba03', (select id from public.organizations limit 1), 'brand', current_setting('t.brandB')::uuid, 'clip-b.mp4'),
  ('00000000-0000-0000-0000-00000000ba04', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'export.mp4'),
  ('00000000-0000-0000-0000-00000000ba05', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'other.mp4');
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, uploaded_by)
values
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000ba01', 1, 'k/v1', 'clip-a.mp4', 'video/mp4', 10, 'available', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-00000000ba02', 1, 'k/i1', 'logo-a.png', 'image/png', 10, 'available', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000bb03', '00000000-0000-0000-0000-00000000ba03', 1, 'k/v2', 'clip-b.mp4', 'video/mp4', 10, 'available', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-00000000bb04', '00000000-0000-0000-0000-00000000ba04', 1, 'k/e1', 'export.mp4', 'video/mp4', 10, 'available', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000bb05', '00000000-0000-0000-0000-00000000ba05', 1, 'k/e2', 'other.mp4', 'video/mp4', 10, 'available', '00000000-0000-0000-0000-0000000000b1');
set local session_replication_role = origin;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.project', (public.video_project_create(current_setting('t.brand')::uuid, '  Reel de lançamento ', 'story', pg_temp.empty_doc()) ->> 'id'), true);
select is((select name from public.video_projects where id = current_setting('t.project')::uuid), 'Reel de lançamento', 'a collaborator creates a project with a trimmed name');
select is((select version from public.video_projects where id = current_setting('t.project')::uuid), 1, 'a new project starts at version 1');
select is((select current_version_no from public.video_projects where id = current_setting('t.project')::uuid), 0, 'a new project has no saved version');
select throws_ok($$select public.video_project_create(current_setting('t.brand')::uuid, '  ', 'story', pg_temp.empty_doc())$$, 'invalid_input', 'an empty name is refused');
select throws_ok($$select public.video_project_create(current_setting('t.brand')::uuid, 'X', 'landscape', pg_temp.empty_doc())$$, 'invalid_input', 'an unknown preset is refused');
select throws_ok($$select public.video_project_create(current_setting('t.brandB')::uuid, 'X', 'story', pg_temp.empty_doc())$$, 'not_found', 'a project cannot be created for an unlinked brand');
select throws_ok($$select public.video_project_save_version(current_setting('t.project')::uuid, 1)$$, 'video_empty', 'a project without clips cannot be saved as a version');

select is((public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000bb02', 5000), 1) ->> 'version')::int, 2, 'saving the draft bumps the version');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.empty_doc(), 1)$$, 'conflict', 'a stale version is a conflict, never a silent overwrite');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000bb03', '00000000-0000-0000-0000-00000000bb02', 5000), 2)$$, 'invalid_input', 'a video of another brand is refused');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000bb02', '00000000-0000-0000-0000-00000000bb02', 5000), 2)$$, 'invalid_input', 'an image used as a video clip is refused');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000bb01', 5000), 2)$$, 'invalid_input', 'a video used as an overlay image is refused');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.doc('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000bb02', 50), 2)$$, 'invalid_input', 'a clip shorter than 100 ms is refused');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, '{"version":2,"background":"#1f1d2b","main":[],"overlays":[],"texts":[],"audio":[]}'::jsonb, 2)$$, 'invalid_input', 'an unknown document version is refused');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, jsonb_set(pg_temp.empty_doc(), '{background}', '"red"'), 2)$$, 'invalid_input', 'a background that is not #rrggbb is refused');
select throws_ok(
  $$select public.video_project_save_draft(current_setting('t.project')::uuid, jsonb_set(pg_temp.empty_doc(), '{texts}', jsonb_build_array(jsonb_build_object('id', 't', 'startMs', 89000, 'durationMs', 2000))), 2)$$,
  'video_too_long', 'a project longer than 90 seconds is refused'
);
select throws_ok(
  $$select public.video_project_save_draft(current_setting('t.project')::uuid, jsonb_set(pg_temp.empty_doc(), '{texts}', (select jsonb_agg(jsonb_build_object('id', g::text, 'startMs', 0, 'durationMs', 1000)) from generate_series(1, 31) g)), 2)$$,
  'video_too_large', 'more than 30 text clips is too large'
);

select is((public.video_project_rename(current_setting('t.project')::uuid, 'Reel final', 2) ->> 'version')::int, 3, 'renaming bumps the version');
select is((public.video_project_save_version(current_setting('t.project')::uuid, 3) ->> 'version_no')::int, 1, 'the first saved version is number 1');
select is((select duration_ms from public.video_project_versions where project_id = current_setting('t.project')::uuid and version_no = 1), 5000, 'the saved version stores the duration');
select is((select count(*)::int from public.media_usages where usage_type = 'video_project_version'), 2, 'the saved version registers its video and its image as usages');
select throws_ok($$select public.video_project_record_export(current_setting('t.project')::uuid, 1, '00000000-0000-0000-0000-00000000bb05')$$, 'invalid_input', 'an export file uploaded by someone else is refused');
select throws_ok($$select public.video_project_record_export(current_setting('t.project')::uuid, 9, '00000000-0000-0000-0000-00000000bb04')$$, 'not_found', 'an export of an unknown version is refused');
select isnt(public.video_project_record_export(current_setting('t.project')::uuid, 1, '00000000-0000-0000-0000-00000000bb04') ->> 'id', null, 'the caller records the export of its own MP4');
select throws_ok($$select public.video_project_set_trashed(current_setting('t.project')::uuid, true)$$, 'denied', 'a collaborator cannot move a project to the trash');
reset role;

select throws_ok($$update public.video_project_versions set version_no = 9$$, 'video_version_immutable', 'saved versions cannot be updated');
select throws_ok($$delete from public.video_project_versions$$, 'video_version_immutable', 'saved versions cannot be deleted');
select is((select count(*)::int from public.audit_events where entity_id = current_setting('t.project')::uuid and action in ('video.created', 'video.version_saved', 'video.exported')), 3, 'creation, saved version and export are audited, the draft is not');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is((public.video_project_set_trashed(current_setting('t.project')::uuid, true) ->> 'version')::int, 5, 'a manager moves the project to the trash');
select throws_ok($$select public.video_project_save_draft(current_setting('t.project')::uuid, pg_temp.empty_doc(), 5)$$, 'video_trashed', 'a trashed project cannot be edited');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.video_projects), 0, 'a manager of brand B does not see projects of brand A');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.video_exports), 0, 'an unlinked collaborator does not see exports');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.video_projects), 0, 'an external member of the brand reaches no project');
reset role;

set local role anon;
select throws_ok($$select count(*) from public.video_projects$$, '42501', null, 'anon cannot read projects');
reset role;

select * from finish();
rollback;

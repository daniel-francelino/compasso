begin;

select plan(28);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.meta(p_format text default 'psd', p_layers int default 2) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', 1,
    'source', jsonb_build_object('format', p_format, 'colorMode', 'rgb', 'bitsPerChannel', 8, 'pageCount', null),
    'layers', (
      select coalesce(jsonb_agg(jsonb_build_object('index', g, 'name', 'SECRET_LAYER_' || g, 'kind', 'raster')), '[]'::jsonb)
      from generate_series(1, p_layers) g
    ),
    'textRuns', '[]'::jsonb,
    'fonts', '[]'::jsonb,
    'colors', '[]'::jsonb
  )
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'manager2@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'outsider@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'viewer@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.roles (key, name, description, is_system, portal_only)
values ('design_viewer', 'Leitor de designs', 'Test role: design.view only', false, false);
insert into public.role_actions (role_id, action_key)
select r.id, a.key from public.roles r, (values ('brands.view'), ('design.view')) as a (key)
where r.key = 'design_viewer';

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000b2'::uuid, 'Manager Two', 'manager2@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000c2'::uuid, 'Outsider', 'outsider@example.test', 'internal', 'collaborator'),
  ('00000000-0000-0000-0000-0000000000c3'::uuid, 'Viewer', 'viewer@example.test', 'internal', 'design_viewer'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c3', 'internal', false, 'active');
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000d1', 'external', true, 'active');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.client_save('{"name":"Padaria Sol"}'::jsonb, true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.design', (public.design_create(current_setting('t.brand')::uuid, 'Importado', 'feed_square') ->> 'id'), true);
select set_config('t.design2', (public.design_create(current_setting('t.brand')::uuid, 'Lixeira', 'feed_square') ->> 'id'), true);

select ok(
  (public.design_record_import(current_setting('t.design')::uuid, pg_temp.meta('psd', 3)) ->> 'id') is not null,
  'a collaborator with design.update records an import'
);
select is((select count(*)::int from public.design_import_metadata), 1, 'the row is readable through the select policy');
select is((select source_format from public.design_import_metadata), 'psd', 'the source format comes from the metadata');
select is(
  (select brand_id from public.design_import_metadata),
  current_setting('t.brand')::uuid,
  'the brand comes from the design, not from the caller'
);
select throws_ok(
  format($f$insert into public.design_import_metadata (design_id, brand_id, source_format, metadata) values (%L, %L, 'psd', '{}')$f$, current_setting('t.design'), current_setting('t.brand')),
  '42501', null, 'a direct insert is denied'
);
select throws_ok($$update public.design_import_metadata set source_format = 'png'$$, '42501', null, 'a direct update is denied');
select throws_ok($$delete from public.design_import_metadata$$, '42501', null, 'a direct delete is denied');

select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta() || jsonb_build_object('pad', repeat('a', 1048577)))$f$, current_setting('t.design')),
  'design_import_metadata_too_large', 'metadata above 1 MiB is refused with the registered code'
);
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, jsonb_set(pg_temp.meta(), '{textRuns}', '[{"text":"x"}]'))$f$, current_setting('t.design')),
  'invalid_input', 'text runs are refused until a consumer exists'
);
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, jsonb_set(pg_temp.meta(), '{version}', '2'))$f$, current_setting('t.design')),
  'invalid_input', 'an unknown metadata version is refused'
);
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta('PSD; drop table x'))$f$, current_setting('t.design')),
  'invalid_input', 'a source format outside the allowed pattern is refused'
);
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta() - 'layers')$f$, current_setting('t.design')),
  'invalid_input', 'metadata without layers is refused'
);
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, '[]'::jsonb)$f$, current_setting('t.design')),
  'invalid_input', 'a non-object is refused'
);
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta('psd', 1001))$f$, current_setting('t.design')),
  'invalid_input', 'more than 1000 layers is refused'
);
select throws_ok(
  $$select public.design_record_import('00000000-0000-0000-0000-00000000ffff', pg_temp.meta())$$,
  'not_found', 'an unknown design is not found'
);
select is((select count(*)::int from public.design_import_metadata), 1, 'refused calls wrote nothing');
reset role;

select is(
  (select metadata from public.audit_events where action = 'design.import_recorded' and entity_id = current_setting('t.design')::uuid),
  '{"format": "psd", "layer_count": 3}'::jsonb,
  'the audit event holds the format and the layer count only'
);
select is(
  (select count(*)::int from public.audit_events where action = 'design.import_recorded' and metadata::text like '%SECRET_LAYER%'),
  0, 'the audit event carries no file text'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.design_set_trashed(current_setting('t.design2')::uuid, true);
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta())$f$, current_setting('t.design2')),
  'design_trashed', 'a trashed design cannot record an import'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.design_import_metadata), 1, 'a viewer with design.view reads the row');
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta())$f$, current_setting('t.design')),
  'denied', 'a user without design.update cannot record'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select is((select count(*)::int from public.design_import_metadata), 0, 'a collaborator not linked to the brand reads nothing');
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta())$f$, current_setting('t.design')),
  'not_found', 'a collaborator not linked to the brand cannot record'
);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from public.design_import_metadata), 0, 'a manager of another brand reads nothing');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.design_import_metadata), 0, 'an external approver reads nothing');
select throws_ok(
  format($f$select public.design_record_import(%L::uuid, pg_temp.meta())$f$, current_setting('t.design')),
  'denied', 'an external approver cannot record'
);
reset role;

select throws_ok(
  format($f$insert into public.design_import_metadata (design_id, brand_id, source_format, metadata) values (%L, '00000000-0000-0000-0000-00000000ffff', 'psd', '{}')$f$, current_setting('t.design')),
  '23503', null, 'the composite key refuses a brand that is not the brand of the design'
);

delete from public.designs where id = current_setting('t.design')::uuid;
select is((select count(*)::int from public.design_import_metadata), 0, 'the rows go with their design');

select * from finish();
rollback;

begin;

select plan(90);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.el(p_id text, p_kind text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('id', p_id, 'kind', p_kind) || p_extra
$$;

create function pg_temp.doc(p_version int, p_elements jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'version', p_version,
    'pages', jsonb_build_array(jsonb_build_object('id', 'p1', 'background', null, 'elements', p_elements))
  )
$$;

create function pg_temp.path(p_id text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select pg_temp.el(p_id, 'path', jsonb_build_object(
    'x', 10, 'y', 10, 'width', 100, 'height', 100, 'rotation', 0, 'opacity', 1, 'locked', false,
    'd', 'M0 0L10 0L10 10Z', 'viewWidth', 10, 'viewHeight', 10,
    'fill', jsonb_build_object('kind', 'solid', 'color', '#aabbcc'), 'stroke', null, 'fillRule', 'nonzero'
  ) || p_extra)
$$;

create function pg_temp.stops(p_count int) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('offset', 0.5, 'color', '#112233', 'alpha', 1)) from generate_series(1, p_count)
$$;

create function pg_temp.assert_doc(p_document jsonb) returns void language sql as $$
  select public.design_assert_document(p_document, current_setting('t.brand')::uuid)
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'manager1@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'collab@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager One', 'manager1@example.test', 'manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Collaborator', 'collab@example.test', 'collaborator')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);
select public.brand_member_set(current_setting('t.brand')::uuid, '00000000-0000-0000-0000-0000000000c1', 'internal', false, 'active');
reset role;

set local session_replication_role = replica;
insert into public.media_assets (id, organization_id, scope, brand_id, display_name)
values ('00000000-0000-0000-0000-00000000aa02', (select id from public.organizations limit 1), 'brand', current_setting('t.brand')::uuid, 'export.png');
insert into public.media_versions (id, asset_id, version_no, storage_key, original_filename, mime_type, size_bytes, status, uploaded_by)
values ('00000000-0000-0000-0000-00000000ab02', '00000000-0000-0000-0000-00000000aa02', 1, 'k/b', 'export.png', 'image/png', 10, 'available', '00000000-0000-0000-0000-0000000000c1');
set local session_replication_role = origin;

select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(2, '[{"id":"a","kind":"rect"}]'))$$, 'a version 2 document is still accepted');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(3, '[{"id":"a","kind":"rect"},{"id":"g","kind":"group"}]'))$$, 'a version 3 document is still accepted');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, '[{"id":"a","kind":"rect"},{"id":"g","kind":"group"}]'))$$, 'a version 4 document without a path is accepted');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1'))))$$, 'a version 4 document with a path is accepted');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(5, '[]'))$$, 'invalid_input', 'version 5 is refused');
select throws_ok($$select pg_temp.assert_doc('{"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb)$$, 'invalid_input', 'a missing version is refused');
select throws_ok($$select pg_temp.assert_doc('{"version":null,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb)$$, 'invalid_input', 'a null version is refused');
select throws_ok($$select pg_temp.assert_doc('{"version":"4","pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb)$$, 'invalid_input', 'a string version is refused');
select throws_ok($$select pg_temp.assert_doc('{"version":4.0,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb)$$, 'invalid_input', 'a version written 4.0 is refused');
select throws_ok($$select pg_temp.assert_doc('{"version":[4],"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb)$$, 'invalid_input', 'an array version is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(3, jsonb_build_array(pg_temp.path('v1'))))$$, 'invalid_input', 'a path inside a version 3 document is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(2, jsonb_build_array(pg_temp.path('v1'))))$$, 'invalid_input', 'a path inside a version 2 document is refused');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"fill":null,"stroke":{"color":"#000000","width":2,"cap":"round","join":"bevel","miterLimit":4,"dashed":true},"fillRule":"evenodd","d":"M0.5 1e2C1 2 3 4 5 6Q1 2 3 4L-1.5 +2Z,"}'))))$$, 'a path with a stroke, evenodd, a decimal and an exponent is accepted');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'linear', 'x1', 0, 'y1', 0, 'x2', 1, 'y2', 1, 'stops', pg_temp.stops(2)))))))$$, 'a linear gradient with 2 stops is accepted');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'radial', 'cx', 0.5, 'cy', 0.5, 'r', 0.5, 'stops', pg_temp.stops(8)))))))$$, 'a radial gradient with 8 stops is accepted');

select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":"M0 0L10 0z"}'))))$$, 'invalid_input', 'a lowercase command letter in d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":"M0 0A1 1 0 0 1 5 5Z"}'))))$$, 'invalid_input', 'an arc command in d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":"M0 0 <script>"}'))))$$, 'invalid_input', 'markup in d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', E'{"d":"M0 0\\tL1 1"}'))))$$, 'invalid_input', 'a tab in d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', E'{"d":"M0 0\\nL1 1"}'))))$$, 'invalid_input', 'a newline in d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":""}'))))$$, 'invalid_input', 'an empty d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":"   "}'))))$$, 'invalid_input', 'a whitespace-only d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":"1 2 3"}'))))$$, 'invalid_input', 'a d without a command letter is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":5}'))))$$, 'invalid_input', 'a numeric d is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('d', 'M' || repeat('1', 16384))))))$$, 'invalid_input', 'd with 16385 characters is refused');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('d', 'M' || repeat('1', 16383))))))$$, 'd with 16384 characters is accepted');
select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('d', repeat('L1 1', 3000))))))$$, 'd with 3000 commands is accepted');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('d', repeat('L1 1', 3001))))))$$, 'invalid_input', 'd with 3001 commands is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('d', repeat('L1 1', 3500))))))$$, 'invalid_input', 'd with 3500 commands is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"viewWidth":0}'))))$$, 'invalid_input', 'viewWidth 0 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"viewHeight":0}'))))$$, 'invalid_input', 'viewHeight 0 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"viewWidth":"10"}'))))$$, 'invalid_input', 'a non-numeric viewWidth is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"viewWidth":20001}'))))$$, 'invalid_input', 'a viewWidth above 20000 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"fillRule":"odd"}'))))$$, 'invalid_input', 'an unknown fill rule is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'linear', 'x1', 0, 'y1', 0, 'x2', 1, 'y2', 1, 'stops', pg_temp.stops(1)))))))$$, 'invalid_input', 'a gradient with 1 stop is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'radial', 'cx', 0.5, 'cy', 0.5, 'r', 0.5, 'stops', pg_temp.stops(9)))))))$$, 'invalid_input', 'a gradient with 9 stops is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'linear', 'x1', 0, 'y1', 0, 'x2', 2, 'y2', 1, 'stops', pg_temp.stops(2)))))))$$, 'invalid_input', 'a gradient coordinate above 1 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'radial', 'cx', 0.5, 'cy', 0.5, 'r', 0, 'stops', pg_temp.stops(2)))))))$$, 'invalid_input', 'a radial radius of 0 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'conic', 'stops', pg_temp.stops(2)))))))$$, 'invalid_input', 'an unknown paint kind is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'linear', 'x1', 0, 'y1', 0, 'x2', 1, 'y2', 1, 'stops', '[{"offset":2,"color":"#112233","alpha":1},{"offset":0,"color":"#112233","alpha":1}]'::jsonb))))))$$, 'invalid_input', 'a stop offset above 1 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'linear', 'x1', 0, 'y1', 0, 'x2', 1, 'y2', 1, 'stops', '[{"offset":0,"color":"red","alpha":1},{"offset":1,"color":"#112233","alpha":1}]'::jsonb))))))$$, 'invalid_input', 'a stop color that is not #rrggbb is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'linear', 'x1', 0, 'y1', 0, 'x2', 1, 'y2', 1, 'stops', '[{"offset":0,"color":"#112233","alpha":1,"href":"x"},{"offset":1,"color":"#112233","alpha":1}]'::jsonb))))))$$, 'invalid_input', 'an extra key on a stop is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"fill":{"kind":"solid","color":"#ABCDEF"}}'))))$$, 'invalid_input', 'an uppercase hex color is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"fill":{"kind":"solid","color":"#abc"}}'))))$$, 'invalid_input', 'a short hex color is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"fill":{"kind":"solid","color":"#aabbcc","style":"x"}}'))))$$, 'invalid_input', 'an extra key on a solid fill is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('fill', jsonb_build_object('kind', 'radial', 'cx', 0.5, 'cy', 0.5, 'r', 0.5, 'x1', 0, 'stops', pg_temp.stops(2)))))))$$, 'invalid_input', 'a linear key on a radial fill is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"blue","width":2,"cap":"butt","join":"miter","miterLimit":4,"dashed":false}}'))))$$, 'invalid_input', 'a stroke color that is not #rrggbb is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":0.05,"cap":"butt","join":"miter","miterLimit":4,"dashed":false}}'))))$$, 'invalid_input', 'a stroke width below 0.1 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":101,"cap":"butt","join":"miter","miterLimit":4,"dashed":false}}'))))$$, 'invalid_input', 'a stroke width above 100 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":2,"cap":"flat","join":"miter","miterLimit":4,"dashed":false}}'))))$$, 'invalid_input', 'an unknown stroke cap is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":2,"cap":"butt","join":"arcs","miterLimit":4,"dashed":false}}'))))$$, 'invalid_input', 'an unknown stroke join is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":2,"cap":"butt","join":"miter","miterLimit":21,"dashed":false}}'))))$$, 'invalid_input', 'a miter limit above 20 is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":2,"cap":"butt","join":"miter","miterLimit":4,"dashed":"no"}}'))))$$, 'invalid_input', 'a stroke dashed flag must be a boolean');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"stroke":{"color":"#000000","width":2,"cap":"butt","join":"miter","miterLimit":4,"dashed":false,"href":"x"}}'))))$$, 'invalid_input', 'an extra key on a stroke is refused');

select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"href":"https://example.test/a.svg"}'))))$$, 'invalid_input', 'an href key on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"style":"fill:red"}'))))$$, 'invalid_input', 'a style key on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"html":"<b>x</b>"}'))))$$, 'invalid_input', 'an html key on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"x":"10"}'))))$$, 'invalid_input', 'a non-numeric x on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"x":20001}'))))$$, 'invalid_input', 'an x above 20000 on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"width":0}'))))$$, 'invalid_input', 'a width of 0 on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"rotation":361}'))))$$, 'invalid_input', 'a rotation above 360 on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"opacity":2}'))))$$, 'invalid_input', 'an opacity above 1 on a path is refused');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"locked":"no"}'))))$$, 'invalid_input', 'a locked flag that is not a boolean on a path is refused');

select lives_ok($$select pg_temp.assert_doc(pg_temp.doc(4, (select jsonb_agg(pg_temp.path('e' || n)) from generate_series(1, 200) n)))$$, '200 path elements are accepted');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, (select jsonb_agg(pg_temp.path('e' || n)) from generate_series(1, 201) n)))$$, 'design_too_large', '201 elements in a version 4 document are too large');
select throws_ok($$select pg_temp.assert_doc(pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', jsonb_build_object('name', repeat('x', 300000))))))$$, 'design_too_large', 'a version 4 document over 256 KiB is too large');

select is(
  public.design_upgrade_document('{"version":3,"pages":[{"id":"a","background":null,"elements":[]}]}'::jsonb),
  '{"version":3,"pages":[{"id":"a","background":null,"elements":[]}]}'::jsonb,
  'a version 3 document is returned unchanged by the upgrade'
);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select set_config('t.design', (public.design_create(
  current_setting('t.brand')::uuid, 'Vetor', 'feed_square', pg_temp.doc(3, '[{"id":"a","kind":"rect"}]')
) ->> 'id'), true);
select set_config('t.design2', (public.design_create(
  current_setting('t.brand')::uuid, 'Plano', 'feed_square', pg_temp.doc(3, '[{"id":"a","kind":"rect"}]')
) ->> 'id'), true);
select set_config('t.design3', (public.design_create(
  current_setting('t.brand')::uuid, 'Criado com vetor', 'feed_square', pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1')))
) ->> 'id'), true);
select ok(current_setting('t.design3')::uuid is not null, 'a design is created from a version 4 document with a path');
select throws_ok($$select public.design_create(current_setting('t.brand')::uuid, 'Errado', 'feed_square', pg_temp.doc(3, jsonb_build_array(pg_temp.path('v1'))))$$, 'invalid_input', 'a design cannot be created from a version 3 document with a path');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 1)$$, 'invalid_input', 'saving a draft without a version is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":null,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 1)$$, 'invalid_input', 'saving a draft with a null version is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":"4","pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 1)$$, 'invalid_input', 'saving a draft with a string version is refused');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, '{"version":4.0,"pages":[{"id":"p","background":null,"elements":[]}]}'::jsonb, 1)$$, 'invalid_input', 'saving a draft with version 4.0 is refused');
select is((public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1'))), 1) ->> 'version')::int, 2, 'a version 4 draft with the first path is saved');
select is((select draft_document ->> 'version' from public.designs where id = current_setting('t.design')::uuid), '4', 'the stored draft holding a path is version 4');
select throws_ok($$select public.design_save_draft(current_setting('t.design')::uuid, pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1', '{"d":"M0 0 x"}'))), 2)$$, 'invalid_input', 'saving a draft with a bad path is refused');
select is((select draft_document ->> 'version' from public.designs where id = current_setting('t.design2')::uuid), '3', 'a draft that was not rewritten stays version 3');
reset role;

insert into public.design_versions (design_id, brand_id, version_no, document, created_by)
values
  (current_setting('t.design')::uuid, current_setting('t.brand')::uuid, 90, '{"version":3,"pages":[{"id":"p1","background":null,"elements":[{"id":"a","kind":"rect"}]}]}'::jsonb, '00000000-0000-0000-0000-0000000000c1'),
  (current_setting('t.design')::uuid, current_setting('t.brand')::uuid, 91, '{"version":2,"pages":[{"id":"p1","background":null,"elements":[{"id":"a","kind":"rect"}]}]}'::jsonb, '00000000-0000-0000-0000-0000000000c1'),
  (current_setting('t.design')::uuid, current_setting('t.brand')::uuid, 92, pg_temp.doc(4, jsonb_build_array(pg_temp.path('v1'))), '00000000-0000-0000-0000-0000000000c1');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is((public.design_save_version(current_setting('t.design')::uuid, 2) ->> 'version_no')::int, 1, 'a version 4 draft with a path is saved as a version');
select is((public.design_save_version(current_setting('t.design2')::uuid, 1) ->> 'version_no')::int, 1, 'a version 3 draft is saved as a version');
select is((public.design_restore_version(current_setting('t.design')::uuid, 90, 3) ->> 'version')::int, 4, 'a saved version 3 document is restored');
select is((select draft_document ->> 'version' from public.designs where id = current_setting('t.design')::uuid), '3', 'a restored version 3 document stays version 3');
select is((public.design_restore_version(current_setting('t.design')::uuid, 91, 4) ->> 'version')::int, 5, 'a saved version 2 document is restored');
select is((select draft_document ->> 'version' from public.designs where id = current_setting('t.design')::uuid), '3', 'a restored version 2 document becomes version 3');
select is((public.design_restore_version(current_setting('t.design')::uuid, 92, 5) ->> 'version')::int, 6, 'a saved version 4 document with a path is restored');
select is((select draft_document ->> 'version' from public.designs where id = current_setting('t.design')::uuid), '4', 'a restored version 4 document stays version 4');
select ok((public.design_record_export(current_setting('t.design')::uuid, 92, 1, 'png', 1, '00000000-0000-0000-0000-00000000ab02') ->> 'id') is not null, 'an export of a saved version 4 document with a path is recorded');
reset role;

select is(
  (select document from public.design_versions where design_id = current_setting('t.design')::uuid and version_no = 90),
  '{"version":3,"pages":[{"id":"p1","background":null,"elements":[{"id":"a","kind":"rect"}]}]}'::jsonb,
  'a saved version 3 document is unchanged after the restore'
);
select is(
  (select document ->> 'version' from public.design_versions where design_id = current_setting('t.design')::uuid and version_no = 1),
  '4', 'the version saved with a path is a version 4 document'
);
select is(
  (select document ->> 'version' from public.design_versions where design_id = current_setting('t.design2')::uuid and version_no = 1),
  '3', 'a version 3 draft is stored as a version 3 document'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.design_assert_path('{}'::jsonb)$$, '42501', null, 'the path validator is not callable by a client');

select * from finish();
rollback;

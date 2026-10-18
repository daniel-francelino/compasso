begin;

select plan(28);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.upload(p_key text, p_confirm boolean) returns uuid language plpgsql as $$
declare
  v_up jsonb;
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  v_up := public.media_request_upload('site', null, 'logo.jpg', 1000, 'image/jpeg', p_key);
  if p_confirm then
    perform public.media_confirm_upload((v_up ->> 'version_id')::uuid, repeat('b', 64), 800, 600, null, 0);
  end if;
  reset role;
  return (v_up ->> 'version_id')::uuid;
end;
$$;

create function pg_temp.page_with(p_title text, p_version uuid) returns jsonb language sql as $$
  select jsonb_build_object('title', p_title, 'seo', '{}'::jsonb, 'sections', jsonb_build_array(
    jsonb_build_object('component', 'hero', 'content', jsonb_build_object('image', jsonb_build_object('mediaVersionId', p_version)))
  ))
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'approver@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', u.kind, r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'internal', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'internal', 'manager'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Editor', 'editor@example.test', 'internal', 'site_editor'),
  ('00000000-0000-0000-0000-0000000000d1'::uuid, 'Approver', 'approver@example.test', 'external', 'external_approver')
) as u (id, name, email, kind, role_key)
join public.roles r on r.key = u.role_key;


select set_config('t.m1', pg_temp.upload('idem-site-0001', true)::text, true);
select set_config('t.m2', pg_temp.upload('idem-site-0002', true)::text, true);
select set_config('t.mp', pg_temp.upload('idem-site-0003', false)::text, true);

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select set_config('t.site', public.site_ensure()::text, true);
select set_config('t.home', (select id::text from public.site_pages where is_system), true);
select set_config('t.page', public.site_page_save(format('{"kind":"generic","slug":"imagens","draft_content":%s}', pg_temp.page_with('Imagens', current_setting('t.m1')::uuid))::jsonb) ->> 'id', true);
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(format($$select public.media_publish_derivative('%s')$$, current_setting('t.m1')), 'denied', 'a manager without media.publish cannot publish an image');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.media_publish_derivative('%s')$$, current_setting('t.mp')), 'media_not_available', 'an image that is not available cannot be published');
select throws_ok(format($$select public.publish_site_page('%s', null, jsonb_build_object('format', 1, 'draft_hash', public.site_draft_snapshot('%s') ->> 'hash', 'page', pg_temp.page_with('Imagens', '%s'), 'media', '{}'::jsonb), public.site_draft_snapshot('%s') ->> 'hash')$$, current_setting('t.page'), current_setting('t.page'), current_setting('t.m1'), current_setting('t.page')), 'media_not_published', 'publishing a page that uses an unpublished image is refused');
select is(public.media_publish_derivative(current_setting('t.m1')::uuid) ->> 'checksum', repeat('b', 64), 'the owner publishes the derivative of an image');
select is((select public_published_at is not null from public.media_versions where id = current_setting('t.m1')::uuid), true, 'the version is marked as public');
select is((select count(*)::int from public.audit_events where action = 'media.published'), 1, 'publishing an image is audited');
select is(public.site_media_info(array[current_setting('t.m1')::uuid, current_setting('t.m2')::uuid]) -> current_setting('t.m1') ->> 'published', 'true', 'the site reads whether an image is public');
select is(public.site_media_info(array[current_setting('t.m2')::uuid]) -> current_setting('t.m2') ->> 'checksum', repeat('b', 64), 'and its checksum for the public name');
select is((public.publish_site_page(current_setting('t.page')::uuid, null, jsonb_build_object('format', 1, 'draft_hash', public.site_draft_snapshot(current_setting('t.page')::uuid) ->> 'hash', 'page', pg_temp.page_with('Imagens', current_setting('t.m1')::uuid), 'media', '{}'::jsonb), public.site_draft_snapshot(current_setting('t.page')::uuid) ->> 'hash') ->> 'revision_no')::int, 1, 'with the image public the page is published');
select throws_ok(format($$select public.media_withdraw_derivative('%s')$$, current_setting('t.m1')), 'media_in_use', 'an image used by the site cannot be withdrawn');
select lives_ok(format($$select public.media_withdraw_derivative('%s')$$, current_setting('t.m2')), 'an unused image can be withdrawn');
select throws_ok($$select public.publish_site_settings(jsonb_build_object('seo', jsonb_build_object('ogImage', gen_random_uuid())), 1)$$, 'media_not_published', 'settings that point to an unpublished image are refused');
reset role;

set local role anon;
select throws_ok($$select public.media_publish_derivative(gen_random_uuid())$$, 'permission denied for function media_publish_derivative', 'anon cannot publish images');
select throws_ok($$select public.site_contact_submit(gen_random_uuid(), '{"name":"A","email":"a@example.test","message":"Oi","consent":true}'::jsonb)$$, 'invalid_input', 'a message for an unknown site is refused');
select throws_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","email":"ana@example.test","message":"Olá"}'::jsonb)$$, current_setting('t.site')), 'contact_consent_required', 'a message without consent is refused');
select throws_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","message":"Olá","consent":true}'::jsonb)$$, current_setting('t.site')), 'invalid_input', 'a message needs an email or a phone');
select throws_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","email":"invalido","message":"Olá","consent":true}'::jsonb)$$, current_setting('t.site')), 'invalid_input', 'an invalid email is refused');
select lives_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","email":"ANA@example.test","message":"Quero um orçamento","consent":true,"source_slug":"contato"}'::jsonb)$$, current_setting('t.site')), 'a visitor sends a message');
select lives_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","email":"ana@example.test","message":"Segunda","consent":true}'::jsonb)$$, current_setting('t.site')), 'a second one');
select lives_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","email":"ana@example.test","message":"Terceira","consent":true}'::jsonb)$$, current_setting('t.site')), 'and a third');
select throws_ok(format($$select public.site_contact_submit('%s', '{"name":"Ana","email":"ana@example.test","message":"Quarta","consent":true}'::jsonb)$$, current_setting('t.site')), 'rate_limited', 'the fourth message in an hour from the same contact is refused');
select throws_ok($$select count(*) from public.contact_messages$$, 'permission denied for table contact_messages', 'anon reads no message');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.contact_messages), 3, 'the site editor reads the messages');
select is((select email from public.contact_messages order by created_at limit 1), 'ana@example.test', 'and the email was stored in lower case');
select lives_ok(format($$select public.site_contact_update(id, 'answered', 'Respondi por e-mail') from public.contact_messages where message = 'Segunda'$$), 'an editor marks a message as answered');
select throws_ok(format($$select public.site_contact_update(id, 'maybe', null) from public.contact_messages limit 1$$), 'invalid_input', 'an unknown status is refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.contact_messages), 0, 'an external user reads no message');
reset role;

select is((select count(*)::int from public.notifications where kind = 'site.contact_message' and user_id = '00000000-0000-0000-0000-0000000000e1'), 3, 'the team is notified of each message');

select * from finish();
rollback;

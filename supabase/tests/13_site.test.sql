begin;

select plan(49);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.resolved(p_page uuid, p_title text, p_media jsonb default '{}', p_noindex boolean default false) returns jsonb language sql as $$
  select jsonb_build_object(
    'format', 1,
    'draft_hash', public.site_draft_snapshot(p_page) ->> 'hash',
    'page', jsonb_build_object('title', p_title, 'seo', jsonb_build_object('title', p_title, 'description', 'x', 'noindex', p_noindex), 'sections', '[]'::jsonb),
    'media', p_media
  )
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

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select set_config('t.site', public.site_ensure()::text, true);
select is((select count(*)::int from public.site_pages where is_system), 1, 'the site starts with its system home page');
select is(public.site_ensure()::text, current_setting('t.site'), 'ensuring the site twice returns the same site');
select set_config('t.home', (select id::text from public.site_pages where is_system), true);
select throws_ok(format($$select public.site_page_save('{"id":"%s","kind":"home","slug":"inicio"}'::jsonb, 1)$$, current_setting('t.home')), 'page_system_protected', 'the home page cannot change address');
select throws_ok(format($$select public.site_page_delete('%s')$$, current_setting('t.home')), 'page_system_protected', 'nor be deleted');
select throws_ok(format($$select public.unpublish_site_page('%s')$$, current_setting('t.home')), 'page_system_protected', 'nor be unpublished');
select set_config('t.services', public.site_page_save('{"kind":"services","slug":"servicos","draft_content":{"title":"Serviços","seo":{},"sections":[]}}'::jsonb) ->> 'id', true);
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"servicos"}'::jsonb)$$, 'slug_taken', 'a repeated address is refused');
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"admin/teste"}'::jsonb)$$, 'slug_reserved', 'a reserved address is refused');
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"Com Espaco"}'::jsonb)$$, 'invalid_input', 'an address with capitals or spaces is refused');
select throws_ok($$select public.site_page_save('{"kind":"home","slug":"outra"}'::jsonb)$$, 'invalid_input', 'a second home page cannot be created');
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"sem-secoes","draft_content":{"title":"x"}}'::jsonb)$$, 'invalid_input', 'a draft without a list of sections is refused');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"novo"}'::jsonb)$$, 'denied', 'an editor cannot create pages (structure)');
select is((public.site_page_save(format('{"id":"%s","kind":"services","slug":"servicos","draft_content":{"title":"Serviços e mais","seo":{},"sections":[]}}', current_setting('t.services'))::jsonb, 1) ->> 'version')::int, 2, 'an editor edits the working copy');
select throws_ok(format($$select public.site_page_save('{"id":"%s","kind":"services","slug":"servicos","draft_content":{"title":"x","sections":[]}}'::jsonb, 1)$$, current_setting('t.services')), 'conflict', 'a stale version is refused');
select throws_ok(format($$select public.site_page_save('{"id":"%s","kind":"services","slug":"novo-endereco","draft_content":{"title":"x","sections":[]}}'::jsonb, 2)$$, current_setting('t.services')), 'denied', 'an editor cannot change an address');
select throws_ok(format($$select public.publish_site_page('%s', null, '{"format":1}'::jsonb, 'x')$$, current_setting('t.services')), 'denied', 'an editor cannot publish');
select throws_ok($$select public.site_settings_save('contacts', '{"whatsapp":"5511999990000"}'::jsonb, 1)$$, 'denied', 'nor change the settings');
select is((select count(*)::int from public.site_pages), 2, 'the editor reads the pages');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.site_ensure()$$, 'denied', 'a manager without site actions is refused');
select is((select count(*)::int from public.site_pages), 0, 'and reads no page');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"externo"}'::jsonb)$$, 'denied', 'an external user is refused');
select is((select count(*)::int from public.contact_messages), 0, 'and reads no message');
reset role;

set local role anon;
select throws_ok($$select public.site_page_save('{"kind":"generic","slug":"anon"}'::jsonb)$$, 'permission denied for function site_page_save', 'anon cannot save a page');
select throws_ok($$select count(*) from public.site_pages$$, 'permission denied for table site_pages', 'anon reads no table of the site');
select is(public.site_published_page('servicos') ->> 'status', 'none', 'with nothing published the public read says so');
select is(public.site_published_settings(), null, 'and has no settings');
select is((public.site_published_sitemap() ->> 'published')::boolean, false, 'the sitemap says nothing is published');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok(format($$select public.publish_site_page('%s', null, pg_temp.resolved('%s', 'x'), 'wrong')$$, current_setting('t.services'), current_setting('t.services')), 'draft_changed', 'a hash that does not match the draft is refused');
select is((public.publish_site_page(current_setting('t.services')::uuid, 'Primeira', pg_temp.resolved(current_setting('t.services')::uuid, 'Serviços e mais'), public.site_draft_snapshot(current_setting('t.services')::uuid) ->> 'hash') ->> 'revision_no')::int, 1, 'the owner publishes the first revision');
select throws_ok(format($$select public.publish_site_page('%s', null, pg_temp.resolved('%s', 'Serviços e mais'), public.site_draft_snapshot('%s') ->> 'hash')$$, current_setting('t.services'), current_setting('t.services'), current_setting('t.services')), 'nothing_to_publish', 'publishing the same content again is refused');
reset role;
select throws_ok(format($$update public.site_page_revisions set note = 'x' where page_id = '%s'$$, current_setting('t.services')), 'record_immutable', 'a revision cannot be changed');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
reset role;

set local role anon;
select is(public.site_published_page('servicos') ->> 'status', 'ok', 'the public read serves the published page');
select is(public.site_published_page('servicos') -> 'content' -> 'page' ->> 'title', 'Serviços e mais', 'with its resolved content');
select is(public.site_published_page('servicos') -> 'content' ? 'draft', false, 'and never the working copy');
select is(public.site_published_page('nao-existe') ->> 'status', 'not_found', 'an unknown address is not found');
select is(jsonb_array_length(public.site_published_sitemap() -> 'pages'), 1, 'the sitemap lists the published page');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.site_page_save(format('{"id":"%s","kind":"services","slug":"servicos","draft_content":{"title":"Serviços 2","seo":{},"sections":[]}}', current_setting('t.services'))::jsonb, 2);
select is((public.publish_site_page(current_setting('t.services')::uuid, null, pg_temp.resolved(current_setting('t.services')::uuid, 'Serviços 2'), public.site_draft_snapshot(current_setting('t.services')::uuid) ->> 'hash') ->> 'revision_no')::int, 2, 'a changed draft publishes a second revision');
select is((public.site_rollback(current_setting('t.services')::uuid, (select id from public.site_page_revisions where page_id = current_setting('t.services')::uuid and revision_no = 1)) ->> 'revision_no')::int, 3, 'a rollback publishes the old content as a new revision');
select is((select draft_content ->> 'title' from public.site_pages where id = current_setting('t.services')::uuid), 'Serviços e mais', 'and restores the working copy');
select is((select count(*)::int from public.site_page_revisions where page_id = current_setting('t.services')::uuid), 3, 'history is kept');
select is((select source_revision_id is not null from public.site_page_revisions where page_id = current_setting('t.services')::uuid and revision_no = 3), true, 'the rollback records its source');
select is((public.site_page_save(format('{"id":"%s","kind":"services","slug":"servicos-novos","draft_content":{"title":"Serviços e mais","seo":{},"sections":[]}}', current_setting('t.services'))::jsonb, 4) ->> 'version')::int, 5, 'the owner changes the address of a published page');
reset role;

set local role anon;
select is(public.site_published_page('servicos') ->> 'status', 'redirect', 'the old address of a published page redirects');
select is(public.site_published_page('servicos') ->> 'to', '/servicos-novos', 'to the new one');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.site_redirect_save('{"from_path":"/servicos-novos","to_path":"/servicos"}'::jsonb)$$, 'redirect_invalid', 'a redirect that makes a cycle is refused');
select throws_ok($$select public.site_redirect_save('{"from_path":"/admin","to_path":"/x"}'::jsonb)$$, 'redirect_invalid', 'a redirect from a reserved address is refused');
select throws_ok($$select public.site_redirect_save('{"from_path":"/a","to_path":"http://x.test"}'::jsonb)$$, 'redirect_invalid', 'an insecure destination is refused');
select lives_ok($$select public.site_redirect_save('{"from_path":"/antigo","to_path":"/servicos-novos"}'::jsonb)$$, 'a valid redirect is saved');
select public.unpublish_site_page(current_setting('t.services')::uuid);
reset role;

set local role anon;
select is(public.site_published_page('servicos-novos') ->> 'status', 'none', 'an unpublished page is no longer served (nothing else is published)');
select is(jsonb_array_length(public.site_published_sitemap() -> 'pages'), 0, 'and leaves the sitemap');
reset role;

select * from finish();
rollback;

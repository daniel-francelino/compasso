begin;

select plan(33);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.resolved(p_page uuid, p_title text, p_media jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'format', 1,
    'draft_hash', public.site_draft_snapshot(p_page) ->> 'hash',
    'page', jsonb_build_object('title', p_title, 'card', jsonb_build_object('title', p_title), 'seo', jsonb_build_object('title', p_title, 'description', 'x'), 'sections', '[]'::jsonb),
    'media', p_media
  )
$$;

create function pg_temp.publish(p_page uuid, p_title text, p_media jsonb default '{}') returns jsonb language sql as $$
  select public.publish_site_page(p_page, null, pg_temp.resolved(p_page, p_title, p_media), public.site_draft_snapshot(p_page) ->> 'hash')
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'manager'),
  ('00000000-0000-0000-0000-0000000000e1'::uuid, 'Editor', 'editor@example.test', 'site_editor')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select set_config('t.site', public.site_ensure()::text, true);
select set_config('t.home', (select id::text from public.site_pages where is_system), true);
select public.client_save('{"name":"Cafe Aurora"}'::jsonb, true);
select set_config('t.brand', (select id::text from public.brands where name = 'Cafe Aurora'), true);

select is((public.site_settings_save('contacts', '{"whatsapp":"5511999990000","email":"oi@example.test"}'::jsonb, 1) ->> 'version')::int, 2, 'the owner saves a group of settings');
select throws_ok($$select public.site_settings_save('contacts', '{}'::jsonb, 1)$$, 'conflict', 'a stale settings version is refused');
select throws_ok($$select public.site_settings_save('unknown', '{}'::jsonb, 2)$$, 'invalid_input', 'an unknown group is refused');
select throws_ok($$select public.site_settings_save('contacts', '[]'::jsonb, 2)$$, 'invalid_input', 'a group must be an object');
select is((select settings -> 'contacts' ->> 'whatsapp' from public.sites), '5511999990000', 'the working settings hold the new value');
select is((select count(*)::int from public.audit_events where action = 'site.settings_changed'), 1, 'saving settings is audited');
reset role;

set local role anon;
select is(public.site_published_settings(), null, 'the public still sees no settings');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.publish_site_settings('{"contacts":{"whatsapp":"1"}}'::jsonb, 1)$$, 'draft_changed', 'publishing settings with a stale version is refused');
select lives_ok($$select public.publish_site_settings('{"contacts":{"whatsapp":"5511999990000"}}'::jsonb, 2)$$, 'the owner publishes the settings');
reset role;

set local role anon;
select is(public.site_published_settings() -> 'contacts' ->> 'whatsapp', '5511999990000', 'anon reads the published settings');
select is(public.site_published_settings() ->> 'site_id', current_setting('t.site'), 'with the id of the site');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select is((public.site_entry_save('{"kind":"service","content":{"name":"Estratégia"},"sort_order":1}'::jsonb) ->> 'version')::int, 1, 'an editor creates a service');
select set_config('t.entry', (select id::text from public.site_entries), true);
select throws_ok(format($$select public.site_entry_save('{"id":"%s","kind":"service","content":{"name":"x"},"version":9}'::jsonb)$$, current_setting('t.entry')), 'conflict', 'a stale entry version is refused');
select throws_ok($$select public.site_entry_save('{"kind":"other","content":{}}'::jsonb)$$, 'invalid_input', 'an unknown kind is refused');
select is((public.site_entry_save(format('{"id":"%s","kind":"service","content":{"name":"Estratégia 2"},"version":1}', current_setting('t.entry'))::jsonb) ->> 'version')::int, 2, 'and edits it');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.site_entry_save('{"kind":"service","content":{}}'::jsonb)$$, 'denied', 'a manager without site actions cannot create entries');
select is((select count(*)::int from public.site_entries), 0, 'and reads none');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select set_config('t.case', public.site_page_save('{"kind":"case_study","slug":"casos/aurora","draft_content":{"title":"Aurora","seo":{},"sections":[]}}'::jsonb) ->> 'id', true);
select throws_ok(format($$select pg_temp.publish('%s', 'Aurora')$$, current_setting('t.case')), 'case_study_not_authorized', 'a case study without authorization cannot be published');
select throws_ok(format($$select public.site_case_study_authorize('%s', '%s', 'ok')$$, current_setting('t.case'), current_setting('t.brand')), 'invalid_input', 'a consent note needs real content');
select throws_ok(format($$select public.site_case_study_authorize('%s', '%s', 'Consentimento por escrito')$$, current_setting('t.home'), current_setting('t.brand')), 'invalid_input', 'only a case study can be authorized');
select lives_ok(format($$select public.site_case_study_authorize('%s', '%s', 'Consentimento por escrito em 12/10')$$, current_setting('t.case'), current_setting('t.brand')), 'the owner authorizes it');
select is((select count(*)::int from public.audit_events where action = 'site.case_study_authorized'), 1, 'the authorization is audited');
select is((pg_temp.publish(current_setting('t.case')::uuid, 'Aurora') ->> 'revision_no')::int, 1, 'the authorized case study is published');
select is((pg_temp.publish(current_setting('t.home')::uuid, 'Início') ->> 'revision_no')::int, 1, 'and so is the home page');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok(format($$select public.site_case_study_authorize('%s', '%s', 'Consentimento por escrito')$$, current_setting('t.case'), current_setting('t.brand')), 'denied', 'an editor without brand access cannot authorize');
reset role;

set local role anon;
select is(public.site_published_page('casos/aurora') ->> 'status', 'ok', 'the authorized case study is public');
select is(jsonb_array_length(public.site_published_page('') -> 'case_studies'), 1, 'and appears in the list of case studies');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok(format($$select public.site_case_study_withdraw('%s')$$, current_setting('t.case')), 'the authorization is withdrawn');
select throws_ok(format($$select public.site_case_study_withdraw('%s')$$, current_setting('t.case')), 'not_found', 'withdrawing twice finds nothing');
reset role;

set local role anon;
select is(public.site_published_page('casos/aurora') ->> 'status', 'not_found', 'a withdrawn case study stops being served at once');
select is(jsonb_array_length(public.site_published_page('') -> 'case_studies'), 0, 'and leaves the list');
select is(jsonb_array_length(public.site_published_sitemap() -> 'pages'), 1, 'and the sitemap');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select public.site_page_save(format('{"id":"%s","kind":"case_study","slug":"casos/aurora","draft_content":{"title":"Aurora 2","seo":{},"sections":[]}}', current_setting('t.case'))::jsonb, 1);
select throws_ok(format($$select pg_temp.publish('%s', 'Aurora 2')$$, current_setting('t.case')), 'case_study_not_authorized', 'publishing again is blocked until it is re-authorized');
reset role;

select * from finish();
rollback;

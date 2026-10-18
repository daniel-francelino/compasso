begin;

select plan(10);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.publish(p_page uuid, p_title text) returns jsonb language sql as $$
  select public.publish_site_page(
    p_page, null,
    jsonb_build_object(
      'format', 1, 'draft_hash', public.site_draft_snapshot(p_page) ->> 'hash',
      'page', jsonb_build_object('title', p_title, 'seo', '{}'::jsonb, 'sections', '[]'::jsonb), 'media', '{}'::jsonb
    ),
    public.site_draft_snapshot(p_page) ->> 'hash'
  )
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'manager@example.test');

insert into public.profiles (id, full_name, email, status, kind, role_id)
select u.id, u.name, u.email, 'approved', 'internal', r.id
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Owner', 'owner@example.test', 'owner'),
  ('00000000-0000-0000-0000-0000000000b1'::uuid, 'Manager', 'manager@example.test', 'manager')
) as u (id, name, email, role_key)
join public.roles r on r.key = u.role_key;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select is((public.site_overview() ->> 'exists')::boolean, false, 'before the site exists the overview says so');
select public.site_ensure();
select set_config('t.page', public.site_page_save('{"kind":"generic","slug":"sobre","draft_content":{"title":"Sobre","seo":{},"sections":[]}}'::jsonb) ->> 'id', true);
select is((public.site_overview() ->> 'pages_total')::int, 2, 'the overview counts the home page and the new one');
select is((public.site_overview() ->> 'pages_published')::int, 0, 'nothing is published yet');
select pg_temp.publish(current_setting('t.page')::uuid, 'Sobre');
select is((public.site_overview() ->> 'pages_published')::int, 1, 'publishing is counted');
select is((public.site_overview() ->> 'pages_with_changes')::int, 0, 'and the page has no changes to publish');
select public.site_page_save(format('{"id":"%s","kind":"generic","slug":"sobre","draft_content":{"title":"Sobre nós","seo":{},"sections":[]}}', current_setting('t.page'))::jsonb, 1);
select is((public.site_overview() ->> 'pages_with_changes')::int, 1, 'editing a published page shows a change to publish');
select is((select (e ->> 'has_changes')::boolean from jsonb_array_elements(public.site_pages_overview()) e where e ->> 'slug' = 'sobre'), true, 'and the list flags that page');
select is((select e ->> 'title' from jsonb_array_elements(public.site_pages_overview()) e where e ->> 'slug' = 'sobre'), 'Sobre nós', 'with its working title');
select is((public.site_overview() ->> 'settings_dirty')::boolean, true, 'settings that were never published are flagged');
reset role;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select public.site_overview()$$, 'denied', 'a manager without site actions cannot read the overview');
reset role;

select * from finish();
rollback;

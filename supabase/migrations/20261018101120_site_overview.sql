begin;

create function public.site_pages_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('site.view');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id, 'kind', p.kind, 'slug', p.slug, 'title', p.draft_content ->> 'title',
          'status', p.status, 'version', p.version, 'is_system', p.is_system,
          'updated_at', p.updated_at, 'revision_no', r.revision_no,
          'has_changes', p.status = 'published'
            and md5(p.draft_content::text) is distinct from (r.content ->> 'draft_hash'),
          'authorized', exists (
            select 1 from public.site_case_study_authorizations a
            where a.page_id = p.id and a.withdrawn_at is null
          )
        )
        order by p.is_system desc, p.kind, p.slug
      )
      from public.site_pages p
      left join public.site_page_revisions r on r.id = p.published_revision_id
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.site_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_site public.sites;
begin
  perform public.assert_action('site.view');
  select * into v_site from public.sites s limit 1;
  return jsonb_build_object(
    'exists', v_site.id is not null,
    'pages_total', (select count(*)::int from public.site_pages),
    'pages_published', (select count(*)::int from public.site_pages p where p.status = 'published'),
    'pages_with_changes', (
      select count(*)::int
      from public.site_pages p
      join public.site_page_revisions r on r.id = p.published_revision_id
      where p.status = 'published' and md5(p.draft_content::text) is distinct from (r.content ->> 'draft_hash')
    ),
    'last_published_at', (
      select max(r.published_at) from public.site_page_revisions r
    ),
    'settings_published', v_site.published_settings is not null,
    'settings_dirty', v_site.published_settings is null
      or (v_site.published_settings ->> 'version')::int is distinct from v_site.settings_version,
    'messages_new', (select count(*)::int from public.contact_messages m where m.status = 'new'),
    'withdrawn_cases', (
      select count(*)::int
      from public.site_pages p
      where p.kind = 'case_study' and p.status = 'published'
        and not exists (
          select 1 from public.site_case_study_authorizations a
          where a.page_id = p.id and a.withdrawn_at is null
        )
    )
  );
end;
$$;

revoke execute on function public.site_pages_overview(), public.site_overview() from public, anon;
grant execute on function public.site_pages_overview(), public.site_overview() to authenticated;

commit;

begin;

create function public.site_ensure()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site uuid;
  v_org uuid := public.current_organization_id();
begin
  perform public.assert_action('site.view');
  select s.id into v_site from public.sites s where s.organization_id = v_org;
  if found then
    return v_site;
  end if;
  insert into public.sites (organization_id, name)
  values (v_org, (select o.name from public.organizations o where o.id = v_org))
  on conflict (organization_id) do nothing;
  select s.id into v_site from public.sites s where s.organization_id = v_org;
  insert into public.site_pages (site_id, kind, slug, is_system, draft_content, updated_by)
  values (
    v_site, 'home', '', true,
    '{"title":"Início","seo":{"title":"","description":""},"sections":[]}'::jsonb, auth.uid()
  )
  on conflict (site_id, slug) do nothing;
  return v_site;
end;
$$;

create function public.site_media_ids(p_content jsonb)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct m[1]::uuid), '{}')
  from regexp_matches(
    p_content::text,
    '"(?:mediaVersionId|ogImage)"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"',
    'g'
  ) as m
$$;

create function public.site_media_in_use(p_version uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.site_pages p where p.draft_content::text like '%' || p_version::text || '%')
    or exists (
      select 1 from public.site_pages p
      join public.site_page_revisions r on r.id = p.published_revision_id
      where r.content::text like '%' || p_version::text || '%'
    )
    or exists (
      select 1 from public.sites s
      where s.settings::text like '%' || p_version::text || '%'
        or coalesce(s.published_settings::text, '') like '%' || p_version::text || '%'
    )
$$;

create function public.site_media_info(p_ids uuid[])
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
      select jsonb_object_agg(
        v.id::text,
        jsonb_build_object(
          'checksum', v.checksum, 'width', v.width, 'height', v.height,
          'published', v.public_published_at is not null, 'mime', v.mime_type
        )
      )
      from public.media_versions v
      where v.id = any (p_ids) and public.can_view_media_asset(v.asset_id)
    ),
    '{}'::jsonb
  );
end;
$$;

create function public.site_page_save(p_page jsonb, p_expected_version int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_page ->> 'id', '')::uuid;
  v_kind text := p_page ->> 'kind';
  v_slug text := btrim(coalesce(p_page ->> 'slug', ''), '/ ');
  v_draft jsonb := coalesce(p_page -> 'draft_content', '{"title":"","seo":{},"sections":[]}'::jsonb);
  v_site uuid;
  v_old public.site_pages;
  v_version int;
begin
  perform public.assert_action('site.edit');
  v_site := public.site_ensure();
  if jsonb_typeof(v_draft) is distinct from 'object' or jsonb_typeof(v_draft -> 'sections') is distinct from 'array'
    or pg_column_size(v_draft) > 262144 then
    raise exception 'invalid_input';
  end if;
  if v_slug <> '' and v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$' then
    raise exception 'invalid_input';
  end if;
  if split_part(v_slug, '/', 1) in ('admin', 'portal', 'api') then
    raise exception 'slug_reserved';
  end if;

  if v_id is null then
    perform public.assert_action('site.structure');
    if v_kind is null or v_kind not in (
      'about', 'services', 'portfolio', 'case_study', 'contact', 'blog_post', 'generic'
    ) or v_slug = '' then
      raise exception 'invalid_input';
    end if;
    if exists (select 1 from public.site_pages p where p.site_id = v_site and p.slug = v_slug) then
      raise exception 'slug_taken';
    end if;
    insert into public.site_pages (site_id, kind, slug, draft_content, updated_by)
    values (v_site, v_kind, v_slug, v_draft, auth.uid())
    returning id, version into v_id, v_version;
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;

  select * into v_old from public.site_pages p where p.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p_expected_version is null or p_expected_version <> v_old.version then
    raise exception 'conflict';
  end if;
  if v_slug <> v_old.slug then
    perform public.assert_action('site.structure');
    if v_old.is_system then
      raise exception 'page_system_protected';
    end if;
    if v_slug = '' then
      raise exception 'invalid_input';
    end if;
    if exists (
      select 1 from public.site_pages p where p.site_id = v_old.site_id and p.slug = v_slug and p.id <> v_id
    ) then
      raise exception 'slug_taken';
    end if;
    if v_old.published_revision_id is not null then
      insert into public.site_redirects (site_id, from_path, to_path, permanent, created_by)
      values (v_old.site_id, '/' || v_old.slug, '/' || v_slug, true, auth.uid())
      on conflict (site_id, from_path) do update set to_path = excluded.to_path;
    end if;
  end if;
  delete from public.site_redirects r where r.site_id = v_old.site_id and r.from_path = '/' || v_slug;
  update public.site_pages
  set slug = v_slug, draft_content = v_draft, version = version + 1, updated_by = auth.uid()
  where id = v_id
  returning version into v_version;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.site_page_delete(p_page uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.site_pages;
begin
  perform public.assert_action('site.structure');
  select * into v_page from public.site_pages p where p.id = p_page for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_page.is_system then
    raise exception 'page_system_protected';
  end if;
  if exists (select 1 from public.site_page_revisions r where r.page_id = p_page)
    or exists (select 1 from public.site_case_study_authorizations a where a.page_id = p_page) then
    raise exception 'page_has_history';
  end if;
  delete from public.site_pages where id = p_page;
end;
$$;

create function public.site_entry_save(p_entry jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_entry ->> 'id', '')::uuid;
  v_kind text := p_entry ->> 'kind';
  v_content jsonb := p_entry -> 'content';
  v_order int := coalesce((p_entry ->> 'sort_order')::int, 0);
  v_visible boolean := coalesce((p_entry ->> 'visible')::boolean, true);
  v_expected int := (p_entry ->> 'version')::int;
  v_site uuid;
  v_old public.site_entries;
  v_version int;
begin
  perform public.assert_action('site.edit');
  v_site := public.site_ensure();
  if v_content is null or jsonb_typeof(v_content) <> 'object' or pg_column_size(v_content) > 16384 then
    raise exception 'invalid_input';
  end if;
  if v_id is null then
    if v_kind is null or v_kind not in ('service', 'testimonial') then
      raise exception 'invalid_input';
    end if;
    insert into public.site_entries (site_id, kind, content, sort_order, visible, updated_by)
    values (v_site, v_kind, v_content, v_order, v_visible, auth.uid())
    returning id, version into v_id, v_version;
    return jsonb_build_object('id', v_id, 'version', v_version);
  end if;
  select * into v_old from public.site_entries e where e.id = v_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_expected is null or v_expected <> v_old.version then
    raise exception 'conflict';
  end if;
  update public.site_entries
  set content = v_content, sort_order = v_order, visible = v_visible, version = version + 1,
      updated_by = auth.uid()
  where id = v_id
  returning version into v_version;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.site_entry_delete(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('site.edit');
  delete from public.site_entries where id = p_entry;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.site_settings_save(p_group text, p_value jsonb, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site uuid;
  v_version int;
  v_current int;
begin
  perform public.assert_action('site.settings');
  if p_group is null or p_group not in (
    'contacts', 'social', 'languages', 'seo_defaults', 'navigation', 'message_templates', 'announcement'
  ) or p_value is null or jsonb_typeof(p_value) <> 'object' or pg_column_size(p_value) > 65536 then
    raise exception 'invalid_input';
  end if;
  v_site := public.site_ensure();
  select s.settings_version into v_current from public.sites s where s.id = v_site for update;
  if p_expected_version is null or p_expected_version <> v_current then
    raise exception 'conflict';
  end if;
  update public.sites
  set settings = jsonb_set(settings, array[p_group], p_value, true), settings_version = settings_version + 1
  where id = v_site
  returning settings_version into v_version;
  perform public.audit_write(
    public.current_organization_id(), null, 'site.settings_changed', 'site', v_site,
    jsonb_build_object('group', p_group)
  );
  return jsonb_build_object('version', v_version);
end;
$$;

create function public.publish_site_settings(p_resolved jsonb, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site uuid;
  v_current int;
  v_missing uuid;
begin
  perform public.assert_action('site.publish');
  if p_resolved is null or jsonb_typeof(p_resolved) <> 'object' or pg_column_size(p_resolved) > 131072 then
    raise exception 'invalid_input';
  end if;
  v_site := public.site_ensure();
  select s.settings_version into v_current from public.sites s where s.id = v_site for update;
  if p_expected_version is null or p_expected_version <> v_current then
    raise exception 'draft_changed';
  end if;
  select i into v_missing
  from unnest(public.site_media_ids(p_resolved)) as i
  where not exists (
    select 1 from public.media_versions v where v.id = i and v.public_published_at is not null
  )
  limit 1;
  if v_missing is not null then
    raise exception 'media_not_published';
  end if;
  update public.sites
  set published_settings = p_resolved || jsonb_build_object('site_id', v_site, 'version', v_current),
      published_settings_at = now()
  where id = v_site;
  perform public.audit_write(
    public.current_organization_id(), null, 'site.settings_changed', 'site', v_site,
    jsonb_build_object('published', true, 'version', v_current)
  );
  perform public.notify_users(
    'site.published', null, 'Site publicado', 'As configurações do site foram publicadas.',
    '/admin/site/settings', 'site', v_site, 'site.published:settings:' || v_current, null
  );
  return jsonb_build_object('version', v_current);
end;
$$;

create function public.site_case_study_authorize(p_page uuid, p_brand uuid, p_consent_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.site_pages;
  v_note text := btrim(coalesce(p_consent_note, ''));
begin
  perform public.assert_action('site.edit');
  perform public.assert_action('brands.view');
  perform public.assert_brand_access(p_brand);
  if char_length(v_note) < 5 or char_length(v_note) > 1000 then
    raise exception 'invalid_input';
  end if;
  select * into v_page from public.site_pages p where p.id = p_page for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_page.kind <> 'case_study' then
    raise exception 'invalid_input';
  end if;
  update public.site_case_study_authorizations
  set withdrawn_at = now(), withdrawn_by = auth.uid()
  where page_id = p_page and withdrawn_at is null;
  insert into public.site_case_study_authorizations (page_id, brand_id, authorized_by, consent_note)
  values (p_page, p_brand, auth.uid(), v_note);
  perform public.audit_write(
    public.current_organization_id(), p_brand, 'site.case_study_authorized', 'site_page', p_page,
    '{}'::jsonb
  );
end;
$$;

create function public.site_case_study_withdraw(p_page uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth public.site_case_study_authorizations;
begin
  perform public.assert_action('site.edit');
  select * into v_auth from public.site_case_study_authorizations a
  where a.page_id = p_page and a.withdrawn_at is null for update;
  if not found then
    raise exception 'not_found';
  end if;
  update public.site_case_study_authorizations
  set withdrawn_at = now(), withdrawn_by = auth.uid()
  where id = v_auth.id;
  perform public.audit_write(
    public.current_organization_id(), v_auth.brand_id, 'site.case_study_withdrawn', 'site_page', p_page,
    '{}'::jsonb
  );
end;
$$;

create function public.site_publish_page_row(
  p_page public.site_pages,
  p_resolved jsonb,
  p_note text,
  p_source uuid
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing uuid;
  v_no int;
  v_revision uuid;
  v_title text := coalesce(p_resolved -> 'page' ->> 'title', '');
begin
  if p_page.kind = 'case_study' and not exists (
    select 1 from public.site_case_study_authorizations a
    where a.page_id = p_page.id and a.withdrawn_at is null
  ) then
    raise exception 'case_study_not_authorized';
  end if;
  select i into v_missing
  from unnest(public.site_media_ids(p_resolved)) as i
  where not exists (
    select 1 from public.media_versions v where v.id = i and v.public_published_at is not null
  )
  limit 1;
  if v_missing is not null then
    raise exception 'media_not_published';
  end if;
  select coalesce(max(r.revision_no), 0) + 1 into v_no
  from public.site_page_revisions r where r.page_id = p_page.id;
  insert into public.site_page_revisions (page_id, revision_no, content, note, published_by, source_revision_id)
  values (
    p_page.id, v_no, p_resolved || jsonb_build_object('draft', p_page.draft_content),
    nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), p_source
  )
  returning id into v_revision;
  update public.site_pages set status = 'published', published_revision_id = v_revision where id = p_page.id;
  perform public.notify_users(
    'site.published', null, 'Site publicado',
    format('A página «%s» foi publicada.', case when v_title = '' then 'sem título' else v_title end),
    '/admin/site/pages/' || p_page.id, 'site_page', p_page.id, 'site.published:' || v_revision, null
  );
  return v_no;
end;
$$;

create function public.publish_site_page(
  p_page uuid,
  p_note text,
  p_resolved jsonb,
  p_expected_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.site_pages;
  v_last jsonb;
  v_no int;
begin
  perform public.assert_action('site.publish');
  if p_resolved is null or jsonb_typeof(p_resolved) <> 'object' or (p_resolved ->> 'format') is distinct from '1'
    or pg_column_size(p_resolved) > 524288 or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'invalid_input';
  end if;
  select * into v_page from public.site_pages p where p.id = p_page for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p_expected_hash is null or md5(v_page.draft_content::text) <> p_expected_hash
    or (p_resolved ->> 'draft_hash') is distinct from p_expected_hash then
    raise exception 'draft_changed';
  end if;
  if v_page.status = 'published' then
    select r.content into v_last from public.site_page_revisions r where r.id = v_page.published_revision_id;
    if v_last ->> 'draft_hash' = p_expected_hash and v_last -> 'page' = p_resolved -> 'page' then
      raise exception 'nothing_to_publish';
    end if;
  end if;
  v_no := public.site_publish_page_row(v_page, p_resolved, p_note, v_page.published_revision_id);
  perform public.audit_write(
    public.current_organization_id(), null, 'site.page_published', 'site_page', p_page,
    jsonb_build_object('revision_no', v_no)
  );
  return jsonb_build_object('revision_no', v_no);
end;
$$;

create function public.unpublish_site_page(p_page uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.site_pages;
begin
  perform public.assert_action('site.publish');
  select * into v_page from public.site_pages p where p.id = p_page for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_page.is_system then
    raise exception 'page_system_protected';
  end if;
  update public.site_pages set status = 'unpublished', published_revision_id = null where id = p_page;
  perform public.audit_write(
    public.current_organization_id(), null, 'site.page_unpublished', 'site_page', p_page, '{}'::jsonb
  );
end;
$$;

create function public.site_rollback(p_page uuid, p_revision uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page public.site_pages;
  v_old public.site_page_revisions;
  v_no int;
begin
  perform public.assert_action('site.publish');
  select * into v_page from public.site_pages p where p.id = p_page for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_old from public.site_page_revisions r where r.id = p_revision and r.page_id = p_page;
  if not found then
    raise exception 'not_found';
  end if;
  update public.site_pages
  set draft_content = coalesce(v_old.content -> 'draft', draft_content), version = version + 1,
      updated_by = auth.uid()
  where id = p_page
  returning * into v_page;
  v_no := public.site_publish_page_row(v_page, v_old.content - 'draft', 'Volta à versão ' || v_old.revision_no, p_revision);
  perform public.audit_write(
    public.current_organization_id(), null, 'site.rolled_back', 'site_page', p_page,
    jsonb_build_object('to_revision', v_old.revision_no, 'revision_no', v_no)
  );
  return jsonb_build_object('revision_no', v_no);
end;
$$;

create function public.site_redirect_check(p_site uuid, p_from text, p_to text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_next text := p_to;
  v_steps int := 0;
begin
  if p_from is null or p_to is null or p_from = p_to or p_from !~ '^/[^ ]*$'
    or (p_to !~ '^/[^ ]*$' and p_to !~ '^https://[^ ]+$')
    or split_part(trim(leading '/' from p_from), '/', 1) in ('admin', 'portal', 'api', 'sitemap.xml', 'robots.txt')
    or p_from = '/' then
    raise exception 'redirect_invalid';
  end if;
  while v_next is not null and v_steps < 10 loop
    if v_next = p_from then
      raise exception 'redirect_invalid';
    end if;
    select r.to_path into v_next from public.site_redirects r where r.site_id = p_site and r.from_path = v_next;
    v_steps := v_steps + 1;
  end loop;
end;
$$;

create function public.site_redirect_save(p_redirect jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site uuid;
  v_from text := btrim(coalesce(p_redirect ->> 'from_path', ''));
  v_to text := btrim(coalesce(p_redirect ->> 'to_path', ''));
  v_permanent boolean := coalesce((p_redirect ->> 'permanent')::boolean, true);
  v_id uuid;
begin
  perform public.assert_action('site.settings');
  v_site := public.site_ensure();
  perform public.site_redirect_check(v_site, v_from, v_to);
  insert into public.site_redirects (site_id, from_path, to_path, permanent, created_by)
  values (v_site, v_from, v_to, v_permanent, auth.uid())
  on conflict (site_id, from_path) do update set to_path = excluded.to_path, permanent = excluded.permanent
  returning id into v_id;
  perform public.audit_write(
    public.current_organization_id(), null, 'site.settings_changed', 'site', v_site,
    jsonb_build_object('redirect', v_from)
  );
  return jsonb_build_object('id', v_id);
end;
$$;

create function public.site_redirect_delete(p_redirect uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site uuid;
begin
  perform public.assert_action('site.settings');
  delete from public.site_redirects where id = p_redirect returning site_id into v_site;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.audit_write(
    public.current_organization_id(), null, 'site.settings_changed', 'site', v_site,
    jsonb_build_object('redirect_deleted', true)
  );
end;
$$;

create function public.site_contact_submit(p_site uuid, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_email text := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '');
  v_phone text := nullif(btrim(coalesce(p_payload ->> 'phone', '')), '');
  v_message text := btrim(coalesce(p_payload ->> 'message', ''));
  v_slug text := nullif(left(btrim(coalesce(p_payload ->> 'source_slug', '')), 200), '');
  v_id uuid;
begin
  if not exists (select 1 from public.sites s where s.id = p_site) then
    raise exception 'invalid_input';
  end if;
  if coalesce((p_payload ->> 'consent')::boolean, false) is not true then
    raise exception 'contact_consent_required';
  end if;
  if char_length(v_name) not between 1 and 120 or char_length(v_message) not between 1 and 4000
    or (v_email is null and v_phone is null)
    or (v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    or char_length(coalesce(v_phone, '')) > 40 then
    raise exception 'invalid_input';
  end if;
  if (
    select count(*) from public.contact_messages m
    where m.site_id = p_site and m.created_at > now() - interval '1 hour'
      and ((v_email is not null and m.email = v_email) or (v_phone is not null and m.phone = v_phone))
  ) >= 3 then
    raise exception 'rate_limited';
  end if;
  insert into public.contact_messages (site_id, name, email, phone, message, source_slug, consent_at)
  values (p_site, v_name, v_email, v_phone, v_message, v_slug, now())
  returning id into v_id;
  perform public.notify_users(
    'site.contact_message', null, 'Nova mensagem do site',
    format('%s enviou uma mensagem pelo site.', v_name), '/admin/site/messages',
    'contact_message', v_id, 'site.contact_message:' || v_id, null
  );
end;
$$;

create function public.site_contact_update(p_message uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('site.view');
  if p_status is null or p_status not in ('new', 'answered', 'discarded')
    or char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'invalid_input';
  end if;
  update public.contact_messages
  set status = p_status, internal_note = nullif(btrim(coalesce(p_note, '')), ''), handled_by = auth.uid()
  where id = p_message;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.site_published_page(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_slug text := btrim(coalesce(p_slug, ''), '/ ');
  v_page public.site_pages;
  v_content jsonb;
  v_redirect public.site_redirects;
begin
  if not exists (select 1 from public.site_pages p where p.status = 'published')
    and not exists (select 1 from public.sites s where s.published_settings is not null) then
    return jsonb_build_object('status', 'none');
  end if;
  select * into v_page from public.site_pages p where p.slug = v_slug and p.status = 'published';
  if found and (
    v_page.kind <> 'case_study' or exists (
      select 1 from public.site_case_study_authorizations a
      where a.page_id = v_page.id and a.withdrawn_at is null
    )
  ) then
    select r.content - 'draft' into v_content from public.site_page_revisions r
    where r.id = v_page.published_revision_id;
    return jsonb_build_object(
      'status', 'ok', 'kind', v_page.kind, 'content', v_content,
      'case_studies', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'page_id', cp.id, 'slug', cp.slug, 'card', cr.content -> 'page' -> 'card', 'media', cr.content -> 'media'
        ) order by cr.published_at desc), '[]'::jsonb)
        from public.site_pages cp
        join public.site_page_revisions cr on cr.id = cp.published_revision_id
        where cp.kind = 'case_study' and cp.status = 'published'
          and exists (
            select 1 from public.site_case_study_authorizations a
            where a.page_id = cp.id and a.withdrawn_at is null
          )
      )
    );
  end if;
  select * into v_redirect from public.site_redirects r where r.from_path = '/' || v_slug;
  if found then
    return jsonb_build_object('status', 'redirect', 'to', v_redirect.to_path, 'permanent', v_redirect.permanent);
  end if;
  return jsonb_build_object('status', 'not_found');
end;
$$;

create function public.site_published_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select s.published_settings from public.sites s where s.published_settings is not null limit 1
$$;

create function public.site_published_sitemap()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'published', exists (select 1 from public.site_pages p where p.status = 'published'),
    'pages', coalesce(
      (
        select jsonb_agg(jsonb_build_object('slug', p.slug, 'updated_at', r.published_at) order by p.slug)
        from public.site_pages p
        join public.site_page_revisions r on r.id = p.published_revision_id
        where p.status = 'published'
          and coalesce((r.content -> 'page' -> 'seo' ->> 'noindex')::boolean, false) is false
          and (
            p.kind <> 'case_study' or exists (
              select 1 from public.site_case_study_authorizations a
              where a.page_id = p.id and a.withdrawn_at is null
            )
          )
      ),
      '[]'::jsonb
    )
  )
$$;

create function public.site_draft_snapshot(p_page uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page public.site_pages;
begin
  perform public.assert_action('site.view');
  select * into v_page from public.site_pages p where p.id = p_page;
  if not found then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'id', v_page.id, 'kind', v_page.kind, 'slug', v_page.slug, 'status', v_page.status,
    'version', v_page.version, 'draft_content', v_page.draft_content,
    'hash', md5(v_page.draft_content::text), 'is_system', v_page.is_system,
    'authorized', exists (
      select 1 from public.site_case_study_authorizations a
      where a.page_id = v_page.id and a.withdrawn_at is null
    )
  );
end;
$$;

create function public.media_publish_derivative(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.media_versions;
begin
  perform public.assert_action('media.publish');
  select * into v_version from public.media_versions v where v.id = p_version for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.media_assert_asset_access(v_version.asset_id);
  if v_version.status <> 'available' or v_version.mime_type not like 'image/%'
    or v_version.thumb_key is null or v_version.display_key is null or v_version.checksum is null then
    raise exception 'media_not_available';
  end if;
  update public.media_versions
  set public_published_at = coalesce(public_published_at, now())
  where id = p_version;
  perform public.audit_write(
    public.current_organization_id(), null, 'media.published', 'media_version', p_version, '{}'::jsonb
  );
  return jsonb_build_object(
    'checksum', v_version.checksum, 'thumb_key', v_version.thumb_key, 'display_key', v_version.display_key
  );
end;
$$;

create function public.media_withdraw_derivative(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.media_versions;
begin
  perform public.assert_action('media.publish');
  select * into v_version from public.media_versions v where v.id = p_version for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.media_assert_asset_access(v_version.asset_id);
  if public.site_media_in_use(p_version) then
    raise exception 'media_in_use';
  end if;
  update public.media_versions set public_published_at = null where id = p_version;
  perform public.audit_write(
    public.current_organization_id(), null, 'media.unpublished', 'media_version', p_version, '{}'::jsonb
  );
  return jsonb_build_object('checksum', v_version.checksum);
end;
$$;

revoke execute on function
  public.site_ensure(), public.site_media_ids(jsonb), public.site_media_in_use(uuid),
  public.site_media_info(uuid[]), public.site_page_save(jsonb, int), public.site_page_delete(uuid),
  public.site_entry_save(jsonb), public.site_entry_delete(uuid),
  public.site_settings_save(text, jsonb, int), public.publish_site_settings(jsonb, int),
  public.site_case_study_authorize(uuid, uuid, text), public.site_case_study_withdraw(uuid),
  public.site_publish_page_row(public.site_pages, jsonb, text, uuid),
  public.publish_site_page(uuid, text, jsonb, text), public.unpublish_site_page(uuid),
  public.site_rollback(uuid, uuid), public.site_redirect_check(uuid, text, text),
  public.site_redirect_save(jsonb), public.site_redirect_delete(uuid),
  public.site_contact_submit(uuid, jsonb), public.site_contact_update(uuid, text, text),
  public.site_published_page(text), public.site_published_settings(),
  public.site_published_sitemap(), public.site_draft_snapshot(uuid),
  public.media_publish_derivative(uuid), public.media_withdraw_derivative(uuid)
  from public, anon, authenticated;

grant execute on function
  public.site_ensure(), public.site_media_info(uuid[]), public.site_page_save(jsonb, int),
  public.site_page_delete(uuid), public.site_entry_save(jsonb), public.site_entry_delete(uuid),
  public.site_settings_save(text, jsonb, int), public.publish_site_settings(jsonb, int),
  public.site_case_study_authorize(uuid, uuid, text), public.site_case_study_withdraw(uuid),
  public.publish_site_page(uuid, text, jsonb, text), public.unpublish_site_page(uuid),
  public.site_rollback(uuid, uuid), public.site_redirect_save(jsonb),
  public.site_redirect_delete(uuid), public.site_contact_update(uuid, text, text),
  public.site_draft_snapshot(uuid), public.media_publish_derivative(uuid),
  public.media_withdraw_derivative(uuid)
  to authenticated;

grant execute on function
  public.site_contact_submit(uuid, jsonb), public.site_published_page(text),
  public.site_published_settings(), public.site_published_sitemap()
  to anon, authenticated;

commit;

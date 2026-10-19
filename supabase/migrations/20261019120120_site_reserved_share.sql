begin;

do $$
declare
  v_fn regprocedure;
  v_def text;
  v_new text;
  v_count int := 0;
begin
  for v_fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('site_page_save', 'site_redirect_check')
  loop
    v_def := pg_get_functiondef(v_fn);
    v_new := replace(
      replace(v_def, '(''admin'', ''portal'', ''api'')', '(''admin'', ''portal'', ''api'', ''share'')'),
      '''api'', ''sitemap.xml''',
      '''api'', ''share'', ''sitemap.xml'''
    );
    if v_new = v_def then
      raise exception 'site_reserved_share: % does not hold the reserved list', v_fn;
    end if;
    execute v_new;
    v_count := v_count + 1;
  end loop;
  if v_count <> 2 then
    raise exception 'site_reserved_share: expected 2 functions, found %', v_count;
  end if;
end
$$;

commit;

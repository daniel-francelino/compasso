begin;

do $$
declare
  v_fn regprocedure;
  v_def text;
  v_new text;
  v_old_call text;
  v_new_call text;
begin
  for v_fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('media_request_upload', 'media_storage_summary')
  loop
    v_def := pg_get_functiondef(v_fn);
    v_old_call := substring(
      v_def from $pattern$public\.media_policy_mb\('quotaMb',[[:space:]]*5120[[:space:]]*\)$pattern$
    );
    v_new_call := substring(
      v_def from $pattern$public\.media_policy_mb\('quotaMb',[[:space:]]*10240[[:space:]]*\)$pattern$
    );
    if v_old_call is null and v_new_call is null then
      raise exception 'media_quota_default: % does not hold the old default', v_fn;
    end if;
    if v_old_call is not null then
      v_new := replace(v_def, v_old_call, replace(v_old_call, '5120', '10240'));
      execute v_new;
    end if;
  end loop;
end
$$;

commit;

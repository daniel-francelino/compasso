create schema tap;
grant usage on schema tap to public;

create function tap.counter() returns int language plpgsql as $$
declare v int := coalesce(nullif(current_setting('tap.n', true), ''), '0')::int + 1;
begin
  perform set_config('tap.n', v::text, false);
  return v;
end;
$$;

create function public.plan(n int) returns text language sql as $$ select '1..' || n $$;

create function public.ok(passed boolean, descr text default '') returns text language plpgsql as $$
begin
  return case when coalesce(passed, false) then 'ok ' else 'not ok ' end || tap.counter() || ' - ' || coalesce(descr, '');
end;
$$;

create function public.is(got anyelement, want anyelement, descr text default '') returns text language plpgsql as $$
begin
  if got is not distinct from want then return public.ok(true, descr); end if;
  return public.ok(false, descr) || ' # got: ' || coalesce(got::text, 'NULL') || ' want: ' || coalesce(want::text, 'NULL');
end;
$$;

create function public.isnt(got anyelement, want anyelement, descr text default '') returns text language plpgsql as $$
begin
  return public.ok(got is distinct from want, descr);
end;
$$;

create function public.lives_ok(code text, descr text default '') returns text language plpgsql as $$
begin
  execute code;
  return public.ok(true, descr);
exception when others then
  return public.ok(false, descr) || ' # raised: ' || sqlerrm;
end;
$$;

create function public.throws_ok(code text, want_state text, want_msg text, descr text) returns text language plpgsql as $$
declare v_state text; v_msg text;
begin
  execute code;
  return public.ok(false, descr) || ' # nothing was raised';
exception when others then
  get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
  if (want_state is null or v_state = want_state) and (want_msg is null or v_msg = want_msg) then
    return public.ok(true, descr);
  end if;
  return public.ok(false, descr) || ' # raised ' || v_state || ': ' || v_msg;
end;
$$;

create function public.throws_ok(code text, want text, descr text default '') returns text language plpgsql as $$
begin
  if length(want) = 5 and want ~ '^[0-9A-Z]{5}$' then
    return public.throws_ok(code, want, null, descr);
  end if;
  return public.throws_ok(code, null, want, descr);
end;
$$;

create function public.finish() returns text language sql as $$ select '# done' $$;

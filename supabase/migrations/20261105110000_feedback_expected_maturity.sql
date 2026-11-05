begin;

create function public.feedback_brand_asked(p_brand uuid, p_period date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand public.brands;
  v_local timestamp;
  v_mature timestamp;
  v_open timestamp;
  v_end timestamp;
begin
  select * into v_brand from public.brands b where b.id = p_brand;
  if not found then
    return false;
  end if;
  v_local := now() at time zone v_brand.timezone;
  v_mature := (v_brand.created_at at time zone v_brand.timezone) + interval '1 month';
  v_open := (p_period + interval '1 month') + make_interval(days => public.feedback_policy_open_day() - 1);
  v_end := p_period + interval '2 months';
  if v_mature >= v_end then
    return false;
  end if;
  if v_local < greatest(v_open, v_mature) then
    return false;
  end if;
  if v_local < v_end and not public.feedback_policy_enabled() then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.feedback_expected(p_brand uuid, p_period date)
returns table (brand_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select bm.brand_id, bm.user_id
  from public.brand_members bm
  where bm.kind = 'external'
    and (p_brand is null or bm.brand_id = p_brand)
    and public.can_access_brand(bm.brand_id)
    and public.feedback_member_eligible(bm.brand_id, bm.user_id, p_period)
    and public.feedback_brand_has_work(bm.brand_id, p_period)
    and public.feedback_brand_asked(bm.brand_id, p_period)
$$;

revoke execute on function public.feedback_brand_asked(uuid, date) from public, anon, authenticated;

commit;

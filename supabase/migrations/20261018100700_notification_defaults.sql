begin;

create function public.notification_kind_save(
  p_kind text,
  p_default_lead_days int[],
  p_default_email boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.notification_kinds;
begin
  perform public.assert_action('notifications.configure');
  select * into v_kind from public.notification_kinds k where k.kind = p_kind and k.available;
  if not found then
    raise exception 'not_found';
  end if;
  if p_default_lead_days is not null and not (
    cardinality(p_default_lead_days) between 1 and 5
    and 0 <= all (p_default_lead_days)
    and 30 >= all (p_default_lead_days)
  ) then
    raise exception 'invalid_input';
  end if;
  if p_default_lead_days is not null and not v_kind.schedulable then
    raise exception 'invalid_input';
  end if;

  update public.notification_kinds
  set default_lead_days = coalesce(p_default_lead_days, default_lead_days),
      default_email = coalesce(p_default_email, default_email)
  where kind = p_kind;

  perform public.audit_write(public.current_organization_id(), null, 'settings.policy_changed',
    'organization_setting', null, jsonb_build_object('key', 'notifications.' || p_kind));
end;
$$;

revoke execute on function public.notification_kind_save(text, int[], boolean) from public, anon;
grant execute on function public.notification_kind_save(text, int[], boolean) to authenticated;

commit;

begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('feedback.view', 'feedback', 'Read the monthly feedback of the clients', false, false, '{brands.view}'),
  ('feedback.answer', 'feedback', 'Answer the monthly feedback survey in the portal', false, true, '{portal.view}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, a.key
from public.roles r
join (values
  ('manager', 'feedback.view'),
  ('external_approver', 'feedback.answer'),
  ('external_commenter', 'feedback.answer')
) as a (role_key, key) on a.role_key = r.key
on conflict do nothing;

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
values
  ('feedback.received', 'Novo feedback de cliente', 'feedback.view', 'info', null, false, false, false, true)
on conflict (kind) do nothing;

create table public.feedback_responses (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  respondent_id uuid not null references public.profiles (id),
  period_month date not null check (extract(day from period_month) = 1),
  status text not null default 'snoozed' check (status in ('snoozed', 'answered', 'declined')),
  snoozed_until timestamptz,
  snooze_count smallint not null default 0 check (snooze_count between 0 and 3),
  score_overall smallint check (score_overall between 1 and 5),
  score_quality smallint check (score_quality between 1 and 5),
  score_communication smallint check (score_communication between 1 and 5),
  score_deadlines smallint check (score_deadlines between 1 and 5),
  score_results smallint check (score_results between 1 and 5),
  highlight text check (highlight is null or char_length(highlight) between 1 and 1000),
  improvement text check (improvement is null or char_length(improvement) between 1 and 1000),
  form_version smallint not null default 1,
  timezone text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, respondent_id, period_month),
  foreign key (brand_id, respondent_id) references public.brand_members (brand_id, user_id),
  check (
    status = 'answered' or (
      score_overall is null and score_quality is null and score_communication is null
      and score_deadlines is null and score_results is null
      and highlight is null and improvement is null and answered_at is null
    )
  ),
  check (status <> 'answered' or (score_overall is not null and answered_at is not null and timezone is not null)),
  check (status = 'snoozed' or snoozed_until is null)
);

create index feedback_responses_brand_idx on public.feedback_responses (brand_id, period_month);
create index feedback_responses_respondent_idx on public.feedback_responses (respondent_id, period_month);

alter table public.feedback_responses enable row level security;

create policy feedback_responses_read on public.feedback_responses for select
  using (public.has_action('feedback.view') and public.can_access_brand(brand_id));

revoke all on public.feedback_responses from public, anon, authenticated;
grant select on public.feedback_responses to authenticated;

create trigger feedback_responses_set_updated_at before update on public.feedback_responses
for each row execute function public.set_updated_at();

create function public.feedback_responses_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('answered', 'declined') then
    raise exception 'feedback_already_answered';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger feedback_responses_guard before update or delete on public.feedback_responses
for each row execute function public.feedback_responses_guard();

create or replace function public.organization_setting_save(p_key text, p_value jsonb, p_expected_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.organization_settings;
  v_version int;
begin
  perform public.assert_action('settings.manage');
  if p_key not in (
    'policies.approvals', 'policies.calendar', 'policies.uploads', 'policies.urls',
    'policies.retention', 'policies.invitations', 'policies.security', 'policies.email',
    'policies.feedback'
  ) or jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid_input';
  end if;

  select * into v_current from public.organization_settings s where s.key = p_key for update;
  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'conflict';
    end if;
    insert into public.organization_settings (key, value, updated_by)
    values (p_key, p_value, auth.uid())
    returning version into v_version;
  else
    if p_expected_version is distinct from v_current.version then
      raise exception 'conflict';
    end if;
    update public.organization_settings
    set value = p_value, version = version + 1, updated_by = auth.uid()
    where key = p_key
    returning version into v_version;
  end if;

  perform public.audit_write(public.current_organization_id(), null, 'settings.policy_changed',
    'organization_setting', null, jsonb_build_object('key', p_key));
  return jsonb_build_object('key', p_key, 'version', v_version);
end;
$$;

create function public.feedback_policy_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value ->> 'enabled')::boolean from public.organization_settings s where s.key = 'policies.feedback'),
    true
  )
$$;

create function public.feedback_policy_open_day()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select least(greatest(coalesce(
    (select (s.value ->> 'openDay')::int from public.organization_settings s where s.key = 'policies.feedback'),
    1
  ), 1), 28)
$$;

create function public.feedback_brand_has_work(p_brand uuid, p_period date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.approval_requests ar
    join public.brands b on b.id = ar.brand_id
    where ar.brand_id = p_brand
      and ar.status <> 'cancelled'
      and (ar.requested_at at time zone b.timezone)::date >= p_period
      and (ar.requested_at at time zone b.timezone)::date < (p_period + interval '1 month')::date
  )
$$;

create function public.feedback_period_for(p_brand uuid, p_now timestamptz default now())
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_brand public.brands;
  v_local timestamp;
  v_period date;
begin
  if not public.feedback_policy_enabled() then
    return null;
  end if;
  select * into v_brand from public.brands b where b.id = p_brand;
  if not found then
    return null;
  end if;
  v_local := p_now at time zone v_brand.timezone;
  if extract(day from v_local)::int < public.feedback_policy_open_day() then
    return null;
  end if;
  if (v_brand.created_at at time zone v_brand.timezone) + interval '1 month' > v_local then
    return null;
  end if;
  v_period := (date_trunc('month', v_local) - interval '1 month')::date;
  if not public.feedback_brand_has_work(p_brand, v_period) then
    return null;
  end if;
  return v_period;
end;
$$;

create function public.feedback_member_eligible(p_brand uuid, p_user uuid, p_period date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.brand_members bm
    join public.brands b on b.id = bm.brand_id
    join public.profiles p on p.id = bm.user_id
    join public.role_actions ra on ra.role_id = p.role_id and ra.action_key = 'feedback.answer'
    where bm.brand_id = p_brand and bm.user_id = p_user
      and bm.kind = 'external' and bm.status = 'active'
      and p.status = 'approved' and p.kind = 'external'
      and (bm.granted_at at time zone b.timezone)::date < (p_period + interval '1 month')::date
  )
$$;

create function public.feedback_expected(p_brand uuid, p_period date)
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
$$;

create function public.feedback_score(p_answers jsonb, p_key text, p_required boolean)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value jsonb := p_answers -> p_key;
begin
  if v_value is null or jsonb_typeof(v_value) = 'null' then
    if p_required then
      raise exception 'invalid_input';
    end if;
    return null;
  end if;
  if jsonb_typeof(v_value) <> 'number' or (v_value #>> '{}')::numeric not in (1, 2, 3, 4, 5) then
    raise exception 'invalid_input';
  end if;
  return (v_value #>> '{}')::numeric::smallint;
end;
$$;

create function public.feedback_text(p_answers jsonb, p_key text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value jsonb := p_answers -> p_key;
  v_text text;
begin
  if v_value is null or jsonb_typeof(v_value) = 'null' then
    return null;
  end if;
  if jsonb_typeof(v_value) <> 'string' then
    raise exception 'invalid_input';
  end if;
  v_text := btrim(v_value #>> '{}');
  if v_text = '' then
    return null;
  end if;
  if char_length(v_text) > 1000 then
    raise exception 'invalid_input';
  end if;
  return v_text;
end;
$$;

create function public.feedback_lock_row(p_brand uuid, p_period date)
returns public.feedback_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open date;
  v_row public.feedback_responses;
begin
  perform public.portal_assert_member(p_brand);
  if not public.has_action('feedback.answer') then
    raise exception 'denied';
  end if;
  v_open := public.feedback_period_for(p_brand, now());
  if v_open is null or p_period is distinct from v_open
     or not public.feedback_member_eligible(p_brand, auth.uid(), v_open) then
    raise exception 'feedback_not_open';
  end if;
  insert into public.feedback_responses (brand_id, respondent_id, period_month)
  values (p_brand, auth.uid(), v_open)
  on conflict (brand_id, respondent_id, period_month) do nothing;
  select * into v_row from public.feedback_responses r
  where r.brand_id = p_brand and r.respondent_id = auth.uid() and r.period_month = v_open
  for update;
  if v_row.status in ('answered', 'declined') then
    raise exception 'feedback_already_answered';
  end if;
  return v_row;
end;
$$;

create function public.portal_feedback_prompt(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_period date;
  v_row public.feedback_responses;
begin
  perform public.portal_assert_member(p_brand);
  if not public.has_action('feedback.answer') then
    raise exception 'denied';
  end if;
  v_period := public.feedback_period_for(p_brand, now());
  if v_period is null or not public.feedback_member_eligible(p_brand, auth.uid(), v_period) then
    return jsonb_build_object('state', 'none');
  end if;
  select * into v_row from public.feedback_responses r
  where r.brand_id = p_brand and r.respondent_id = auth.uid() and r.period_month = v_period;
  if found then
    if v_row.status in ('answered', 'declined') then
      return jsonb_build_object('state', 'none');
    end if;
    if v_row.snooze_count >= 3 then
      return jsonb_build_object('state', 'banner', 'period_month', v_period, 'snooze_count', v_row.snooze_count);
    end if;
    if v_row.snoozed_until is not null and v_row.snoozed_until > now() then
      return jsonb_build_object('state', 'none');
    end if;
  end if;
  return jsonb_build_object(
    'state', 'due', 'period_month', v_period, 'snooze_count', coalesce(v_row.snooze_count, 0)
  );
end;
$$;

create function public.portal_feedback_snooze(p_brand uuid, p_period date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.feedback_responses;
begin
  v_row := public.feedback_lock_row(p_brand, p_period);
  update public.feedback_responses
  set snooze_count = least(v_row.snooze_count + 1, 3),
      snoozed_until = now() + interval '3 days'
  where id = v_row.id;
end;
$$;

create function public.portal_feedback_decline(p_brand uuid, p_period date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.feedback_responses;
begin
  v_row := public.feedback_lock_row(p_brand, p_period);
  update public.feedback_responses
  set status = 'declined', snoozed_until = null
  where id = v_row.id;
  perform public.audit_write(
    public.current_organization_id(), p_brand, 'feedback.declined', 'feedback_response', v_row.id,
    jsonb_build_object('period_month', p_period)
  );
end;
$$;

create function public.portal_feedback_submit(p_brand uuid, p_period date, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.feedback_responses;
  v_brand public.brands;
  v_overall smallint;
  v_months constant text[] := array[
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
    'outubro', 'novembro', 'dezembro'
  ];
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_input';
  end if;
  v_row := public.feedback_lock_row(p_brand, p_period);
  v_overall := public.feedback_score(p_answers, 'overall', true);
  select * into v_brand from public.brands b where b.id = p_brand;

  update public.feedback_responses
  set status = 'answered',
      snoozed_until = null,
      score_overall = v_overall,
      score_quality = public.feedback_score(p_answers, 'quality', false),
      score_communication = public.feedback_score(p_answers, 'communication', false),
      score_deadlines = public.feedback_score(p_answers, 'deadlines', false),
      score_results = public.feedback_score(p_answers, 'results', false),
      highlight = public.feedback_text(p_answers, 'highlight'),
      improvement = public.feedback_text(p_answers, 'improvement'),
      timezone = v_brand.timezone,
      answered_at = now()
  where id = v_row.id;

  perform public.audit_write(
    public.current_organization_id(), p_brand, 'feedback.answered', 'feedback_response', v_row.id,
    jsonb_build_object('period_month', p_period, 'overall', v_overall)
  );
  perform public.notify_users(
    'feedback.received', p_brand, 'Novo feedback de cliente',
    format(
      '%s respondeu a pesquisa de %s: nota %s.%s', v_brand.name, v_months[extract(month from p_period)::int],
      v_overall, case when v_overall <= 2 then ' Precisa de atenção.' else '' end
    ),
    '/admin/marketing/feedback?brand=' || p_brand::text || '&period=' || to_char(p_period, 'YYYY-MM'),
    'feedback_response', v_row.id, 'feedback.received:' || v_row.id::text, null
  );
  return jsonb_build_object('id', v_row.id);
end;
$$;

create function public.feedback_list(
  p_brand uuid,
  p_period date,
  p_status text,
  p_attention boolean,
  p_page int,
  p_page_size int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_size int := least(greatest(coalesce(p_page_size, 12), 1), 50);
  v_offset int := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  v_attention boolean := coalesce(p_attention, false);
  v_total int;
  v_rows jsonb;
begin
  perform public.assert_action('feedback.view');
  if p_brand is not null then
    perform public.assert_brand_access(p_brand);
  end if;
  if p_period is null or extract(day from p_period) <> 1 or p_status is null or p_status not in ('answered', 'pending') then
    raise exception 'invalid_input';
  end if;

  if p_status = 'answered' then
    with base as (
      select fr.id, fr.brand_id, b.name as brand_name, c.name as client_name, fr.respondent_id,
             p.full_name as respondent_name, fr.period_month, 'answered'::text as state,
             fr.snooze_count, fr.score_overall, fr.score_quality, fr.score_communication,
             fr.score_deadlines, fr.score_results, fr.highlight, fr.improvement, fr.answered_at,
             fr.timezone, fr.updated_at as last_interaction_at
      from public.feedback_responses fr
      join public.brands b on b.id = fr.brand_id
      join public.clients c on c.id = b.client_id
      join public.profiles p on p.id = fr.respondent_id
      where fr.status = 'answered' and fr.period_month = p_period
        and (p_brand is null or fr.brand_id = p_brand)
        and public.can_access_brand(fr.brand_id)
        and (not v_attention or fr.score_overall <= 2)
    ),
    page as (select * from base order by answered_at desc, id limit v_size offset v_offset)
    select (select count(*) from base),
           coalesce(jsonb_agg(to_jsonb(page) order by page.answered_at desc, page.id), '[]'::jsonb)
    into v_total, v_rows
    from page;
  else
    with base as (
      select null::uuid as id, e.brand_id, b.name as brand_name, c.name as client_name,
             e.user_id as respondent_id, p.full_name as respondent_name, p_period as period_month,
             case
               when fr.status = 'declined' then 'declined'
               when fr.snooze_count > 0 then 'snoozed'
               else 'not_opened'
             end as state,
             coalesce(fr.snooze_count, 0)::smallint as snooze_count,
             null::smallint as score_overall, null::smallint as score_quality,
             null::smallint as score_communication, null::smallint as score_deadlines,
             null::smallint as score_results, null::text as highlight, null::text as improvement,
             null::timestamptz as answered_at, b.timezone, fr.updated_at as last_interaction_at
      from public.feedback_expected(p_brand, p_period) e
      join public.brands b on b.id = e.brand_id
      join public.clients c on c.id = b.client_id
      join public.profiles p on p.id = e.user_id
      left join public.feedback_responses fr
        on fr.brand_id = e.brand_id and fr.respondent_id = e.user_id and fr.period_month = p_period
      where fr.status is distinct from 'answered'
    ),
    page as (select * from base order by brand_name, respondent_name, respondent_id limit v_size offset v_offset)
    select (select count(*) from base),
           coalesce(jsonb_agg(to_jsonb(page) order by page.brand_name, page.respondent_name, page.respondent_id), '[]'::jsonb)
    into v_total, v_rows
    from page;
  end if;
  return jsonb_build_object('total', coalesce(v_total, 0), 'rows', v_rows);
end;
$$;

create function public.feedback_summary(p_brand uuid, p_period date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_previous date;
  v_current record;
  v_previous_average numeric;
  v_expected int;
  v_pending int;
begin
  perform public.assert_action('feedback.view');
  if p_brand is not null then
    perform public.assert_brand_access(p_brand);
  end if;
  if p_period is null or extract(day from p_period) <> 1 then
    raise exception 'invalid_input';
  end if;
  v_previous := (p_period - interval '1 month')::date;

  select count(*) as answered,
         count(*) filter (where fr.score_overall <= 2) as attention,
         round(avg(fr.score_overall), 1) as average_overall,
         round(avg(fr.score_quality), 1) as average_quality,
         round(avg(fr.score_communication), 1) as average_communication,
         round(avg(fr.score_deadlines), 1) as average_deadlines,
         round(avg(fr.score_results), 1) as average_results
  into v_current
  from public.feedback_responses fr
  where fr.status = 'answered' and fr.period_month = p_period
    and (p_brand is null or fr.brand_id = p_brand)
    and public.can_access_brand(fr.brand_id);

  select round(avg(fr.score_overall), 1) into v_previous_average
  from public.feedback_responses fr
  where fr.status = 'answered' and fr.period_month = v_previous
    and (p_brand is null or fr.brand_id = p_brand)
    and public.can_access_brand(fr.brand_id);

  select count(*), count(*) filter (where fr.status is distinct from 'answered')
  into v_expected, v_pending
  from public.feedback_expected(p_brand, p_period) e
  left join public.feedback_responses fr
    on fr.brand_id = e.brand_id and fr.respondent_id = e.user_id and fr.period_month = p_period;

  return jsonb_build_object(
    'period_month', p_period,
    'answered', v_current.answered,
    'expected', v_expected,
    'pending', v_pending,
    'attention', v_current.attention,
    'average_overall', v_current.average_overall,
    'average_quality', v_current.average_quality,
    'average_communication', v_current.average_communication,
    'average_deadlines', v_current.average_deadlines,
    'average_results', v_current.average_results,
    'previous_average_overall', v_previous_average
  );
end;
$$;

revoke execute on function
  public.feedback_responses_guard(), public.feedback_policy_enabled(), public.feedback_policy_open_day(),
  public.feedback_brand_has_work(uuid, date), public.feedback_period_for(uuid, timestamptz),
  public.feedback_member_eligible(uuid, uuid, date), public.feedback_expected(uuid, date),
  public.feedback_score(jsonb, text, boolean), public.feedback_text(jsonb, text),
  public.feedback_lock_row(uuid, date)
from public, anon, authenticated;

revoke execute on function
  public.portal_feedback_prompt(uuid), public.portal_feedback_snooze(uuid, date),
  public.portal_feedback_decline(uuid, date), public.portal_feedback_submit(uuid, date, jsonb),
  public.feedback_list(uuid, date, text, boolean, int, int), public.feedback_summary(uuid, date)
from public, anon;
grant execute on function
  public.portal_feedback_prompt(uuid), public.portal_feedback_snooze(uuid, date),
  public.portal_feedback_decline(uuid, date), public.portal_feedback_submit(uuid, date, jsonb),
  public.feedback_list(uuid, date, text, boolean, int, int), public.feedback_summary(uuid, date)
to authenticated;

create or replace function public.audit_write(
  p_org uuid,
  p_brand uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_catalog constant text[] := array[
    'invitation.created',
    'invitation.revoked',
    'invitation.accepted',
    'client.created',
    'client.updated',
    'client.owner_changed',
    'client.archived',
    'client.reactivated',
    'client.deleted',
    'contact.created',
    'contact.updated',
    'contact.deleted',
    'brand.created',
    'brand.updated',
    'brand.timezone_changed',
    'brand.archived',
    'brand.reactivated',
    'brand.deleted',
    'brand.member_added',
    'brand.member_revoked',
    'brand.member_can_decide_changed',
    'channel.created',
    'channel.updated',
    'channel.archived',
    'channel.reactivated',
    'channel.deleted',
    'content.created',
    'content.updated',
    'content.submitted',
    'content.reopened',
    'content.cancelled',
    'content.published',
    'content.deleted',
    'content_channel.added',
    'content_channel.removed',
    'content_channel.rescheduled',
    'content_channel.published_manually',
    'content_channel.cancelled',
    'calendar_note.created',
    'calendar_note.updated',
    'calendar_note.archived',
    'calendar_note.converted',
    'variant.created',
    'variant.updated',
    'variant.submitted',
    'variant.reopened',
    'variant.rescheduled',
    'variant.cancelled',
    'variant.published_manually',
    'comment.created',
    'comment.deleted',
    'comment.edited',
    'approval.requested',
    'approval.decided',
    'approval.superseded',
    'approval.approved_by_team',
    'approval.cancelled',
    'approval.approver_reassigned',
    'approval.reminder_sent',
    'media.published',
    'media.unpublished',
    'media.deleted_permanently',
    'media.version_replaced',
    'media.share_created',
    'media.share_revoked',
    'site.page_published',
    'site.page_unpublished',
    'site.rolled_back',
    'site.case_study_authorized',
    'site.case_study_withdrawn',
    'site.settings_changed',
    'settings.policy_changed',
    'content_type.saved',
    'content_type.archived',
    'organization.updated',
    'channel.connected',
    'channel.disconnected',
    'channel.connection_lost',
    'content_channel.published_auto',
    'content_channel.publish_failed',
    'content_channel.publish_mode_changed',
    'content_channel.publish_requested',
    'metric_mark.created',
    'metric_mark.updated',
    'metric_mark.deleted',
    'metrics_report.published',
    'metrics_report.withdrawn',
    'feedback.answered',
    'feedback.declined',
    'audit.exported'
  ];
  v_actor uuid := auth.uid();
  v_kind text;
  v_request text;
begin
  if not (p_action = any (v_catalog)) then
    raise exception 'invalid_input';
  end if;

  if v_actor is null then
    v_kind := 'system';
  else
    select p.kind into v_kind from public.profiles p where p.id = v_actor;
    v_kind := coalesce(v_kind, 'internal');
  end if;

  begin
    v_request := (current_setting('request.headers', true)::jsonb) ->> 'x-request-id';
  exception when others then
    v_request := null;
  end;

  insert into public.audit_events (
    organization_id, brand_id, actor_id, actor_kind, action, entity_type, entity_id, metadata,
    request_id
  )
  values (
    p_org, p_brand, v_actor, v_kind, p_action, p_entity_type, p_entity_id,
    coalesce(p_metadata, '{}'::jsonb), v_request
  );
end;
$$;

commit;

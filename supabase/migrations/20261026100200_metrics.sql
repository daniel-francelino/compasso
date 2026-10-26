begin;

insert into public.actions (key, module, description, admin_only, portal, requires)
values
  ('metrics.view', 'metrics', 'View social metrics', false, false, '{brands.view}'),
  ('metrics.report', 'metrics', 'Write metric notes and publish reports to the client', false, false, '{metrics.view}'),
  ('metrics.portal_view', 'metrics', 'Read published result reports in the portal', false, true, '{portal.view}')
on conflict (key) do nothing;

insert into public.role_actions (role_id, action_key)
select r.id, a.key
from public.roles r
join (values
  ('manager', 'metrics.view'),
  ('manager', 'metrics.report'),
  ('collaborator', 'metrics.view'),
  ('external_approver', 'metrics.portal_view'),
  ('external_commenter', 'metrics.portal_view')
) as a (role_key, key) on a.role_key = r.key
on conflict do nothing;

insert into public.notification_kinds (
  kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email,
  available
)
values
  ('metrics.report_published', 'Novo relatório de resultados', 'metrics.portal_view', 'info', null, false, true, true, true)
on conflict (kind) do nothing;

create table public.channel_metric_daily (
  channel_id uuid not null,
  brand_id uuid not null,
  day date not null,
  metric text not null check (metric in (
    'followers_total', 'follows', 'unfollows', 'reach', 'views', 'profile_views',
    'accounts_engaged', 'interactions', 'likes', 'comments', 'saves', 'shares', 'profile_link_taps'
  )),
  value numeric not null check (value >= 0),
  captured_at timestamptz not null default now(),
  primary key (channel_id, metric, day),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id)
);

create index channel_metric_daily_brand_idx on public.channel_metric_daily (brand_id, day);

create table public.channel_audience_snapshot (
  channel_id uuid not null,
  brand_id uuid not null,
  captured_on date not null,
  dimension text not null check (dimension in ('age_gender', 'city', 'country', 'online_hours')),
  breakdown jsonb not null check (jsonb_typeof(breakdown) in ('object', 'array')),
  primary key (channel_id, captured_on, dimension),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id)
);

create table public.channel_media_index (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  brand_id uuid not null,
  external_media_id text not null check (char_length(external_media_id) between 1 and 80),
  permalink text check (permalink is null or permalink ~ '^https://'),
  media_type text not null check (char_length(media_type) <= 40),
  product_type text check (product_type is null or char_length(product_type) <= 40),
  posted_at timestamptz not null,
  caption_excerpt text check (caption_excerpt is null or char_length(caption_excerpt) <= 200),
  content_channel_id uuid,
  created_at timestamptz not null default now(),
  unique (channel_id, external_media_id),
  unique (id, brand_id),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id),
  foreign key (content_channel_id, brand_id) references public.content_channels (id, brand_id)
);

create index channel_media_index_posted_idx on public.channel_media_index (channel_id, posted_at desc);

create table public.content_channel_metrics (
  id uuid primary key default gen_random_uuid(),
  media_index_id uuid not null,
  brand_id uuid not null,
  age_bucket text not null check (age_bucket in ('h1', 'h24', 'd7', 'd30', 'story_final')),
  captured_at timestamptz not null default now(),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  unique (media_index_id, age_bucket),
  foreign key (media_index_id, brand_id) references public.channel_media_index (id, brand_id)
);

create table public.metric_marks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  channel_id uuid,
  kind text not null check (kind in ('campaign', 'viral_post', 'partnership', 'event', 'other')),
  label text not null check (char_length(label) between 2 and 140),
  starts_on date not null,
  ends_on date,
  content_item_id uuid,
  version int not null default 1,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id),
  foreign key (content_item_id, brand_id) references public.content_items (id, brand_id),
  check (ends_on is null or ends_on >= starts_on)
);

create index metric_marks_brand_idx on public.metric_marks (brand_id, starts_on);

create table public.metric_reports (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id),
  channel_id uuid not null,
  period_start date not null,
  period_end date not null,
  compare_mode text not null default 'previous' check (compare_mode in ('previous', 'year', 'none')),
  title text not null check (char_length(title) between 2 and 140),
  message text check (message is null or char_length(message) <= 2000),
  next_steps jsonb not null default '[]' check (
    jsonb_typeof(next_steps) = 'array' and jsonb_array_length(next_steps) <= 5
  ),
  blocks jsonb not null default '[]' check (
    jsonb_typeof(blocks) = 'array' and jsonb_array_length(blocks) <= 20
  ),
  snapshot jsonb check (
    snapshot is null or (jsonb_typeof(snapshot) = 'object' and char_length(snapshot::text) <= 300000)
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'withdrawn')),
  version int not null default 1,
  previous_report_id uuid references public.metric_reports (id),
  created_by uuid references public.profiles (id),
  published_by uuid references public.profiles (id),
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (channel_id, brand_id) references public.channels (id, brand_id),
  check (period_end >= period_start and period_end - period_start <= 366),
  check ((status = 'draft') = (snapshot is null))
);

create index metric_reports_brand_idx on public.metric_reports (brand_id, status, period_end desc);

alter table public.channel_metric_daily enable row level security;
alter table public.channel_audience_snapshot enable row level security;
alter table public.channel_media_index enable row level security;
alter table public.content_channel_metrics enable row level security;
alter table public.metric_marks enable row level security;
alter table public.metric_reports enable row level security;

create policy channel_metric_daily_read on public.channel_metric_daily for select
  using (public.has_action('metrics.view') and public.can_access_brand(brand_id));
create policy channel_audience_snapshot_read on public.channel_audience_snapshot for select
  using (public.has_action('metrics.view') and public.can_access_brand(brand_id));
create policy channel_media_index_read on public.channel_media_index for select
  using (public.has_action('metrics.view') and public.can_access_brand(brand_id));
create policy content_channel_metrics_read on public.content_channel_metrics for select
  using (public.has_action('metrics.view') and public.can_access_brand(brand_id));
create policy metric_marks_read on public.metric_marks for select
  using (public.has_action('metrics.view') and public.can_access_brand(brand_id));
create policy metric_reports_read on public.metric_reports for select
  using (public.has_action('metrics.view') and public.can_access_brand(brand_id));

revoke all on public.channel_metric_daily, public.channel_audience_snapshot,
  public.channel_media_index, public.content_channel_metrics, public.metric_marks,
  public.metric_reports from public, anon, authenticated;
grant select on public.channel_metric_daily, public.channel_audience_snapshot,
  public.channel_media_index, public.content_channel_metrics, public.metric_marks,
  public.metric_reports to authenticated;

create trigger metric_marks_set_updated_at before update on public.metric_marks
for each row execute function public.set_updated_at();
create trigger metric_reports_set_updated_at before update on public.metric_reports
for each row execute function public.set_updated_at();

create function public.metric_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' then
    return new;
  end if;
  if old.status = 'published' and new.status = 'withdrawn'
    and new.snapshot = old.snapshot and new.period_start = old.period_start
    and new.period_end = old.period_end and new.title = old.title
    and new.message is not distinct from old.message
    and new.blocks = old.blocks and new.next_steps = old.next_steps then
    return new;
  end if;
  raise exception 'report_already_published';
end;
$$;

create trigger metric_reports_guard before update on public.metric_reports
for each row execute function public.metric_reports_guard();

create function public.metric_reports_no_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'report_already_published';
  end if;
  return old;
end;
$$;

create trigger metric_reports_no_delete before delete on public.metric_reports
for each row execute function public.metric_reports_no_delete();

create function public.metrics_assert_read(p_brand uuid, p_channel uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('metrics.view');
  perform public.assert_brand_access(p_brand);
  if not exists (
    select 1 from public.channels c where c.id = p_channel and c.brand_id = p_brand
  ) then
    raise exception 'not_found';
  end if;
end;
$$;

create function public.metrics_totals(p_channel uuid, p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      q.metric,
      jsonb_build_object(
        'sum', q.total,
        'avg', round(q.total / q.days, 2),
        'days', q.days,
        'first', q.first_value,
        'last', q.last_value
      )
    ),
    '{}'::jsonb
  )
  from (
    select d.metric,
      sum(d.value) as total,
      count(*)::int as days,
      (array_agg(d.value order by d.day asc))[1] as first_value,
      (array_agg(d.value order by d.day desc))[1] as last_value
    from public.channel_metric_daily d
    where d.channel_id = p_channel and d.day between p_from and p_to
    group by d.metric
  ) q
$$;

create function public.metrics_overview(
  p_brand uuid,
  p_channel uuid,
  p_from date,
  p_to date,
  p_compare text,
  p_granularity text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_days int;
  v_prev_from date;
  v_prev_to date;
  v_series jsonb;
begin
  perform public.metrics_assert_read(p_brand, p_channel);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366
    or p_compare not in ('previous', 'year', 'none') or p_granularity not in ('day', 'week', 'month') then
    raise exception 'invalid_input';
  end if;
  select b.timezone into v_tz from public.brands b where b.id = p_brand;
  v_days := p_to - p_from + 1;
  if p_compare = 'previous' then
    v_prev_to := p_from - 1;
    v_prev_from := v_prev_to - (v_days - 1);
  elsif p_compare = 'year' then
    v_prev_from := (p_from - interval '1 year')::date;
    v_prev_to := (p_to - interval '1 year')::date;
  end if;

  select coalesce(jsonb_object_agg(s.metric, s.points), '{}'::jsonb) into v_series
  from (
    select q.metric,
      jsonb_agg(jsonb_build_object('start', q.bucket, 'value', q.v) order by q.bucket) as points
    from (
      select d.metric,
        date_trunc(p_granularity, d.day)::date as bucket,
        case when d.metric = 'followers_total'
          then (array_agg(d.value order by d.day desc))[1]
          else sum(d.value)
        end as v
      from public.channel_metric_daily d
      where d.channel_id = p_channel and d.day between p_from and p_to
      group by d.metric, date_trunc(p_granularity, d.day)::date
    ) q
    group by q.metric
  ) s;

  return jsonb_build_object(
    'timezone', v_tz,
    'from', p_from,
    'to', p_to,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'granularity', p_granularity,
    'first_day', (select min(d.day) from public.channel_metric_daily d where d.channel_id = p_channel),
    'last_day', (select max(d.day) from public.channel_metric_daily d where d.channel_id = p_channel),
    'totals', public.metrics_totals(p_channel, p_from, p_to),
    'previous_totals', case
      when v_prev_from is null then null
      else public.metrics_totals(p_channel, v_prev_from, v_prev_to)
    end,
    'series', v_series,
    'previous_series', case
      when v_prev_from is null then null
      else (
        select coalesce(jsonb_object_agg(s.metric, s.points), '{}'::jsonb)
        from (
          select q.metric,
            jsonb_agg(jsonb_build_object('start', q.bucket, 'value', q.v) order by q.bucket) as points
          from (
            select d.metric,
              date_trunc(p_granularity, d.day)::date as bucket,
              case when d.metric = 'followers_total'
                then (array_agg(d.value order by d.day desc))[1]
                else sum(d.value)
              end as v
            from public.channel_metric_daily d
            where d.channel_id = p_channel and d.day between v_prev_from and v_prev_to
            group by d.metric, date_trunc(p_granularity, d.day)::date
          ) q
          group by q.metric
        ) s
      )
    end,
    'posts_published', (
      select count(*)::int from public.channel_media_index m
      where m.channel_id = p_channel and (m.posted_at at time zone v_tz)::date between p_from and p_to
    ),
    'previous_posts_published', case
      when v_prev_from is null then null
      else (
        select count(*)::int from public.channel_media_index m
        where m.channel_id = p_channel
          and (m.posted_at at time zone v_tz)::date between v_prev_from and v_prev_to
      )
    end
  );
end;
$$;

create function public.metrics_top_posts(
  p_brand uuid,
  p_channel uuid,
  p_from date,
  p_to date,
  p_by text,
  p_limit int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  perform public.metrics_assert_read(p_brand, p_channel);
  if p_by not in ('reach', 'interactions', 'saves', 'shares', 'views', 'likes', 'comments')
    or p_limit is null or p_limit not between 1 and 20 or p_from is null or p_to is null then
    raise exception 'invalid_input';
  end if;
  select b.timezone into v_tz from public.brands b where b.id = p_brand;
  return coalesce(
    (
      select jsonb_agg(x.obj order by x.score desc nulls last, x.posted_at desc)
      from (
        select
          coalesce((l.metrics ->> p_by)::numeric, 0) as score,
          m.posted_at,
          jsonb_build_object(
            'external_media_id', m.external_media_id,
            'permalink', m.permalink,
            'media_type', m.media_type,
            'product_type', m.product_type,
            'posted_at', m.posted_at,
            'caption_excerpt', m.caption_excerpt,
            'metrics', coalesce(l.metrics, '{}'::jsonb),
            'age_bucket', l.age_bucket,
            'content_channel_id', m.content_channel_id,
            'item_id', r.content_item_id,
            'item_title', i.title
          ) as obj
        from public.channel_media_index m
        left join lateral (
          select c.metrics, c.age_bucket
          from public.content_channel_metrics c
          where c.media_index_id = m.id
          order by c.captured_at desc
          limit 1
        ) l on true
        left join public.content_channels r on r.id = m.content_channel_id
        left join public.content_items i on i.id = r.content_item_id
        where m.channel_id = p_channel
          and (m.posted_at at time zone v_tz)::date between p_from and p_to
        order by coalesce((l.metrics ->> p_by)::numeric, 0) desc, m.posted_at desc
        limit p_limit
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.metrics_breakdown(
  p_brand uuid,
  p_channel uuid,
  p_from date,
  p_to date,
  p_dimension text,
  p_by text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  perform public.metrics_assert_read(p_brand, p_channel);
  if p_dimension not in ('format', 'weekday', 'hour')
    or p_by not in ('reach', 'interactions', 'saves', 'shares', 'views', 'likes', 'comments')
    or p_from is null or p_to is null then
    raise exception 'invalid_input';
  end if;
  select b.timezone into v_tz from public.brands b where b.id = p_brand;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('key', g.key, 'posts', g.posts, 'average', round(g.average, 2), 'total', g.total)
        order by g.key
      )
      from (
        select
          case p_dimension
            when 'format' then coalesce(nullif(m.product_type, ''), m.media_type)
            when 'weekday' then extract(isodow from (m.posted_at at time zone v_tz))::int::text
            else extract(hour from (m.posted_at at time zone v_tz))::int::text
          end as key,
          count(*)::int as posts,
          avg(coalesce((l.metrics ->> p_by)::numeric, 0)) as average,
          sum(coalesce((l.metrics ->> p_by)::numeric, 0)) as total
        from public.channel_media_index m
        left join lateral (
          select c.metrics from public.content_channel_metrics c
          where c.media_index_id = m.id order by c.captured_at desc limit 1
        ) l on true
        where m.channel_id = p_channel
          and (m.posted_at at time zone v_tz)::date between p_from and p_to
        group by 1
      ) g
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.metrics_audience(p_brand uuid, p_channel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.metrics_assert_read(p_brand, p_channel);
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('dimension', s.dimension, 'captured_on', s.captured_on, 'breakdown', s.breakdown)
        order by s.dimension, s.captured_on desc
      )
      from (
        select a.*, row_number() over (partition by a.dimension order by a.captured_on desc) as rn
        from public.channel_audience_snapshot a
        where a.channel_id = p_channel
      ) s
      where s.rn <= 2
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.metrics_plan_summary(p_brand uuid, p_channel uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
begin
  perform public.metrics_assert_read(p_brand, p_channel);
  select b.timezone into v_tz from public.brands b where b.id = p_brand;
  return (
    select jsonb_build_object(
      'planned', count(*)::int,
      'published', count(*) filter (where r.publication_status = 'published_manually')::int,
      'automatic', count(*) filter (where r.publish_mode = 'automatic')::int,
      'published_automatically', count(*) filter (where r.published_via = 'instagram_api')::int,
      'failed', count(*) filter (where r.auto_publish_state = 'failed')::int
    )
    from public.content_channels r
    where r.channel_id = p_channel and r.publication_status <> 'cancelled'
      and r.planned_at is not null
      and (r.planned_at at time zone v_tz)::date between p_from and p_to
  );
end;
$$;

create function public.metric_marks_list(p_brand uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('metrics.view');
  perform public.assert_brand_access(p_brand);
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id, 'channel_id', m.channel_id, 'kind', m.kind, 'label', m.label,
          'starts_on', m.starts_on, 'ends_on', m.ends_on, 'content_item_id', m.content_item_id,
          'version', m.version
        )
        order by m.starts_on, m.created_at
      )
      from public.metric_marks m
      where m.brand_id = p_brand and m.starts_on <= p_to and coalesce(m.ends_on, m.starts_on) >= p_from
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.metric_mark_save(p_mark jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_mark ->> 'id', '')::uuid;
  v_brand uuid := nullif(p_mark ->> 'brand_id', '')::uuid;
  v_channel uuid := nullif(p_mark ->> 'channel_id', '')::uuid;
  v_kind text := p_mark ->> 'kind';
  v_label text := btrim(coalesce(p_mark ->> 'label', ''));
  v_starts date := nullif(p_mark ->> 'starts_on', '')::date;
  v_ends date := nullif(p_mark ->> 'ends_on', '')::date;
  v_item uuid := nullif(p_mark ->> 'content_item_id', '')::uuid;
  v_expected int := nullif(p_mark ->> 'expected_version', '')::int;
  v_old public.metric_marks;
  v_version int;
begin
  perform public.assert_action('metrics.report');
  if v_id is not null then
    select * into v_old from public.metric_marks m where m.id = v_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    v_brand := v_old.brand_id;
  end if;
  perform public.assert_brand_access(v_brand);
  if char_length(v_label) not between 2 and 140 or v_starts is null
    or v_kind not in ('campaign', 'viral_post', 'partnership', 'event', 'other')
    or (v_ends is not null and v_ends < v_starts) then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    insert into public.metric_marks (brand_id, channel_id, kind, label, starts_on, ends_on, content_item_id, created_by)
    values (v_brand, v_channel, v_kind, v_label, v_starts, v_ends, v_item, auth.uid())
    returning id, version into v_id, v_version;
    perform public.audit_write(
      public.current_organization_id(), v_brand, 'metric_mark.created', 'metric_mark', v_id,
      jsonb_build_object('kind', v_kind)
    );
  else
    if v_expected is null or v_expected <> v_old.version then
      raise exception 'conflict';
    end if;
    update public.metric_marks
    set channel_id = v_channel, kind = v_kind, label = v_label, starts_on = v_starts, ends_on = v_ends,
        content_item_id = v_item, version = version + 1
    where id = v_id
    returning version into v_version;
    perform public.audit_write(
      public.current_organization_id(), v_brand, 'metric_mark.updated', 'metric_mark', v_id,
      jsonb_build_object('kind', v_kind)
    );
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.metric_mark_delete(p_mark uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.metric_marks;
begin
  perform public.assert_action('metrics.report');
  select * into v_old from public.metric_marks m where m.id = p_mark for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  delete from public.metric_marks where id = p_mark;
  perform public.audit_write(
    public.current_organization_id(), v_old.brand_id, 'metric_mark.deleted', 'metric_mark', p_mark,
    jsonb_build_object('kind', v_old.kind)
  );
end;
$$;

create function public.metrics_report_json(r public.metric_reports, p_with_snapshot boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'brand_id', r.brand_id,
    'channel_id', r.channel_id,
    'period_start', r.period_start,
    'period_end', r.period_end,
    'compare_mode', r.compare_mode,
    'title', r.title,
    'message', r.message,
    'next_steps', r.next_steps,
    'blocks', r.blocks,
    'status', r.status,
    'version', r.version,
    'previous_report_id', r.previous_report_id,
    'published_at', r.published_at,
    'updated_at', r.updated_at
  ) || case when p_with_snapshot then jsonb_build_object('snapshot', r.snapshot) else '{}'::jsonb end
$$;

create function public.metrics_report_list(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('metrics.view');
  perform public.assert_brand_access(p_brand);
  return coalesce(
    (
      select jsonb_agg(public.metrics_report_json(r, false) order by r.period_end desc, r.created_at desc)
      from public.metric_reports r
      where r.brand_id = p_brand
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.metrics_report_get(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.metric_reports;
begin
  perform public.assert_action('metrics.view');
  select * into v_row from public.metric_reports r where r.id = p_report;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  return public.metrics_report_json(v_row, true);
end;
$$;

create function public.metrics_report_save(p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_report ->> 'id', '')::uuid;
  v_brand uuid := nullif(p_report ->> 'brand_id', '')::uuid;
  v_channel uuid := nullif(p_report ->> 'channel_id', '')::uuid;
  v_start date := nullif(p_report ->> 'period_start', '')::date;
  v_end date := nullif(p_report ->> 'period_end', '')::date;
  v_compare text := coalesce(p_report ->> 'compare_mode', 'previous');
  v_title text := btrim(coalesce(p_report ->> 'title', ''));
  v_message text := nullif(btrim(coalesce(p_report ->> 'message', '')), '');
  v_steps jsonb := coalesce(p_report -> 'next_steps', '[]'::jsonb);
  v_blocks jsonb := coalesce(p_report -> 'blocks', '[]'::jsonb);
  v_expected int := nullif(p_report ->> 'expected_version', '')::int;
  v_old public.metric_reports;
  v_version int;
begin
  perform public.assert_action('metrics.report');
  if v_id is not null then
    select * into v_old from public.metric_reports r where r.id = v_id for update;
    if not found then
      raise exception 'not_found';
    end if;
    v_brand := v_old.brand_id;
    if v_old.status <> 'draft' then
      raise exception 'report_already_published';
    end if;
    if v_expected is null or v_expected <> v_old.version then
      raise exception 'conflict';
    end if;
  end if;
  perform public.assert_brand_access(v_brand);
  if v_start is null or v_end is null or v_end < v_start or v_end - v_start > 366 then
    raise exception 'report_period_invalid';
  end if;
  if char_length(v_title) not between 2 and 140 or char_length(coalesce(v_message, '')) > 2000
    or v_compare not in ('previous', 'year', 'none')
    or jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) > 5
    or jsonb_typeof(v_blocks) <> 'array' or jsonb_array_length(v_blocks) > 20
    or not exists (select 1 from public.channels c where c.id = v_channel and c.brand_id = v_brand) then
    raise exception 'invalid_input';
  end if;

  if v_id is null then
    insert into public.metric_reports (
      brand_id, channel_id, period_start, period_end, compare_mode, title, message, next_steps,
      blocks, created_by
    )
    values (v_brand, v_channel, v_start, v_end, v_compare, v_title, v_message, v_steps, v_blocks, auth.uid())
    returning id, version into v_id, v_version;
  else
    update public.metric_reports
    set channel_id = v_channel, period_start = v_start, period_end = v_end, compare_mode = v_compare,
        title = v_title, message = v_message, next_steps = v_steps, blocks = v_blocks,
        version = version + 1
    where id = v_id
    returning version into v_version;
  end if;
  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

create function public.metrics_report_new_version(p_report uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.metric_reports;
  v_id uuid;
begin
  perform public.assert_action('metrics.report');
  select * into v_old from public.metric_reports r where r.id = p_report;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if v_old.status <> 'published' then
    raise exception 'transition_not_allowed';
  end if;
  insert into public.metric_reports (
    brand_id, channel_id, period_start, period_end, compare_mode, title, message, next_steps,
    blocks, previous_report_id, created_by
  )
  values (
    v_old.brand_id, v_old.channel_id, v_old.period_start, v_old.period_end, v_old.compare_mode,
    v_old.title, v_old.message, v_old.next_steps, v_old.blocks, v_old.id, auth.uid()
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'version', 1);
end;
$$;

create function public.metrics_report_delete(p_report uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.metric_reports;
begin
  perform public.assert_action('metrics.report');
  select * into v_old from public.metric_reports r where r.id = p_report for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_old.brand_id);
  if v_old.status <> 'draft' then
    raise exception 'report_already_published';
  end if;
  delete from public.metric_reports where id = p_report;
end;
$$;

create function public.metrics_report_publish(p_report uuid, p_expected_version int, p_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.metric_reports;
  v_version int;
begin
  perform public.assert_action('metrics.report');
  select * into v_row from public.metric_reports r where r.id = p_report for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  if v_row.status <> 'draft' then
    raise exception 'report_already_published';
  end if;
  if p_expected_version is null or p_expected_version <> v_row.version then
    raise exception 'conflict';
  end if;
  if jsonb_array_length(v_row.blocks) = 0 then
    raise exception 'report_empty';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'invalid_input';
  end if;

  if v_row.previous_report_id is not null then
    update public.metric_reports
    set status = 'withdrawn', withdrawn_at = now()
    where id = v_row.previous_report_id and status = 'published';
  end if;
  update public.metric_reports
  set status = 'published', snapshot = p_snapshot, published_by = auth.uid(), published_at = now(),
      version = version + 1
  where id = p_report
  returning version into v_version;

  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'metrics_report.published', 'metrics_report',
    p_report, jsonb_build_object('period_start', v_row.period_start, 'period_end', v_row.period_end)
  );
  perform public.notify_users(
    'metrics.report_published', v_row.brand_id, 'Novo relatório de resultados',
    format('O relatório «%s» já está disponível.', v_row.title),
    '/portal/brands/' || v_row.brand_id::text || '/metrics/' || p_report::text, 'metrics_report',
    p_report, 'metrics.report_published:' || p_report::text, null
  );
  return jsonb_build_object('id', p_report, 'version', v_version);
end;
$$;

create function public.metrics_report_withdraw(p_report uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.metric_reports;
begin
  perform public.assert_action('metrics.report');
  select * into v_row from public.metric_reports r where r.id = p_report for update;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.assert_brand_access(v_row.brand_id);
  if v_row.status <> 'published' then
    raise exception 'transition_not_allowed';
  end if;
  update public.metric_reports set status = 'withdrawn', withdrawn_at = now() where id = p_report;
  perform public.resolve_notifications('metrics_report', p_report);
  perform public.audit_write(
    public.current_organization_id(), v_row.brand_id, 'metrics_report.withdrawn', 'metrics_report',
    p_report, jsonb_build_object('period_start', v_row.period_start, 'period_end', v_row.period_end)
  );
end;
$$;

create function public.metrics_snapshot_for_portal(p_snapshot jsonb, p_blocks jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with kinds as (
    select coalesce(array_agg(b ->> 'kind'), '{}'::text[]) as list
    from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) b
  ),
  parts as (
    select p_snapshot -> 'analysis' as analysis
  )
  select jsonb_build_object(
    'version', p_snapshot -> 'version',
    'generatedAt', p_snapshot -> 'generatedAt',
    'account', jsonb_build_object(
      'username', p_snapshot #> '{account,username}',
      'followers', p_snapshot #> '{account,followers}'
    ),
    'periodLabel', p_snapshot -> 'periodLabel',
    'compare', p_snapshot -> 'compare',
    'summary', p_snapshot -> 'summary',
    'highlights', coalesce(p_snapshot -> 'highlights', '[]'::jsonb),
    'analysis', jsonb_build_object(
      'overview', parts.analysis -> 'overview',
      'topPosts', case
        when 'top_posts' = any (kinds.list) then coalesce(
          (
            select jsonb_agg((post - 'item_id') - 'item_title' - 'content_channel_id')
            from jsonb_array_elements(parts.analysis -> 'topPosts') post
          ),
          '[]'::jsonb
        )
        else '[]'::jsonb
      end,
      'formats', case when 'formats' = any (kinds.list)
        then coalesce(parts.analysis -> 'formats', '[]'::jsonb) else '[]'::jsonb end,
      'weekdays', case when 'schedule' = any (kinds.list)
        then coalesce(parts.analysis -> 'weekdays', '[]'::jsonb) else '[]'::jsonb end,
      'hours', case when 'schedule' = any (kinds.list)
        then coalesce(parts.analysis -> 'hours', '[]'::jsonb) else '[]'::jsonb end,
      'audience', case when 'audience' = any (kinds.list)
        then coalesce(parts.analysis -> 'audience', '[]'::jsonb) else '[]'::jsonb end,
      'plan', case when 'plan' = any (kinds.list)
        then parts.analysis -> 'plan'
        else '{"planned":0,"published":0,"automatic":0,"published_automatically":0,"failed":0}'::jsonb
      end,
      'marks', case when 'marks' = any (kinds.list)
        then coalesce(parts.analysis -> 'marks', '[]'::jsonb) else '[]'::jsonb end
    )
  )
  from kinds, parts
$$;

create function public.portal_metrics_report_list(p_brand uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.portal_assert_member(p_brand);
  if not public.has_action('metrics.portal_view') then
    raise exception 'denied';
  end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id, 'title', r.title, 'period_start', r.period_start, 'period_end', r.period_end,
          'published_at', r.published_at
        )
        order by r.period_end desc, r.published_at desc
      )
      from public.metric_reports r
      where r.brand_id = p_brand and r.status = 'published'
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.portal_metrics_report_get(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.metric_reports;
begin
  if not public.has_action('metrics.portal_view') then
    raise exception 'denied';
  end if;
  select * into v_row from public.metric_reports r where r.id = p_report and r.status = 'published';
  if not found then
    raise exception 'not_found';
  end if;
  perform public.portal_assert_member(v_row.brand_id);
  return jsonb_build_object(
    'id', v_row.id,
    'title', v_row.title,
    'message', v_row.message,
    'next_steps', v_row.next_steps,
    'blocks', v_row.blocks,
    'period_start', v_row.period_start,
    'period_end', v_row.period_end,
    'published_at', v_row.published_at,
    'snapshot', public.metrics_snapshot_for_portal(v_row.snapshot, v_row.blocks)
  );
end;
$$;

create function public.dashboard_metrics_report_due(p_brands uuid[] default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_action('metrics.report');
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'brand_id', x.brand_id, 'brand_name', x.brand_name, 'channel_id', x.channel_id,
          'month_start', x.month_start, 'month_end', x.month_end
        )
        order by x.brand_name
      )
      from (
        select b.id as brand_id, b.name as brand_name, k.channel_id,
          (date_trunc('month', now() at time zone b.timezone) - interval '1 month')::date as month_start,
          (date_trunc('month', now() at time zone b.timezone) - interval '1 day')::date as month_end
        from public.channel_connections k
        join public.brands b on b.id = k.brand_id
        where k.collect_metrics and k.status in ('active', 'expiring')
          and public.can_access_brand(b.id)
          and (p_brands is null or b.id = any (p_brands))
      ) x
      where x.month_end >= (select (c.connected_at at time zone 'UTC')::date
        from public.channel_connections c where c.channel_id = x.channel_id)
        and not exists (
          select 1 from public.metric_reports r
          where r.channel_id = x.channel_id and r.status = 'published'
            and r.period_start <= x.month_end and r.period_end >= x.month_start
        )
    ),
    '[]'::jsonb
  );
end;
$$;

create function public.metrics_collect_targets()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'channel_id', k.channel_id,
        'brand_id', k.brand_id,
        'last_metrics_at', k.last_metrics_at,
        'connected_at', k.connected_at,
        'timezone', b.timezone
      )
      order by k.last_metrics_at nulls first
    ),
    '[]'::jsonb
  )
  from public.channel_connections k
  join public.brands b on b.id = k.brand_id
  where k.collect_metrics and k.status in ('active', 'expiring') and k.token_expires_at > now()
$$;

create function public.metrics_store_daily(p_channel uuid, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
  v_count int;
begin
  select c.brand_id into v_brand from public.channels c where c.id = p_channel;
  if not found or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_input';
  end if;
  insert into public.channel_metric_daily (channel_id, brand_id, day, metric, value)
  select p_channel, v_brand, (e ->> 'day')::date, e ->> 'metric', (e ->> 'value')::numeric
  from jsonb_array_elements(p_rows) e
  on conflict (channel_id, metric, day) do update
  set value = excluded.value, captured_at = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.metrics_store_audience(p_channel uuid, p_on date, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
  v_count int;
begin
  select c.brand_id into v_brand from public.channels c where c.id = p_channel;
  if not found or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_input';
  end if;
  insert into public.channel_audience_snapshot (channel_id, brand_id, captured_on, dimension, breakdown)
  select p_channel, v_brand, p_on, e ->> 'dimension', e -> 'breakdown'
  from jsonb_array_elements(p_rows) e
  on conflict (channel_id, captured_on, dimension) do update set breakdown = excluded.breakdown;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.metrics_store_media(p_channel uuid, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand uuid;
  v_count int;
begin
  select c.brand_id into v_brand from public.channels c where c.id = p_channel;
  if not found or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_input';
  end if;
  insert into public.channel_media_index (
    channel_id, brand_id, external_media_id, permalink, media_type, product_type, posted_at,
    caption_excerpt, content_channel_id
  )
  select p_channel, v_brand, e ->> 'external_media_id', nullif(e ->> 'permalink', ''),
    e ->> 'media_type', nullif(e ->> 'product_type', ''), (e ->> 'posted_at')::timestamptz,
    left(e ->> 'caption_excerpt', 200),
    (
      select r.id from public.content_channels r
      where r.channel_id = p_channel and r.external_media_id = e ->> 'external_media_id'
      limit 1
    )
  from jsonb_array_elements(p_rows) e
  on conflict (channel_id, external_media_id) do update
  set permalink = excluded.permalink, caption_excerpt = excluded.caption_excerpt,
      content_channel_id = coalesce(public.channel_media_index.content_channel_id, excluded.content_channel_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.metrics_media_due(p_channel uuid, p_limit int)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('external_media_id', d.external_media_id, 'bucket', d.bucket, 'media_type', d.media_type, 'product_type', d.product_type)), '[]'::jsonb)
  from (
    select m.external_media_id, m.media_type, m.product_type, b.bucket
    from public.channel_media_index m
    cross join lateral (
      values ('h1', interval '1 hour'), ('h24', interval '24 hours'), ('d7', interval '7 days'),
        ('d30', interval '30 days')
    ) as b (bucket, age)
    where m.channel_id = p_channel
      and m.posted_at <= now() - b.age
      and m.posted_at > now() - b.age - interval '3 days'
      and not exists (
        select 1 from public.content_channel_metrics c
        where c.media_index_id = m.id and c.age_bucket = b.bucket
      )
    order by m.posted_at desc
    limit greatest(p_limit, 1)
  ) d
$$;

create function public.metrics_store_post(
  p_channel uuid,
  p_external text,
  p_bucket text,
  p_metrics jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media public.channel_media_index;
begin
  select * into v_media from public.channel_media_index m
  where m.channel_id = p_channel and m.external_media_id = p_external;
  if not found or jsonb_typeof(p_metrics) <> 'object' then
    raise exception 'not_found';
  end if;
  insert into public.content_channel_metrics (media_index_id, brand_id, age_bucket, metrics)
  values (v_media.id, v_media.brand_id, p_bucket, p_metrics)
  on conflict (media_index_id, age_bucket) do nothing;
end;
$$;

create function public.metrics_collection_done(p_channel uuid, p_followers int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.channel_connections
  set last_metrics_at = now(), followers_count = coalesce(p_followers, followers_count),
      version = version + 1
  where channel_id = p_channel;
end;
$$;

revoke execute on function
  public.metrics_overview(uuid, uuid, date, date, text, text),
  public.metrics_top_posts(uuid, uuid, date, date, text, int),
  public.metrics_breakdown(uuid, uuid, date, date, text, text),
  public.metrics_audience(uuid, uuid),
  public.metrics_plan_summary(uuid, uuid, date, date),
  public.metric_marks_list(uuid, date, date),
  public.metric_mark_save(jsonb),
  public.metric_mark_delete(uuid),
  public.metrics_report_list(uuid),
  public.metrics_report_get(uuid),
  public.metrics_report_save(jsonb),
  public.metrics_report_new_version(uuid),
  public.metrics_report_delete(uuid),
  public.metrics_report_publish(uuid, int, jsonb),
  public.metrics_report_withdraw(uuid),
  public.portal_metrics_report_list(uuid),
  public.portal_metrics_report_get(uuid),
  public.dashboard_metrics_report_due(uuid[])
from public, anon;
grant execute on function
  public.metrics_overview(uuid, uuid, date, date, text, text),
  public.metrics_top_posts(uuid, uuid, date, date, text, int),
  public.metrics_breakdown(uuid, uuid, date, date, text, text),
  public.metrics_audience(uuid, uuid),
  public.metrics_plan_summary(uuid, uuid, date, date),
  public.metric_marks_list(uuid, date, date),
  public.metric_mark_save(jsonb),
  public.metric_mark_delete(uuid),
  public.metrics_report_list(uuid),
  public.metrics_report_get(uuid),
  public.metrics_report_save(jsonb),
  public.metrics_report_new_version(uuid),
  public.metrics_report_delete(uuid),
  public.metrics_report_publish(uuid, int, jsonb),
  public.metrics_report_withdraw(uuid),
  public.portal_metrics_report_list(uuid),
  public.portal_metrics_report_get(uuid),
  public.dashboard_metrics_report_due(uuid[])
to authenticated;
revoke execute on function
  public.metrics_assert_read(uuid, uuid),
  public.metrics_totals(uuid, date, date),
  public.metrics_report_json(public.metric_reports, boolean),
  public.metrics_snapshot_for_portal(jsonb, jsonb),
  public.metrics_collect_targets(),
  public.metrics_store_daily(uuid, jsonb),
  public.metrics_store_audience(uuid, date, jsonb),
  public.metrics_store_media(uuid, jsonb),
  public.metrics_media_due(uuid, int),
  public.metrics_store_post(uuid, text, text, jsonb),
  public.metrics_collection_done(uuid, int)
from public, anon, authenticated;

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

begin;

create table public.notification_kinds (
  kind text primary key,
  title text not null,
  required_action text not null references public.actions (key),
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  default_lead_days int[],
  schedulable boolean not null default false,
  portal boolean not null default false,
  default_email boolean not null default false,
  available boolean not null default false
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null references public.notification_kinds (kind),
  brand_id uuid references public.brands (id),
  title text not null,
  body text,
  link text check (link is null or link ~ '^/[^/]'),
  ref_type text,
  ref_id uuid,
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  status text not null default 'active' check (status in ('active', 'resolved')),
  dedupe_key text not null,
  read_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_read_idx on public.notifications (user_id, read_at, created_at desc);
create index notifications_ref_idx on public.notifications (ref_type, ref_id);
create index notifications_created_idx on public.notifications (created_at);

create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null references public.notification_kinds (kind),
  enabled boolean not null default true,
  email boolean not null default false,
  lead_days int[] check (
    lead_days is null or (cardinality(lead_days) <= 5 and 0 <= all (lead_days) and 30 >= all (lead_days))
  ),
  primary key (user_id, kind)
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email extensions.citext not null,
  template text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index email_outbox_status_idx on public.email_outbox (status, next_attempt_at);

alter table public.notification_kinds enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_outbox enable row level security;

insert into public.notification_kinds
  (kind, title, required_action, severity, default_lead_days, schedulable, portal, default_email, available)
values
  ('approval.requested', 'Nova aprovação pendente', 'approvals.decide', 'info', null, false, true, true, false),
  ('approval.decided', 'Aprovação concluída', 'approvals.view', 'info', null, false, false, false, false),
  ('approval.superseded', 'Uma nova versão foi enviada', 'approvals.decide', 'info', null, false, true, false, false),
  ('approval.overdue', 'Aprovação atrasada', 'approvals.view', 'urgent', '{1,2}', true, true, false, false),
  ('content.due_soon', 'Prazo de produção chegando', 'content.view', 'warning', '{2,0}', true, false, false, false),
  ('content.overdue', 'Prazo de produção vencido', 'content.view', 'urgent', '{1}', true, false, false, false),
  ('variant.publish_due', 'Hora de registrar a publicação', 'content.publish_manual', 'warning', '{1}', true, false, false, false),
  ('comment.created', 'Novo comentário', 'comments.create_internal', 'info', null, false, true, false, false),
  ('invitation.accepted', 'Convite aceito', 'users.view', 'info', null, false, false, true, true),
  ('invitation.expiring', 'Convite perto de expirar', 'users.view', 'warning', '{1}', true, false, true, false),
  ('site.published', 'Site publicado', 'site.publish', 'info', null, false, false, false, false),
  ('site.contact_message', 'Nova mensagem do site', 'site.view', 'info', null, false, false, false, false),
  ('media.upload_failed', 'Falha no envio de arquivo', 'media.upload', 'warning', null, false, false, false, false)
on conflict (kind) do nothing;

create function public.notify_users(
  p_kind text,
  p_brand uuid,
  p_title text,
  p_body text,
  p_link text,
  p_ref_type text,
  p_ref_id uuid,
  p_dedupe_key text,
  p_recipients uuid[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.notification_kinds;
  v_recipient record;
  v_inserted int;
  v_wants_email boolean;
begin
  select * into v_kind from public.notification_kinds k where k.kind = p_kind;
  if not found then
    raise exception 'invalid_input';
  end if;

  for v_recipient in
    select p.id, p.email,
           pref.email as pref_email
    from public.profiles p
    left join public.notification_preferences pref on pref.user_id = p.id and pref.kind = p_kind
    where p.status = 'approved'
      and (p_recipients is null or p.id = any (p_recipients))
      and (v_kind.portal or p.kind = 'internal')
      and coalesce(pref.enabled, true)
      and (
        exists (select 1 from public.roles ro where ro.id = p.role_id and ro.key = 'owner' and ro.is_system)
        or exists (
          select 1 from public.role_actions ra
          where ra.role_id = p.role_id and ra.action_key = v_kind.required_action
        )
      )
      and (
        p_brand is null
        or exists (
          select 1 from public.roles ro
          where ro.id = p.role_id and ro.key = 'owner' and ro.is_system and p.kind = 'internal'
        )
        or exists (
          select 1 from public.brand_members m
          where m.brand_id = p_brand and m.user_id = p.id and m.status = 'active' and m.kind = p.kind
        )
      )
  loop
    insert into public.notifications (
      user_id, kind, brand_id, title, body, link, ref_type, ref_id, severity, dedupe_key
    )
    values (
      v_recipient.id, p_kind, p_brand, p_title, p_body, p_link, p_ref_type, p_ref_id,
      v_kind.severity, p_dedupe_key
    )
    on conflict (user_id, dedupe_key) do nothing;
    get diagnostics v_inserted = row_count;

    v_wants_email := coalesce(v_recipient.pref_email, v_kind.default_email);
    if v_inserted > 0 and v_wants_email then
      insert into public.email_outbox (to_email, template, payload)
      values (
        v_recipient.email,
        p_kind,
        jsonb_build_object('title', p_title, 'link', p_link, 'brand_id', p_brand)
      );
    end if;
  end loop;
end;
$$;

create function public.resolve_notifications(p_ref_type text, p_ref_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set status = 'resolved'
  where ref_type = p_ref_type and ref_id = p_ref_id and status = 'active'
$$;

create function public.notification_lead_days(p_user uuid, p_kind text)
returns int[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pref.lead_days from public.notification_preferences pref
     where pref.user_id = p_user and pref.kind = p_kind),
    (select k.default_lead_days from public.notification_kinds k where k.kind = p_kind)
  )
$$;

create function public.generate_due_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scanner record;
  v_ran int := 0;
  v_failed int := 0;
  v_deleted int;
begin
  for v_scanner in
    select p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'notify\_scan\_%' and p.pronargs = 0
    order by p.proname
  loop
    begin
      execute format('select public.%I()', v_scanner.proname);
      v_ran := v_ran + 1;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  delete from public.notifications
  where created_at < now() - interval '90 days'
    and (read_at is not null or status = 'resolved');
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('scanners', v_ran, 'failed', v_failed, 'deleted', v_deleted);
end;
$$;

create policy notification_kinds_read on public.notification_kinds for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved'));

create policy notifications_read on public.notifications for select
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.notification_kinds k
      where k.kind = notifications.kind and public.has_action(k.required_action)
    )
    and (
      brand_id is null
      or public.can_access_brand(brand_id)
      or public.is_external_brand_member(brand_id)
    )
  );

create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy notification_preferences_read on public.notification_preferences for select
  using (user_id = auth.uid());

create policy notification_preferences_insert on public.notification_preferences for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.notification_kinds k
      where k.kind = notification_preferences.kind and k.available and public.has_action(k.required_action)
    )
  );

create policy notification_preferences_update on public.notification_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notification_kinds, public.notifications, public.notification_preferences,
  public.email_outbox from anon, authenticated;

grant select on public.notification_kinds, public.notifications to authenticated;
grant update (read_at, snoozed_until) on public.notifications to authenticated;
grant select, insert on public.notification_preferences to authenticated;
grant update (enabled, email, lead_days) on public.notification_preferences to authenticated;

revoke execute on function public.notify_users(text, uuid, text, text, text, text, uuid, text, uuid[]),
  public.resolve_notifications(text, uuid), public.notification_lead_days(uuid, text),
  public.generate_due_notifications() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'compasso-generate-due-notifications',
      '0 9 * * *',
      'select public.generate_due_notifications()'
    );
  end if;
end;
$$;

commit;

# Notifications

> **In-app notifications** of Compasso: reminders and alerts shown in the back office and the client portal, so nobody has to remember everything (approvals waiting, deadlines, invitations). It depends on [roles-and-actions.md](roles-and-actions.md) (who receives what). The infrastructure (kind catalog, `dedupe_key`, creation only by `security definer` functions, preferences, bell, Realtime, `pg_cron`) comes from the Memoria Print project; the **kinds** are Compasso's own. Email is a complement, not a replacement (section 9). Titles and bodies are UI copy in Brazilian Portuguese; everything else is English.

## 1. Goal

- Alert the right person, **at the right moment**, about something that needs attention, without leaving the application.
- Reduce forgetting: the calendar shows what exists; the notification **pushes** what is approaching or late.
- Respect permissions **and brand scope**: nobody receives alerts about data they cannot see, or about brands they are not linked to.
- Be lightweight: few, useful and actionable alert types instead of noise.

## 2. Principles

1. **Actionable**: each notification leads directly to the record in question (a content, an approval request, a user).
2. **No duplicates**: the same alert is not repeated on every check (deduplication key).
3. **Self-correcting**: when the problem is solved, the alert stops being relevant and is resolved.
4. **Controllable**: each person can turn alert types on/off and adjust lead times.
5. **Secure**: each user only reads their own notifications (RLS), only receives them if they have the required action **and** access to the brand, and the text never reveals private titles to someone without access.
6. **Never the only channel for a decision**: a failed email or alert never removes an approval request; it stays available in the portal.

## 3. Notification kinds

Each kind requires an **action** and, when the subject belongs to a brand, a **brand link**.

| Kind | When it fires | Who receives (action) | Origin | Default lead time |
|---|---|---|---|---|
| `approval.requested` | A revision is submitted for approval | Every approver of the brand (`approvals.decide` and a brand link with `can_decide`); the title names the stage ("Planejamento aguarda sua decisão", "Artes aguardam sua decisão") | Event | Immediate |
| `approval.decided` | The approver approved or requested changes | Whoever submitted (`approvals.view`) | Event | Immediate |
| `approval.approved_by_team` | The team approved on the client's behalf while a request was pending (not sent when nothing had been requested) | Every approver of the brand (`approvals.decide` and a brand link with `can_decide`) | Event | Immediate |
| `approval.superseded` | A pending request was replaced by a new revision | The previous approver (`approvals.decide`) | Event | Immediate |
| `approval.overdue` | A pending request passed its approval deadline | Whoever submitted (`approvals.view`). The external approver is not sent this alert (see the Phase 4 addition) | Scheduled | Next day, then every 2 days until resolved |
| `content.due_soon` | A production deadline is approaching | The content owner (`content.view`) | Scheduled | 2 days and the same day |
| `content.overdue` | A production deadline passed and the content is not ready | The content owner and managers of the brand | Scheduled | Daily until resolved |
| `content.publish_due` | The planned date of a channel row passed with no manual publication recorded | The content owner (`content.publish_manual`) | Scheduled | The day after |
| `comment.created` | A comment on a content the person follows | Participants (internal: `comments.create_internal`; external: `comments.create_external`) | Event | Immediate |
| `calendar.event` | A calendar event or date shared with the client was created, changed, hidden or archived | The client members of the brand (`portal.view`) | Event | Immediate |
| `invitation.accepted` | An invitation was accepted | Whoever invited (`users.view`) | Event | Immediate |
| `invitation.expiring` | A pending invitation expires soon | Whoever invited | Scheduled | 1 day before |
| `site.published` | A site version was published or restored | People with `site.publish` | Event | Immediate |
| `site.contact_message` | A message arrived through the site contact form | People with `site.view` | Event | Immediate |
| `media.upload_failed` | An upload failed validation | The uploader (`media.upload`) | Event | Immediate |

The kinds, required actions and default lead times live in a **catalog** (`notification_kinds`), seeded by the migrations just like the actions. Each module adds its own when implemented, with `available = true`. Each notification also has a **severity**: `info`, `warning` (needs attention) or `urgent` (delay/risk); it defines icon, ordering and tone, within the palette.

## 4. Behavior

### Lifecycle

The persisted status is `active` or `resolved`. Reading (`read_at`) and snoozing (`snoozed_until`) are independent fields, not additional statuses.

- Opening/marking as read sets `read_at`.
- Snoozing sets `read_at` to null and sets the date; it appears again when that date arrives, without a routine to reactivate it.
- Resolving the origin (the request was decided, the invitation accepted) changes the status to `resolved`, without altering the business operation.
- Cleanup deletes notifications created more than 90 days ago if read or resolved. Before enabling long-lived alerts, preserve a cycle key outside the deleted row or restrict the cleanup: deleting a read active alert could let a scanner recreate it.

### Deduplication

Each notification has a `dedupe_key`, unique per user (for example `approval.overdue:<request_id>:2d`). If the check finds the same situation again, it **does not create another one**. A new situation (for example the deadline changed, or a new revision) generates a different key.

### Who receives

When generating, the system calculates the recipients: **approved accounts whose role has the action required by the kind**, **with access to the brand** of the subject, and who **did not turn off** that kind in preferences. If someone's permissions or brand links change, they stop receiving new alerts, and the existing ones they can no longer see **become hidden** (reading notifications checks the action and the brand again). External users only receive the kinds marked for the portal and never see internal titles or notes.

## 5. Interface

### Bell in the header (back office and portal)

- Bell icon with an **unread counter** (above 9 shows "9+").
- When opened: panel with the latest notifications, most recent first, grouped by today / yesterday / older.
- Each item: icon by kind, title, short text, when, "unread" dot, quick actions (**Abrir**, **Adiar**, **Marcar como lida**).
- Footer: "Marcar todas como lidas" and "Ver todas".
- Updates **in real time** (Supabase Realtime) without reloading the page, with a 60-second poll as a fallback.

### "Notifications" page (`/admin/notifications`, and the portal equivalent)

- Filters: **Todas / Não lidas / Adiadas**, and by kind; paginated list with the same actions as the panel; each notification opens the linked record (`link`).

### Preferences (`/admin/profile`, "Avisos" section)

- A switch per alert kind (only kinds the person can receive appear).
- Customizable lead time on scheduled kinds, within limits.
- An optional email switch per kind (section 9).

### Dashboard block

The "next content, deadlines and pending approvals" block of the dashboard reuses the same sources: it shows what is late and what is coming, even for those who turned notifications off.

### Texts (UI copy, proposals in Brazilian Portuguese)

| Kind | Title | Body |
|---|---|---|
| `approval.requested` | Nova aprovação pendente | "O conteúdo «Lançamento de outono» (Instagram) aguarda sua decisão." |
| `approval.decided` | Aprovação concluída | "Café Aurora aprovou «Lançamento de outono» (Instagram)." / "Café Aurora pediu alterações em «Lançamento de outono»." |
| `approval.approved_by_team` | A equipe aprovou | "A equipe aprovou «Café Aurora · Lançamento de outono» (Artes)." |
| `approval.superseded` | Uma nova versão foi enviada | "A versão que você ia avaliar foi substituída. Veja a versão atual." |
| `approval.overdue` | Aprovação atrasada | "A aprovação de «Lançamento de outono» está pendente desde 12 de outubro." |
| `content.due_soon` | Prazo de produção chegando | "«Lançamento de outono» deve ficar pronto em 2 dias." |
| `content.publish_due` | Hora de registrar a publicação | "«Lançamento de outono» estava planejado para ontem às 10h. Já foi publicado?" |
| `calendar.event` | Novo evento no calendário / Evento alterado / Evento cancelado | "«Reunião de alinhamento» · 21/10/2026 13:00 (America/Sao_Paulo)" |
| `invitation.accepted` | Convite aceito | "Marta Silva aceitou o convite e já pode acessar." |
| `site.published` | Site publicado | "A versão 12 do site está no ar." |

Tone calm and direct, without artificial urgency.

## 6. Data model

Names in English. The SQL below is explanatory; the notifications migration is the executable source (triggers, policies, complete fields).

```sql
create type notification_severity as enum ('info', 'warning', 'urgent');
create type notification_status as enum ('active', 'resolved');

create table notification_kinds (
  kind              text primary key,
  title             text not null,
  required_action   text not null references actions (key),
  severity          notification_severity not null default 'info',
  default_lead_days int[],
  schedulable       boolean not null default false,
  portal            boolean not null default false,
  available         boolean not null default false
);

create table notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  kind          text not null references notification_kinds (kind),
  brand_id      uuid references brands (id),
  title         text not null,
  body          text,
  link          text,
  ref_type      text,
  ref_id        uuid,
  severity      notification_severity not null default 'info',
  status        notification_status not null default 'active',
  dedupe_key    text not null,
  read_at       timestamptz,
  snoozed_until timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on notifications (user_id, read_at, created_at desc);
create index on notifications (ref_type, ref_id);

create table notification_preferences (
  user_id   uuid not null references profiles (id) on delete cascade,
  kind      text not null references notification_kinds (kind),
  enabled   boolean not null default true,
  email     boolean not null default false,
  lead_days int[],
  primary key (user_id, kind)
);
```

### RLS

| Table | Rule |
|---|---|
| `notifications` | `select`: `user_id = auth.uid()` **and** `has_action(kind's required_action)` **and** (`brand_id is null` or `can_access_brand(brand_id)` or `is_external_brand_member(brand_id)`). `update`: only `read_at` and `snoozed_until` of the person themselves. **No** `insert`/`delete` by the client |
| `notification_preferences` | The person reads and writes only their own, only for kinds they can receive |
| `notification_kinds` | Read for approved accounts |

Notifications are **created only by `security definer` functions** (triggers, the transactional RPCs and the scheduled routine), never by the browser.

## 7. How they are generated

### 7.1 By events

The transactional functions of the content flow call `notify_users(kind, brand_id, title, body, link, ref_type, ref_id, dedupe_key)` inside the same transaction (`submit_for_approval`, `portal_decide_approval`, `accept_invitation`, `publish_site_page`…), so an alert exists if and only if the operation was committed. When the cause goes away, `resolve_notifications(ref_type, ref_id)` marks them resolved.

### 7.2 By scheduled routine

A function `generate_due_notifications()` runs **once a day** (and optionally hourly) through Supabase **`pg_cron`**: it discovers and runs every `public.notify_scan_<module>()` function (a failing scanner does not stop the others); each scanner looks for items within the lead times, calculates recipients and preferences, inserts with `on conflict (user_id, dedupe_key) do nothing`, marks as resolved what no longer applies, and the routine deletes read/resolved items older than 90 days. If the plan does not include `pg_cron`, use a scheduled call to a server route (Vercel Cron) protected by `CRON_SECRET`; the logic stays the same.

### 7.3 Real time

The client subscribes to changes of `notifications` where `user_id = auth.uid()` (Supabase Realtime) to update the counter and the panel. It respects RLS. The portal uses the same subscription.

## 8. In the application

| Piece | Description |
|---|---|
| `NotificationBell` | Bell and panel in the headers of the back office and the portal |
| `useNotifications()` | Data (TanStack Query) + real-time subscription; unread counter |
| `/admin/notifications` and the portal page | Page with filters and pagination |
| Server functions | `listNotifications`, `markRead`, `markAllRead`, `snooze`, `savePreferences` (zod; error messages in Portuguese) |
| Preferences | "Avisos" section in the profile |

### How a new module starts generating notifications

1. **By event**: the module's transactional function calls `notify_users(...)` and, when the cause goes away, `resolve_notifications(...)`.
2. **By date**: create `public.notify_scan_<module>()` with no arguments; use `notification_lead_days(user, kind)` to respect each person's lead times.
3. In the module migration, set `available = true` on the kinds it now produces (only then do they appear in preferences) and add the kind to `NotificationKind` in TypeScript (verified by `check:consistency`).

### Manual configuration

- [ ] Enable the **`pg_cron`** extension (Database → Extensions) **before** applying the migration, or run the last block of the migration again after enabling it.
- [ ] Confirm that Realtime is active and that `notifications` is in the `supabase_realtime` publication (the migration adds it).
- [ ] If using Vercel Cron instead of `pg_cron`, set `CRON_SECRET`.

## 9. Email

Email complements the in-app alert for what is important or for people who are not inside the system (the external approver):

- Sent through the email adapter (`lib/shared/email`, Resend proposed), template in Brazilian Portuguese, one link to the portal record; **no private content in the email body** beyond title and brand.
- Queued in a small outbox table with retries and backoff; a failure never undoes the operation.
- Default on for `approval.requested` (external approver) and `invitation.*`; off for the rest, configurable per kind in preferences.
- Invitations and password emails are sent by Supabase Auth/SMTP or by the adapter, never exposing tokens in logs.

## 10. Acceptance criteria

- [ ] Submitting a revision creates `approval.requested` for every approver of the brand in real time, with the counter on the bell, **in the same transaction** as the submission.
- [ ] Opening a notification leads to the right record and marks it as read.
- [ ] The same situation **does not generate repeated alerts**, even with the routine running several times.
- [ ] A person **does not see** notifications of kinds whose action they lack, nor of brands they are not linked to, even asking the API directly.
- [ ] Removing an action or revoking a brand link immediately stops showing the corresponding alerts.
- [ ] Snoozing makes the notification reappear on the chosen date.
- [ ] Resolving the origin (deciding the request, accepting the invitation) resolves the notification.
- [ ] Turning off a kind in preferences **prevents** new alerts of that kind.
- [ ] An email failure does not remove the approval request or the notification.
- [ ] The counter and the panel update without reloading the page.
- [ ] Old notifications are cleaned by the routine.

## 11. Out of the MVP and evolution

- Mobile push (PWA) for approvers on phones.
- External chat channels (WhatsApp, Telegram).
- "Do not disturb" period and grouped daily summary emails.
- Custom rules created by administration.

## 12. Open questions

1. Should `approval.overdue` also notify the manager of the brand?
2. Are the default lead times (2 days for production deadlines, next day for overdue approvals) adequate?
3. Should the external approver receive reminder emails for pending approvals (and how often)?
4. Does the contracted Supabase plan include **`pg_cron`**? If not, use Vercel Cron.
5. Are there missing alert kinds (for example a comment from the client on a content, a rejected upload)?

## Implementation status (phase 1)

Phase 1 (task P1-09, 2026-10-18). Migration `20261018100400_notifications.sql` (tables, 13 kinds seeded, `notify_users`, `resolve_notifications`, `notification_lead_days`, `generate_due_notifications`, policies, Realtime publication and `pg_cron` schedule when available), `notify_scan_invitations` in the invitations migration, server functions, bell with Realtime and a 60-second poll, `/admin/notifications`, preferences in the profile. Only `invitation.accepted` and `invitation.expiring` are `available`. Validation performed: 44 SQL assertions (dedupe, preferences, action and brand scope, RLS, writer not callable by clients). **Not tested**: Realtime delivery, `pg_cron`, the e-mail outbox sender (rows are queued, nothing sends them yet: task P3-06), the screens in a browser. Also done after the first pass: lead-day editing in the preferences and the defaults screen (`/admin/settings/notifications`, `notification_kind_save`). **Not done**: the portal bell (phase 3).
### Phase 3 addition (tasks P3-03 and P3-06, 2026-10-18)

`approval.requested`, `approval.decided`, `approval.superseded` and `comment.created` are now `available` (migration `20261018100900_content.sql`) and are written inside `submit_for_approval`, `reassign_approver`, `send_approval_reminder`, `reopen_content`, `portal_decide_approval` and `portal_add_comment`, in the same transaction as the operation. Reminders use a one-hour `dedupe_key`. The e-mail sender now exists: `/api/cron/email-outbox` (`src/lib/shared/jobs/email-outbox.server.ts`) reads queued rows, sends the title and one link through the adapter, retries with back-off (5, 10, 20, 40 minutes) and marks the row `failed` after five attempts; a failure never touches the request or the notification. The portal has a notifications counter in its header and the pages `/portal/notifications` and `/portal/profile`. **Not tested**: the worker against a database and the provider, Realtime for external users. **Not done**: the scheduled kinds `approval.overdue`, `content.due_soon`, `content.overdue` and `variant.publish_due` (task P4-04), `available` stays false for them.

### Phase 4 addition (task P4-04, 2026-10-18)

`approval.overdue`, `content.due_soon`, `content.overdue` and `content.publish_due` (renamed from `variant.publish_due` on 2026-10-19) are now `available` (migration `20261018101000_calendar.sql`). One scanner, `notify_scan_content()`, produces the four; `generate_due_notifications()` finds it by name and runs it, and the daily job `/api/cron/due-notifications` (`vercel.json`, 09:00 UTC) calls that function where `pg_cron` is unavailable. Keys: `approval.overdue:<request>:<days late>` (first alert after `lead_days[1]` days, then every `lead_days[2]` days), `content.due_soon:<item>:<date>:<days left>`, `content.overdue:<item>:<today>`, `variant.publish_due:<variant>:<planned epoch>`, so a second run of the scanner creates nothing. An item is "ready" when it has variants and all of them are approved or cancelled (`content_item_is_ready`). `variant.publish_due` is raised only for approved, planned variants whose date passed in their own zone. Each scan also resolves alerts that no longer apply (request decided, item ready or cancelled, publication recorded or date moved).

**Decision D18:** the external approver does not receive `approval.overdue`. The kind requires `approvals.view`, which the external roles do not have, and widening that action for external users would weaken the rule that they read only through `portal_*`. The portal already marks the request as late (`overdue.ts`) and the team can send a reminder ("Lembrar aprovador"). **Not tested**: the real `pg_cron` and the Vercel schedule (V21); a person's own `lead_days` for `content.overdue` (daily by design).

### Phase 5 addition (tasks P5-02 and P5-05, 2026-10-19)

`site.published` and `site.contact_message` are now `available`. `site.published` is written inside `publish_site_page`, `site_rollback` and `publish_site_settings` (key per revision or settings version) and goes to people with `site.publish`; `site.contact_message` is written by `site_contact_submit` (the public function) and goes to people with `site.view`. **Not tested** with real accounts and the bell (V22, V25).

2026-10-19: Removed the “Avisos” item from the admin sidebar; users can still open the notifications page from “Ver todas” in the header bell. Files: `src/components/shared/admin/nav-config.ts`. Validation performed: ESLint, Prettier, `npm run check:docs` and `git diff --check`. **Not tested**: navigation in a browser.

2026-10-20: Fixed the console error "cannot add `postgres_changes` callbacks … after `subscribe()`". `useUnreadCount` is used by both the header bell and the portal sidebar, and the realtime channel name `compasso-notifications-<userId>` repeated, so the Supabase client returned the already subscribed channel. The channel name now ends with `crypto.randomUUID()`, one channel per effect run. Files: `src/hooks/shared/use-notifications.ts`. Validation performed: `tsc --noEmit` and ESLint on the file (both clean). **Not tested**: in a browser (error gone, realtime refresh of the unread count), `npm run check:docs`, Prettier.

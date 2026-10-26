# Module — Editorial calendar

> Functional specification. Context and conventions in [README.md](README.md). Spaces: `marketing` (`/admin/marketing/calendar` and the "Calendário" tab of a brand) and `portal` (calendar of the shared contents). The calendar components live in `shared/calendar`.

## Goal and scope

Show **what is planned, when and in which state**, for one brand or for all the authorized brands, and let the team move dates safely. Each entry is a **channel row of a content** (one channel, one format, one occurrence), shown with the **channel logo** and a status mark (published or scheduled). Production and approval **deadlines** are shown apart from the publication date. The team can also keep **ideas** and **dates** on the calendar and convert them into contents.

Admin calendar screens use all available content width for the calendar grid and its undated-content panel.

Included: month, week and list views, filters, items without a date, drag to reschedule with confirmation, time zones and daylight saving, shareable URLs, portal calendar. Not included in the MVP: tasks and other free-form events (only ideas and dates exist), external calendar sync (Google/ICS export is a later option), resource planning. Automatic publishing exists only for connected Instagram channels ([instagram-publishing.md](instagram-publishing.md)); the calendar shows the mode and status of such rows.

## What appears on the calendar

| Entry | Source | Date | Display |
|---|---|---|---|
| Planned publication | `content_channels.planned_at` + `planned_timezone` | An instant with time | Timed item; color by the editorial status of the content; **channel logo**; a clock mark ("Agendados") |
| Production deadline | `content_items.production_due_date` | A local date | All-day item with a neutral style and a "prazo" marker |
| Approval deadline | `content_items.approval_due_date` | A local date | All-day item with its own marker |
| Published manually | `content_channels.published_at` | Real instant | Item with the channel logo and a check mark ("Publicados"), at the real time |
| Idea | `calendar_notes` (`kind = idea`) | A local date | All-day item with a light bulb; greyed and linked when it became a content |
| Date | `calendar_notes` (`kind = date`) | A local date | All-day item with a calendar mark; repeats weekly, monthly or yearly when asked |

Channel rows without a planned date do **not** appear on the grid; they stay in the side list **"Sem data"**.

## Time zones

- Instants are stored in UTC **plus** the IANA zone chosen at planning (the brand's zone by default; the organization's zone is the brand's default).
- Deadlines are local dates of the brand, without time.
- The calendar grid uses the zone of the **selected brand**; in the global view it detects and uses the browser timezone, shown compactly in the toolbar. The global view has no timezone selector. Date/time strings are formatted inside the applicable zone without appending GMT offsets; when an entry's zone differs from the view, the zone is available from a timezone icon tooltip.
- The editor of a date asks for date and time **in the brand's zone**; the server converts before saving. Non-existent and ambiguous local times (daylight-saving changes) are handled explicitly: a non-existent time is refused with a suggestion; an ambiguous one asks which occurrence.
- Mandatory tests: daylight-saving changes of a zone that has them (for example Europe/Lisbon in March and October) and a zone that has none (America/Sao_Paulo).

## Views and navigation

- **Month**, **Week** and **List**; today button; previous/next; a title with the range. Default: Week in Marketing Management, List on mobile. The last selected view is saved in local storage (`StoredKey.CalendarView`); a `view` in the URL takes precedence and refreshes that saved preference.
- **Filters:** brand, client, channel, owner, editorial status, publication status and "somente prazos". Ideas and dates are always shown when they match the visible range; notes are hidden whenever a channel, owner, editorial or publication filter is on. The icon button with tooltip "Filtros" and the "Sem data" panel toggle sit beside the view selector. Filters and the visible range live in the **URL** so links can be shared and the position restored when returning from a detail.
- **Side list "Sem data":** content without date, filtered the same way; drag a card onto the grid to plan it. The panel can be hidden with an icon button (tooltip "Ocultar/Mostrar conteúdos sem data"), so the grid takes the whole width; the choice is remembered in the browser (`StoredKey.CalendarUndatedOpen`, open by default).
- **Legend:** the marks "Publicados" (check) and "Agendados" (clock), status colors from `statusStyles` with icon and text, deadline and note markers explained.
- **Adding from a day:** every day cell of the grid has an **"Adicionar"** button (visible on hover and focus) with three options: "Agendar conteúdo" (opens the full-screen content editor modal with that day, without leaving the calendar), "Adicionar data" and "Adicionar ideia" (a dialog with date, repetition, title and description). The options appear only with `content.create` and `calendar.manage`.
- **Remembered brand:** when a person chooses a brand in the global calendar filter or in a calendar creation form (content, idea, date or event), save it in local storage (`StoredKey.CalendarBrand`). A later calendar creation form with a brand selector starts with that brand; a brand-specific calendar and editing an existing note keep their own brand. Selecting "Todas as marcas" does not clear the remembered brand.
- **Entry preview:** click opens a dialog with title, brand, channel, format and the channel caption, plus status, time with zone and quick actions (open content, reschedule); content details load only when the dialog opens. For an idea or a date, show description, repetition and the actions "Converter em conteúdo", "Editar" and "Arquivar" (a converted note links to its content instead).
- **Accessibility:** a **list alternative** is always available and keyboard-navigable; the grid supports arrow-key navigation; reschedule is also possible through a "Alterar data…" dialog (no drag required).

## Rescheduling

1. Drag an entry to another day/time, or use "Alterar data…".
2. A confirmation dialog shows old and new date/time **with the zone** and the effects:
   - content `draft` / `in_production` / `internal_review`: just changes the date of that channel row;
   - content `awaiting_approval` or `approved`: warns that **a new version and a new approval are required**; confirming calls `reschedule_channel`, which creates the new version of the whole content (the previous pending request is superseded);
   - channel row already `published_manually`: refused (the publication record is a fact; correct it with a note);
   - date in the past: allowed only with an explicit warning.
3. Conflicts (optimistic `version`) show "Este item foi alterado por outra pessoa" and reload.
4. Deadlines can be changed by drag or in the editor; they do not require a new revision.

Dragging in the **portal** is not allowed (external users never reschedule).

## Alerts of conflict

The calendar shows non-blocking warnings, never silent changes:

- more than N channel rows of the same channel on the same day (configurable, default 3);
- the same brand and channel within a very short interval (default 30 minutes);
- a planned publication before the approval deadline, or before the content is approved ("ainda não aprovado");
- a planned date in the past for a channel row that is not published.

## Portal calendar

External users see a calendar restricted to the **brands they are linked to** and to the contents that were **sent or shared** with them (those with a version in a request addressed to someone of their brand). It shows one entry per channel row of the latest shared version (date, channel logo, status and the title of the snapshot); it never shows drafts, ideas, dates, internal deadlines, owners or comments. Hovering or focusing an entry shows a preview of that shared revision; selecting it opens the approval screen. Data comes from `portal_list_calendar(brand, from, to)` and the authorized `portal_get_approval`/`portal_media_urls` functions when the preview is opened.

## Queries and performance

> Functions: [../reference/functions.md](../reference/functions.md) section 6 (`list_calendar_entries`, `portal_list_calendar`, `reschedule_channel`, `calendar_note_save`, `calendar_note_archive`, `calendar_note_get`). Error codes: [../reference/error-codes.md](../reference/error-codes.md). Constants: [../reference/enums.md](../reference/enums.md).

- `list_calendar_entries(p_from, p_to, p_brands, p_channels, p_assignee, p_editorial, p_publication, p_notes)` (`p_notes` is the list of note kinds to include; null means none) filters by `calendar.view` and `can_access_brand`; the range is limited (maximum 100 days) and paginated; index `(brand_id, planned_at)`.
- The client requests only the visible range plus a margin; changing the range or filter cancels the previous request.
- Entries are plain data; no totals or aggregates are stored.

## Rules

1. An entry is a channel row of a content, a deadline, or a calendar note (an idea or a date); there are no other free events.
2. The calendar never changes statuses by itself; it only reads and calls the transition/reschedule functions.
3. A date change after submission follows the new-revision rule; the calendar does not bypass it.
4. A channel row on an archived channel keeps its entry; it cannot be moved to another date unless the channel is reactivated.
6. A note belongs to one brand, has a local date and an optional repetition computed when reading (`weekly`, `monthly`, `yearly`); it is edited and archived only with `calendar.manage`; it becomes a content through "Converter em conteúdo", which links it when that content is first saved; a converted note can no longer be edited or archived.
5. Everything shown respects brand access; counts never reveal brands the person cannot access.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `calendar.view` | See the calendar of linked brands | — |
| `calendar.manage` | Reschedule by drag/dialog, change deadlines, create, edit and archive ideas and dates | `calendar.view`, `content.update` |
| `portal.view` | See the portal calendar | — |

## Acceptance criteria

- The same event is shown at the same instant in every view; a brand in Europe/Lisbon and another in America/Sao_Paulo display their own zones correctly, including across daylight-saving changes.
- A content with two channels appears as two entries, each with its channel logo and its own date.
- An idea or a date added from a day cell appears on that day (and on its repetitions) and can be converted into a content once.
- Dragging an approved entry asks for confirmation, creates a new version and returns the content to awaiting approval.
- The portal calendar shows only shared contents of linked brands, one entry per channel.
- Items without a date stay in "Sem data" and can be planned by drag or by dialog.
- Filters and range are restored from the URL; keyboard users can do everything without dragging.
- No calendar action triggers publishing or calls to social networks.

## Decisions of phase 4

1. **Own calendar, no library** (spike P4-01, 2026-10-18). FullCalendar was not adopted: it brings its own styles and time-zone plugin, which would have to be fitted to the tokens of [../standards/color-palette.md](../standards/color-palette.md), and the project needs only month, week and list views with day-level drag. The Memoria Print calendar was not ported (it is not part of this repository). The grid is a plain CSS grid in `shared/calendar` that reuses the kit, the status styles and the time-zone helpers of `format.ts`. Cost: no hourly lanes and no multi-day events, which the MVP does not need. If hourly lanes are wanted later, adopting a library becomes a new decision (CODE-12).
2. **Drag moves the day, not the time.** Dragging an entry to another day keeps its local time of day and always opens the confirmation dialog, where the time can be changed ("Alterar data…" is the keyboard alternative). Hour-level dragging is not offered.
3. **The approval deadline is read-only on the calendar.** It belongs to the approval request, which is immutable after sending (`approval_requests_guard`); changing it means sending a new version. Only the production deadline moves (`reschedule_production_deadline`, which does not create a revision).
4. **Rescheduling a channel row.** With the two-stage approval, once the plan is approved the date belongs to the approved plan and the call fails with `plan_locked` (the team reopens the plan, see [content.md](content.md#two-stage-approval-decided-2026-10-20)). For a content that does not require a plan, one that is awaiting approval or approved creates the new version straight away, copied from the current one with the new date of that channel; the pending request is superseded and every approver of the brand is asked again; with nobody able to approve the call fails with `approver_required`. A content in any earlier state just changes the date of the row.
5. **A date in the past is accepted by the server**; the dialog warns first (`date_in_past` is a UI warning, never raised by SQL).
6. **The conflict alerts use fixed limits** (3 publications per channel per day, 30 minutes between two of the same channel) kept in `lib/shared/calendar/alerts.ts`; they are not yet a setting of `policies.calendar`.
7. **The week starts on Monday.** `policies.calendar.weekStartsOnMonday` is stored but the calendar does not read it yet, because `organization_settings` is readable only with `settings.manage`.
8. **A window of at most 100 days and 500 entries** replaces pagination: `list_calendar_entries` answers with `truncated = true` and the screen asks the person to filter. The "Sem data" list comes in the same call (at most 100, filtered like the grid).
9. **Mobile shows the list** (the grid is not drawn below 768 px), as the document asks; the list is also available on desktop.

## Events shared with the client (decided 2026-10-20)

> Status: **implemented in code and on PGlite (2026-10-20)**, not applied to the linked project and not seen in a browser (see the implementation status). Fold the rules into the sections above once the migration is applied and used (DOC-5).

### Why

The marketing manager needs to put on the calendar things that are not posts: a **shoot day** ("dia de captação"), a **meeting with the client**, a delivery, a campaign launch window. The client must be able to **see** the ones that concern them, so nobody is surprised. Today the calendar only has contents and the team-only ideas and dates ([Decisions of the content refactor](#decisions-of-the-content-refactor-2026-10-19)).

### Scenarios analysed

| # | Scenario | What it needs | Decision |
|---|---|---|---|
| 1 | **Shoot day** at the client's site: all day, or 09:00–13:00, one or two days | Start and end (date or date-time), all-day option, place, notes for the client ("levar o produto") | Supported: kind `event`, type `shoot` |
| 2 | **Meeting with the client** at a time, with a link or an address | Start and end in the brand time zone, place or link, who is invited is implicit (the brand's client members) | Supported: type `meeting` |
| 3 | **Team-only event** (internal alignment, a day off) | An event the client must not see | Supported: the event has a visibility switch, **internal by default** |
| 4 | **Recurring** (weekly alignment, monthly report meeting) | Repeat none, weekly, monthly or yearly, as the existing dates | Supported, expanded when reading; each occurrence keeps its local time across daylight-saving changes |
| 5 | **Several brands of the same client** in one meeting | One event per brand, or one event on several brands | **Not in this delivery**: an event belongs to one brand; the manager creates it on each brand (see O3) |
| 6 | **A meeting is moved or cancelled** | Edit and archive; the client has to find out | Supported: editing the date or the place of a shared event and archiving it notify the brand's client members |
| 7 | **The client confirms attendance** (RSVP) | A response per person | **Not in this delivery** (O2) |
| 8 | **Reminders** ("a meeting tomorrow") | A scheduled notification before the event | Not in this delivery; the first notification covers creation and change (O4) |
| 9 | **Deadlines** (production, approval) | Already on the calendar as read-only marks | Unchanged |
| 10 | **Holidays and commemorative dates** | Today's `date` notes | Unchanged; a date note can also be shared by the same switch (see below) |
| 11 | **Export to Google/Apple calendar** | An iCalendar feed | **Not in this delivery** (O5) |
| 12 | **Overlap** of two events | A warning | Not in this delivery; events do not raise the publication conflict alerts |

### Model: extend `calendar_notes` (one way, GOLD-2)

An event is a calendar note, not a new table. `kind` gets the value `event`, and the columns that only events use are added (all nullable for ideas and dates):

| Column | Meaning |
|---|---|
| `event_type` | `CalendarEventType`: `shoot`, `meeting`, `other` (events only) |
| `all_day` | boolean; true keeps today's behavior (`note_date` only) |
| `end_date` | the last day of an all-day event that lasts several days (at most 60 days after the first); null for one day. A repeating event cannot last several days |
| `starts_at`, `ends_at` | instants (UTC) for timed events, with `ends_at` at or after `starts_at`; a multi-day event has an end date |
| `timezone` | IANA zone of the event (the brand zone by default) |
| `location` | up to 200 characters; a place or a link (an `https://` link is validated like the other links) |
| `client_visible` | boolean, default false; when true the brand's client members see the event in the portal |

`title`, `description` (what the client reads when the event is shared), `repeat`, `archived_at` and `version` are the existing columns. Internal-only text goes in a new `internal_notes` column, never exposed. For an event `note_date` is the first local day. `client_visible` also applies to `kind = date`; ideas can never be shared (the check refuses it).

Rules:

1. Creating, editing and archiving need `calendar.manage` and the brand link, as the other notes; the client never writes.
2. The client sees **only** `client_visible` events (and dates) of the brands they are linked to, through `portal_list_calendar` (new entries of kind `event`) and never through the table; the output carries title, description, type, place, time and zone, **not** the internal notes, who created it or the repeat rule internals.
3. A change of date, time, place or visibility of a shared event, its creation and its archiving notify the brand's client members and the creator's team (new notification kind `calendar.event`, portal kind, in-app and optional e-mail), with the title and the time only. Only the client members of the brand are notified; the team that made the change is not. Turning an event back to internal withdraws it from the portal and tells them it was cancelled.
4. Events are all-day or timed; timed events show their zone ([../standards/base.md](../standards/base.md) UI-11) and a multi-day event is drawn on each day it covers in the month grid.
5. Events appear in the team calendar and the portal calendar with an icon by type (camera for `shoot`, people for `meeting`, calendar mark for `other`) and the lock/eye mark that says whether the client sees it; the legend and the filters get "Eventos".
6. The "Adicionar" menu of a day gets "Evento" next to "Ideia" and "Data". The dialog asks title, type, all day or start and end, place, description, internal notes, repeat and the switch "Visível para o cliente", off by default, with an `InfoTip` ("O cliente da marca vê este evento no portal e é avisado quando ele muda.").
7. In the portal an event opens a read-only detail (type, date and time with zone, place with a link when it is `https://`, description). There is nothing to approve.
8. Audit: `calendar_note.created`, `updated`, `archived` already exist; their metadata carries `kind` and, for events, `client_visible` (no new audit action). Notification kind: `calendar.event`.

### Open decisions

| ID | Decision | Status |
|---|---|---|
| O1 | Events and dates are **internal by default**; the manager opts in to show them to the client | Recommended |
| O2 | RSVP ("Confirmar presença") by the client | Out of this delivery; add later as a response per member |
| O3 | One event shared by **several brands** of the same client | Out of this delivery; revisit if managers repeat the same event on many brands |
| O4 | A reminder notification before the event (`calendar.event_soon`) | Out of this delivery; reuse the lead-days mechanism of the scheduled kinds later |
| O5 | iCalendar feed or Google/Apple sync | Out of this delivery |

## Decisions of the content refactor (2026-10-19)

1. **The entry is a channel row**, not a content: a content with three channel rows shows three entries with their logos (the benchmark mLabs does the same). The key of an entry is the kind plus the row (or note) and the day, so a repeating note has one key per day.
2. **Ideas and dates are `calendar_notes`**, not contents: no channels, no approval, no versions. They can repeat (`none`, `weekly`, `monthly`, `yearly`), are expanded when reading (no rows are generated) and are only visible to the team.
3. **Conversion is lazy**: "Converter em conteúdo" opens the editor filled; the note is linked when the content is first saved, so abandoning the editor leaves the note untouched.
4. **Notes are hidden when other filters are on** (channel, owner, editorial or publication), because those filters describe contents.

## Implementation status

Phase 4 (tasks P4-01 to P4-04, 2026-10-18).

**Files.** Migration `20261018101000_calendar.sql` (`list_calendar_entries`, `reschedule_variant`, `reschedule_production_deadline`, `portal_list_calendar`, `notify_scan_content` and the helpers `calendar_range_ok`, `content_item_is_ready`, `notification_date_text`); tests `supabase/tests/11_calendar.test.sql` and `12_calendar_notifications.test.sql`. Logic in `src/lib/shared/calendar/` (range, grouping by day, alerts, daylight-saving resolution, search schema), server functions in `src/lib/marketing/calendar/` and `src/lib/portal/calendar/`, state in `hooks/shared/use-calendar-state.ts`, components in `components/shared/calendar/`, `components/marketing/calendar/` and `components/portal/calendar/`, routes `/admin/marketing/calendar`, `/admin/marketing/brands/$brandId/calendar` and `/portal/brands/$brandId/calendar`, and the job `/api/cron/due-notifications` (daily, in `vercel.json`). `DateTimeField` now asks which occurrence when a local time happens twice. The menu has "Calendário", the brand has a "Calendário" tab, and the portal brand page links to the calendar.

**Validated.** 71 new SQL assertions on PGlite (range limit, filters, brand isolation, collaborator without `calendar.manage`, external user and `anon` refused, rescheduling in every state, new revision and superseded request, approver without access, portal isolation and absence of internal fields, the four scanners: lead times, idempotency, preferences, resolution); 22 unit tests (visible range, zones, deadlines, conflict alerts, daylight saving in Europe/Lisbon in March and October and in America/Sao_Paulo); lint, typecheck, build and the 27 Playwright guard tests (the new routes and the new job require a session or the secret).

**Not tested.** The screens in a browser (grid, drag and drop, keyboard navigation, 360 px, the dialogs); the two-connection race of rescheduling against a decision; the real `pg_cron` and the Vercel schedule; daylight-saving cases in the real database (only the TypeScript converter was exercised); the `organizations` read used for the default zone. Listed in [../pending-external-setup.md](../pending-external-setup.md) (V19 to V21, D18 to D21).

**Not done.** `dashboard_upcoming` and the "next publications" block of the dashboard; a calendar setting for the conflict limits and the week start; ICS export (out of the MVP).

Phase 5 (calendar screen layout, 2026-10-19).

**Files.** `src/components/marketing/calendar/calendar-page.tsx` now groups the brand, channel, owner, editorial status, publication status and deadline filters in the shared `ListFilters` popover. The calendar timezone remains visible for the all-brands view. `src/components/shared/calendar/calendar-toolbar.tsx` presents date navigation and view selection in a bordered toolbar section.

**Validated.** Targeted ESLint for both changed components, TypeScript typecheck, and Prettier checks for both components and this document passed.

**Not tested.** Browser rendering and filter/navigation interaction on desktop and mobile were not tested.

2026-10-19: Admin calendar routes use the full available admin content width. Validation performed: pending. **Not tested**: browser rendering.

2026-10-19: The undated-content panel is positioned absolutely beside the calendar, with space reserved on desktop, and its toggle uses a calendar icon. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. The full typecheck fails on existing repository errors across calendar labels, approvals, content and generated database types. **Not tested**: browser rendering or responsive interaction.

2026-10-19: The shared list-filter trigger now uses an icon with a tooltip and active-count badge. This applies to the calendar filters. Validation performed: targeted ESLint, Prettier and `git diff --check`. `check:docs` is currently blocked by ten audit-action registry mismatches for `calendar_note.*` and `variant.*` in the audit/functions documents. Full typecheck is blocked by existing `brand-logos.server.ts` type errors. **Not tested**: browser interaction.

2026-10-19 (content refactor): the calendar reads channel rows (`content_channels`) and notes (`calendar_notes`). Migration `20261019130020_calendar_notes.sql` (table, `calendar_note_save/archive/get`, `list_calendar_entries` with `p_notes`, `reschedule_channel`, `content_item_is_ready`), `…130030_content_single_aggregate_portal.sql` (`portal_list_calendar` per channel row, `notify_scan_content` per channel row with the kind `content.publish_due`). UI: `calendar-page.tsx` with the "Datas" and "Ideias" chips, `DayAddMenu`, `NoteDialog`, entries with `PlatformIcon` and status marks (`EntryChip`, `StatusMark`), `EntryDetails` for notes, legend with the marks. Validated: 79 pgTAP assertions (`11_calendar`: notes, repetition, conversion, isolation) plus 15 (`12_calendar_notifications`), unit tests with the new fixtures, lint, build. **Not tested**: any screen in a browser; the migrations on the real project.
2026-10-19: The global calendar now detects the browser timezone and shows it beside a globe icon in the toolbar; the timezone selector was removed. Brand calendars continue using the selected brand timezone. Validation performed: targeted ESLint, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or timezone detection in a browser.

2026-10-20: Portal calendar entries now open a revision preview on hover or keyboard focus, using the existing approval and signed-media functions. Shared grid and list accept an optional entry renderer; admin calendar rendering is unchanged. Validation performed: targeted ESLint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser hover, keyboard focus, and signed media rendering.

2026-10-20: The shared preview used by portal calendar hover now chooses its media frame from the platform and format, shows failed-media fallbacks and supports keyboard carousel controls. See [channels.md](channels.md#platform-rules-preview-and-validation-guidance). Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: Vitest could not start because esbuild returned `spawn EPERM`; browser rendering for every platform and format.
2026-10-20: Calendar and content date/time displays now format in the stored IANA zone without appending GMT offsets; differing zones are exposed with a tooltip. The date-time field keeps offsets only when distinguishing repeated local times during daylight-saving changes. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. **Not verified**: full TypeScript check (blocked by existing errors in content editor, revision history and approvals), Vitest (could not start because esbuild returned `spawn EPERM`), browser rendering and daylight-saving selection in the browser.
2026-10-19: Calendar view selection is synchronized to local storage when selected or opened from a URL, including the week view opened from a day cell. Validation performed: pending. **Not tested**: browser storage behavior.

2026-10-19: The shared `DateTimeField` used for rescheduling now uses the localized calendar and time controls and shows its time zone in an icon tooltip. Validation performed: targeted ESLint, typecheck, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser interaction or daylight-saving edge cases in the new input.

2026-10-19: The event detail dialog now highlights the social channel and format and loads the matching channel caption on demand as a content preview. Validation performed: pending. **Not tested**: browser rendering and content-preview interaction.

2026-10-19: "Agendar conteúdo" from a calendar day now opens the existing content editor in a full-screen modal with the selected day prefilled. Closing uses the existing unsaved-change confirmation; saving creates the content, refreshes calendar entries and closes the modal without changing routes. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser interaction, modal sizing on mobile, save/refresh flow.

2026-10-19: Removed the separate "Datas" and "Ideias" visibility buttons; notes are now consistently included. Moved the filter and undated-content icon buttons beside the view selector in the calendar toolbar. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or responsive toolbar behavior.

2026-10-20 (events shared with the client, tasks E-01 to E-05): migration `20261020110000_calendar_events.sql` (the `event` kind, the new `calendar_notes` columns and their checks, the notification kind `calendar.event`, `calendar_note_days`, `calendar_event_when`, `calendar_event_notify`, and `calendar_note_save`, `calendar_note_archive`, `calendar_note_get`, `list_calendar_entries` and `portal_list_calendar` with events). Server: `notes.functions.ts`, `calendar.functions.ts`, `schemas.ts`, `portal-calendar.functions.ts`. Screens: "Adicionar evento" in the day menu, `EventDialog`, the "Visível para o cliente" switch on dates, icons by type (camera, people, calendar) and the eye mark on shared entries, the legend, the details with place, visibility and internal notes, and the portal calendar with events and `PortalEventDialog`. Validation performed: 42 SQL assertions in `20_calendar_events.test.sql` (850 in total, 0 failures: validation of the event shape, shared versus internal, brand A versus brand B, a client reading no note straight from the table, internal notes never in the portal output, weekly and multi-day expansion, the notifications on create, change, hide and archive, collaborator and anon refused), typecheck, lint, Vitest. **Not applied to the linked project**; **not seen in a browser**; **not tested**: the event dialog with a daylight-saving time, a multi-day event in the month grid, the filter by event in the team calendar (events are always listed with the other notes).

2026-10-22: The calendar remembers the last chosen brand in local storage and preselects it in global-calendar creation forms for content, ideas, dates and events. Brand-specific calendar contexts and existing notes retain their own brand. Files: `src/lib/shared/stored-keys.ts`, `src/components/marketing/calendar/calendar-page.tsx`, `src/components/marketing/calendar/note-dialog.tsx`, `src/components/marketing/calendar/event-dialog.tsx`, `src/components/marketing/content/content-editor-page.tsx`, `src/components/marketing/content/content-editor.tsx`. Validation performed: Prettier, targeted ESLint, TypeScript and `git diff --check`. **Not tested** in a browser.

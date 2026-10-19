# Module — Editorial calendar

> Functional specification. Context and conventions in [README.md](README.md). Spaces: `marketing` (`/admin/marketing/calendar` and the "Calendário" tab of a brand) and `portal` (calendar of the shared variants). The calendar components live in `shared/calendar`.

## Goal and scope

Show **what is planned, when and in which state**, for one brand or for all the authorized brands, and let the team move dates safely. Each entry is a **variant** (one channel, one occurrence). Production and approval **deadlines** are shown apart from the publication date.

Included: month, week and list views, filters, items without a date, drag to reschedule with confirmation, time zones and daylight saving, shareable URLs, portal calendar. Not included in the MVP: free-form events and tasks, external calendar sync (Google/ICS export is a later option), automatic publishing, resource planning.

## What appears on the calendar

| Entry | Source | Date | Display |
|---|---|---|---|
| Planned publication | `content_variants.planned_at` + `planned_timezone` | An instant with time | Timed item; color by editorial status; channel icon; thumbnail on hover |
| Production deadline | `content_items.production_due_date` | A local date | All-day item with a neutral style and a "prazo" marker |
| Approval deadline | `content_variants.approval_due_date` | A local date | All-day item with its own marker |
| Published manually | `published_at` | Real instant | Item with a "publicado" icon, at the real time |

Variants without a planned date do **not** appear on the grid; they stay in the side list **"Sem data"**.

## Time zones

- Instants are stored in UTC **plus** the IANA zone chosen at planning (the brand's zone by default; the organization's zone is the brand's default).
- Deadlines are local dates of the brand, without time.
- The calendar grid uses the zone of the **selected brand**; in the global view it uses the organization's zone with a visible selector, and each entry shows its own zone when it differs ("10:00 · America/Sao_Paulo").
- The editor of a date asks for date and time **in the brand's zone**; the server converts before saving. Non-existent and ambiguous local times (daylight-saving changes) are handled explicitly: a non-existent time is refused with a suggestion; an ambiguous one asks which occurrence.
- Mandatory tests: daylight-saving changes of a zone that has them (for example Europe/Lisbon in March and October) and a zone that has none (America/Sao_Paulo).

## Views and navigation

- **Month**, **Week** and **List**; today button; previous/next; a title with the range. Default: Week in Marketing Management, List on mobile.
- **Filters:** brand, client, channel, owner, editorial status, publication status, "somente prazos". Filters and the visible range live in the **URL** so links can be shared and the position restored when returning from a detail.
- **Side list "Sem data":** content without date, filtered the same way; drag a card onto the grid to plan it.
- **Legend:** status colors from `statusStyles` with icon and text; deadline markers explained.
- **Entry preview:** click opens a popover with title, brand, channel, status, time with zone and quick actions (open variant, reschedule); on mobile a bottom sheet.
- **Accessibility:** a **list alternative** is always available and keyboard-navigable; the grid supports arrow-key navigation; reschedule is also possible through a "Alterar data…" dialog (no drag required).

## Rescheduling

1. Drag an entry to another day/time, or use "Alterar data…".
2. A confirmation dialog shows old and new date/time **with the zone** and the effects:
   - variant `draft` / `in_production` / `internal_review`: just changes the date;
   - variant `awaiting_approval` or `approved`: warns that **a new revision and a new approval are required**; confirming calls `reschedule_variant`, which creates the new revision (the previous pending request is superseded);
   - variant already `published_manually`: refused (the publication record is a fact; correct it with a note);
   - date in the past: allowed only with an explicit warning.
3. Conflicts (optimistic `version`) show "Este item foi alterado por outra pessoa" and reload.
4. Deadlines can be changed by drag or in the editor; they do not require a new revision.

Dragging in the **portal** is not allowed (external users never reschedule).

## Alerts of conflict

The calendar shows non-blocking warnings, never silent changes:

- more than N variants of the same channel on the same day (configurable, default 3);
- the same brand and channel within a very short interval (default 30 minutes);
- a planned publication before the approval deadline, or before the variant is approved ("ainda não aprovado");
- a planned date in the past for a variant that is not published.

## Portal calendar

External users see a calendar restricted to the **brands they are linked to** and to the variants that were **sent or shared** with them (those with a revision in a request addressed to someone of their brand). It shows date, channel, status and the title of the revision snapshot; it never shows drafts, internal deadlines, owners or comments. Read-only; a click opens the approval screen. Data comes from `portal_list_calendar(brand, from, to)`.

## Queries and performance

> Functions: [../reference/functions.md](../reference/functions.md) section 6 (`list_calendar_entries`, `portal_list_calendar`, `reschedule_variant`). Error codes: [../reference/error-codes.md](../reference/error-codes.md). Constants: [../reference/enums.md](../reference/enums.md).

- `list_calendar_entries(p_from, p_to, p_brands, p_channels, p_assignee, p_editorial, p_publication)` filters by `calendar.view` and `can_access_brand`; the range is limited (maximum 100 days) and paginated; index `(brand_id, planned_at)`.
- The client requests only the visible range plus a margin; changing the range or filter cancels the previous request.
- Entries are plain data; no totals or aggregates are stored.

## Rules

1. An entry is always a variant; there are no free events.
2. The calendar never changes statuses by itself; it only reads and calls the transition/reschedule functions.
3. A date change after submission follows the new-revision rule; the calendar does not bypass it.
4. A variant on an archived channel keeps its entry; it cannot be moved to another date unless the channel is reactivated or the variant reassigned.
5. Everything shown respects brand access; counts never reveal brands the person cannot access.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `calendar.view` | See the calendar of linked brands | — |
| `calendar.manage` | Reschedule by drag/dialog and change deadlines | `calendar.view`, `content.update` |
| `portal.view` | See the portal calendar | — |

## Acceptance criteria

- The same event is shown at the same instant in every view; a brand in Europe/Lisbon and another in America/Sao_Paulo display their own zones correctly, including across daylight-saving changes.
- A content item with two channels appears as two entries with their own dates and statuses.
- Dragging an approved entry asks for confirmation, creates a new revision and returns the variant to awaiting approval.
- The portal calendar shows only shared variants of linked brands.
- Items without a date stay in "Sem data" and can be planned by drag or by dialog.
- Filters and range are restored from the URL; keyboard users can do everything without dragging.
- No calendar action triggers publishing or calls to social networks.

## Decisions of phase 4

1. **Own calendar, no library** (spike P4-01, 2026-10-18). FullCalendar was not adopted: it brings its own styles and time-zone plugin, which would have to be fitted to the tokens of [../standards/color-palette.md](../standards/color-palette.md), and the project needs only month, week and list views with day-level drag. The Memoria Print calendar was not ported (it is not part of this repository). The grid is a plain CSS grid in `shared/calendar` that reuses the kit, the status styles and the time-zone helpers of `format.ts`. Cost: no hourly lanes and no multi-day events, which the MVP does not need. If hourly lanes are wanted later, adopting a library becomes a new decision (CODE-12).
2. **Drag moves the day, not the time.** Dragging an entry to another day keeps its local time of day and always opens the confirmation dialog, where the time can be changed ("Alterar data…" is the keyboard alternative). Hour-level dragging is not offered.
3. **The approval deadline is read-only on the calendar.** It belongs to the approval request, which is immutable after sending (`approval_requests_guard`); changing it means sending a new version. Only the production deadline moves (`reschedule_production_deadline`, which does not create a revision).
4. **Rescheduling a variant that is awaiting approval or approved creates the new revision straight away**, copied from the current one with the new date and addressed to the same approver; the pending request is superseded (acceptance criterion "returns the variant to awaiting approval"). If the approver no longer has access the call fails with `approver_without_access` and nothing changes. A variant in any earlier state just changes its date.
5. **A date in the past is accepted by the server**; the dialog warns first (`date_in_past` is a UI warning, never raised by SQL).
6. **The conflict alerts use fixed limits** (3 publications per channel per day, 30 minutes between two of the same channel) kept in `lib/shared/calendar/alerts.ts`; they are not yet a setting of `policies.calendar`.
7. **The week starts on Monday.** `policies.calendar.weekStartsOnMonday` is stored but the calendar does not read it yet, because `organization_settings` is readable only with `settings.manage`.
8. **A window of at most 100 days and 500 entries** replaces pagination: `list_calendar_entries` answers with `truncated = true` and the screen asks the person to filter. The "Sem data" list comes in the same call (at most 100, filtered like the grid).
9. **Mobile shows the list** (the grid is not drawn below 768 px), as the document asks; the list is also available on desktop.

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

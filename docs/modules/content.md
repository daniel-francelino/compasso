# Module — Content

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (`/admin/marketing/content` and the "Conteúdos" tab of a brand). It is the **core** of the product together with [approvals.md](approvals.md) and [calendar.md](calendar.md).

## Goal and scope

A **content** is one piece of work for one brand: the person writes it once (text, files, objective, briefing), chooses **one or more channels** and, for each channel, the format and the publication date. The whole content goes through **one approval cycle**: when it is sent, it becomes an **immutable version** that is exactly what the client sees, with a preview tab per channel.

Included: contents with several channels, versions, internal comments, board and list by status, manual publication record per channel, cancelling and reopening, ideas and dates that can be converted into contents ([calendar.md](calendar.md)). Not included in the MVP: automatic publishing, campaigns and tasks, multiple approvers, content templates, AI assistance, metrics.

The earlier model (content item → variant per channel → revision) was replaced on 2026-10-19: the three layers confused the team and repeated the same text and files for every network (see [Open decisions](#open-decisions)). Benchmark: mLabs ("Agendar post"): 1 choose profiles, 2 choose channels, 3 text with tabs "Todos | one per channel", 4 media, 5 date and time per channel with "Incluir mais dias e horários", 6 settings.

## Concepts

| Concept | Meaning |
|---|---|
| Content (`content_items`) | The only editable aggregate: title, objective, briefing, **caption, call to action, files**, owner, tags, deadlines, internal notes, **editorial status**, approval fields, `version`. UI name: "Conteúdo" |
| Content channel (`content_channels`) | One row per **channel + format + publication occurrence** of a content: format, optional caption adjustment, planned date and zone, **publication status**, manual publication record. No editorial status, no versions and no approval of its own |
| Version (`content_revisions`) | **Immutable** snapshot of the whole content (caption, files, and every channel row with format, adjustment and date) taken when it is sent for approval. In the UI it is "Versão n", a history list, never a place where the person works |
| Version media (`content_revision_media`) | The ordered, immutable media **versions** shown in a version |
| Comment (`comments`) | Internal or external, attached to a content (and optionally to a version) |
| Calendar note (`calendar_notes`) | An idea or a date on the calendar that can become a content ([calendar.md](calendar.md)) |

Example: the campaign "Lançamento de outono" is one content with an Instagram carousel (Tuesday 10:00), an Instagram story (Tuesday 18:00) and a LinkedIn text (Wednesday 09:00): one caption, one set of files, three channel rows, one approval.

## Content

| Field | Rule |
|---|---|
| Brand | Required; fixed after creation |
| Title | Required; internal title, 2–140 characters (never shown to the client unless used as the version title) |
| Objective | Optional; one choice from the closed list `ContentObjective` (`awareness`, `engagement`, `traffic`, `leads`, `sales`, `community`, `other`) plus an optional free-text detail (up to 2000 characters) |
| Briefing | Optional; rich text (Tiptap JSON, closed set: bold, italic, heading, bullet and numbered lists; no links or HTML), up to 8000 characters; internal. Text saved before the editor existed (`{ "text": … }`) is read as paragraphs |
| Caption | One base text for every channel (plain text, up to 5000 characters) |
| Call to action | Optional text, up to 300 characters |
| Files | Ordered list of media **versions** from the library (up to 20, alternative text per usage), shared by every channel; the allowed count follows the strictest format among the channel rows. Items can be reordered by dragging the handle or with the keyboard; the saved order follows the list. |
| Owner | Optional; an internal user linked to the brand |
| Tags | Optional; up to 20 of 40 characters, edited with `TagInputField` |
| Production deadline | Optional; a **local date** of the brand (no time), chosen with `DatePickerField` |
| Internal notes | Optional; **never exposed to external users** |
| Editorial status | `EditorialStatus` of the whole content (see below) |
| `version` | Optimistic locking counter |

Briefing and internal notes live in tables that external roles cannot read; the portal only receives the version snapshot.

## Content channel

| Field | Rule |
|---|---|
| Channel | Required; an **active** channel of the same brand |
| Format | Required; `image`, `carousel`, `video`, `text`, `story`, `reel`, `article`, `other` (constant `ContentFormat`); the formats offered depend on the platform ([channels.md](channels.md): Instagram offers image, carousel, video, story and reel) |
| Caption adjustment | Optional; empty means the row uses the base caption |
| Planned date and time | Optional; stored as an instant (UTC) plus the IANA zone (brand zone by default) |
| Publication status | `PublicationStatus`: `unplanned`, `planned`, `published_manually`, `cancelled` |
| Manual publication | Real date and time, optional link and evidence file, optional note |

Rules: `planned_at` requires `planned_timezone`; `planned` requires `planned_at`; the same channel may appear more than once with different formats or dates ("Incluir mais dias e horários"); at most 20 rows per content; the content is "published" only when every non-cancelled row is `published_manually` (derived, never stored).

## Statuses and transitions

Editorial status of a content: `draft` → `in_production` → `internal_review` → `awaiting_approval` → `approved`; `changes_requested` after a request; `cancelled` at any time (constants `EditorialStatus`; the transition map lives in `shared/editorial`).

| From | To | Action required | Notes |
|---|---|---|---|
| `draft` | `in_production` | `content.update` | |
| `in_production` | `internal_review` | `content.update` | Optional step |
| `in_production` / `internal_review` | `awaiting_approval` | `content.submit` | Creates a version and an approval request ([approvals.md](approvals.md)); needs at least one channel row (`channel_required`) |
| `awaiting_approval` | `approved` / `changes_requested` | Designated approver | Through the portal |
| `changes_requested` | `in_production` | `content.update` | A new version is prepared |
| `approved` | `in_production` | `content.reopen` | Audited with a reason; clears the approved version and keeps history; refused once any channel row is published |
| any | `cancelled` | `content.cancel` | Does not delete history |

Publication status is separate and lives on each channel row: `unplanned → planned → published_manually | cancelled`. "Planned" is an **editorial date**; it never means a platform will publish automatically. "Scheduled" is reserved for a future integration that confirms a real scheduling.

## Versions

When a content is submitted (`submit_for_approval`):

1. The content row is locked (`for update`) and the expected `version` is checked (`conflict` if outdated).
2. A version is created with the title, base caption, call to action, brand zone and **every non-cancelled channel row** (row id, platform, profile name, format, caption adjustment, planned date and zone); the exact media versions in order go to `content_revision_media`.
3. The previous pending request of the content becomes `superseded`; a new approval request is created for the designated approver.
4. The content moves to `awaiting_approval`; notifications and an audit event are written in the same transaction.

Versions and their media rows are **immutable** (triggers refuse `update` and `delete`). Editing a content that is `awaiting_approval` edits the working copy and a **new version** must be sent; an `approved` content refuses a change of text, files, channels, formats or dates (`requires_new_revision`) until it is reopened. The internal title, objective, briefing, owner, tags, deadline and notes can change at any time.

## Screens and flows

Routes: `/admin/marketing/content` (all authorized brands), `/admin/marketing/brands/$brandId/content`, `/admin/marketing/content/new`, `/admin/marketing/content/$itemId`.

- **List:** title, brand, channel logos (up to 4 and "+N"), editorial status, next planned date, owner, deadline. Search; filters by brand, channel, owner, editorial status, publication status and tag in the shared filter popover; sorting by deadline, update or title. A single icon button beside the filter button switches between list and board. Main action "Novo conteúdo".
- **Board:** columns by editorial status; each card shows the channel logos, the format badges and the next planned date, and has a "Mover para…" menu that calls the transition function and obeys the table above. Card moves use the menu, not drag and drop (decision D13).
- **Editor** (one screen for create and edit, `ContentEditor`): sections numbered like mLabs.
  1. **Selecione os canais:** multi-select of the brand's active channels as platform logo buttons (`ChannelPicker`, `PlatformIcon`); a channel with a published row is locked; an empty state links to the channels tab. For a new content the brand is chosen first.
  2. **Texto do post:** tabs "Todos | one per channel row"; "Todos" holds the base caption, each row tab holds the optional adjustment (with the platform character guidance); the call to action is below.
  3. **Mídias:** the file strip with `MediaPicker`, drag-and-drop ordering with keyboard-accessible handle and alternative text; the count rule follows the strictest selected format.
  4. **Data e horário das publicações:** one line per channel row: logo, format select, date and time (`DateTimeField`, brand zone), "Registrar publicação" and "Cancelar este canal" icon buttons, and "Incluir mais dias e horários neste canal".
  5. **Configurações:** title, objective (select) and detail, briefing (`RichTextEditor`), owner, production deadline (`DatePickerField`), tags, internal notes.
  Right column: live `ChannelPreview` of the selected tab with the brand logo when registered, history of versions and decisions, internal comments. Actions: "Criar conteúdo"/"Salvar", "Iniciar produção", "Enviar para revisão interna", "Enviar para aprovação", "Reabrir", "Cancelar conteúdo". Unsaved changes warn before leaving; a save conflict keeps the typed text.
- **Send for approval dialog:** choose the **designated approver** among external members with `can_decide`; optional message; approval deadline; the dialog states "Isto cria a versão nº N. O cliente verá exatamente esta versão, com todos os canais."; checks run first (at least one channel, text or files, file count for every format, files available, channels active, dates in the future as a warning).
- **Manual publication:** "Registrar publicação" on a channel row (only when the content is `approved`) asks real date/time, link or evidence file (optional) and a note; it changes that row to `published_manually`, audits it and **never calls a social network**.
- **Reopen:** requires a reason; supersedes any pending request; the content returns to `in_production`.
- **Cancel:** the content (with confirmation and a reason) cancels its unpublished rows and pending requests; one channel row can be cancelled alone while another active row remains.
- **From an idea or a date:** "Converter em conteúdo" on the calendar opens `/admin/marketing/content/new?note=…` with the title and description (as the briefing) filled and, for a date, the day as the default planned day of every row; the note is linked only when that content is first saved ([calendar.md](calendar.md)).

## Comments

Comments belong to a content (and optionally a version) with visibility `internal` or `external`:

- Internal comments need `comments.create_internal`; external users never see them.
- External comments need `comments.create_external`; internal users with `approvals.view` see them with an "Externo" badge; they are shown to external users linked to the brand.
- Comments are plain text, immutable except for deletion by the author with an audit event. A decision comment is part of the decision and cannot be edited.
- A new external comment notifies the content owner.

## Rules

1. A channel row belongs to a content **and** a channel of the same brand (composite foreign keys).
2. Only files with status `available` can be attached; the exact media version is frozen on submission; replacing a file later never changes a past version.
3. A concurrent submission and decision are serialized by the row lock; the loser receives `revision_superseded` or `conflict`.
4. Rescheduling a channel row of a content in `awaiting_approval` or `approved` requires a new version (`requires_new_revision`; the calendar creates it, see [calendar.md](calendar.md)).
5. A cancelled content cancels its active channel rows; a cancelled brand blocks new content.
6. Drafts and internal notes are never visible to external users; only the submitted version snapshot is.
7. Optimistic locking: edits send `version`; on conflict the editor offers to reload and keeps the person's text.
8. Saving a content replaces its channel rows in one transaction: rows not sent are removed unless they were published (then the save is refused).

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

`content_items`, `content_channels`, `content_revisions`, `content_revision_media`, `comments` and `calendar_notes` as in [../reference/data-model.md](../reference/data-model.md) section 5 (composite foreign keys `(content_item_id, brand_id)` and `(channel_id, brand_id)`, immutability triggers, `unique (item_id, revision_no)`). Server functions: `content_item_save`, `content_move`, `submit_for_approval`, `reopen_content`, `reschedule_channel`, `mark_published`, plus `content_item_cancel`, `content_channel_cancel` and `content_item_delete`.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `content.view` | See contents of linked brands | — |
| `content.create` | Create contents | `content.view`, `channels.view` |
| `content.update` | Edit contents, channel rows and working copies; move status before approval | `content.view` |
| `content.delete` | Delete contents that were never sent or commented | `content.update` |
| `content.submit` | Send for approval | `content.update` |
| `content.cancel` | Cancel contents and channel rows | `content.update` |
| `content.reopen` | Reopen approved or pending contents | `content.update` |
| `content.publish_manual` | Record the manual publication of a channel row | `content.view` |
| `comments.create_internal` | Internal comments | `content.view` |

## Audit events

`content.created/updated/submitted/reopened/cancelled/deleted`, `content_channel.added/removed/rescheduled/published_manually/cancelled`, `comment.created/deleted`. The earlier `variant.*` actions stay in the catalog as **legacy** values so history already written keeps its labels; nothing writes them any more.

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`conflict`, `revision_superseded`, `requires_new_revision`, `channel_required`, `channel_archived`, `channel_brand_mismatch`, `media_not_available`, `approver_required`, `approver_without_access`, `transition_not_allowed`, `not_approved`, `content_has_history`, `denied`, `not_found`.

## Acceptance criteria

- One content with three channel rows (two formats of the same network and one other network) has one caption, one set of files and one approval, and three calendar entries with different dates.
- A channel row can carry its own caption adjustment; the client sees one tab per channel.
- Submitting freezes text, files, order, channels, formats and dates; editing the working copy afterwards does not change what the approver sees.
- A new submission supersedes the pending request and its approver sees a "versão substituída" notice.
- Editing the text, channels or dates of an approved content forces a new version and a new approval; reopening is audited with a reason.
- A file attached to an approved version cannot be overwritten or permanently deleted.
- Registering a manual publication is only possible for an approved content, per channel, and never triggers external calls.
- A content with no channel cannot be sent for approval.
- External users never receive the briefing, internal notes, internal comments or drafts.
- Board moves obey the transition table and are available by keyboard.
- Concurrent edits produce a `conflict` that keeps the typed text.
- An idea or a date converted into a content links to it once, when the content is first saved.

## Open decisions

| ID | Decision | Status |
|---|---|---|
| O1 | The **objective** is per content, from one closed list | Decided (2026-10-19) |
| O2 | Each channel having **its own files** (a vertical video for Reels, a square image for the feed) | Not in this delivery; add an optional per-channel list later without touching the shared one |
| O3 | The approval is **per content**; a channel the client does not want is removed by the team in a new version | Decided |
| O4 | A date change after approval creates a new version and a new approval (as before). If it proves heavy, take the planned date **out of the approved snapshot**: the approval would cover text and files and dates become scheduling | Open; revisit after real use |
| O5 | At most 20 channel rows per content | Decided |

## Implementation status

**Refactor to one content with several channels (Phase R, 2026-10-19).** Done in code: migrations `20261019130000_content_single_aggregate.sql` (guards the data, adds the editorial and caption columns to `content_items`, renames `content_variants` to `content_channels`, moves the `variant_id` columns of versions, requests and comments to `item_id`, redefines the guards, renames the notification kind to `content.publish_due`), `…130010_content_single_aggregate_functions.sql` (`content_item_save` with the channel rows, `content_move`, `content_channel_cancel`, `submit_for_approval`, `reopen_content`, `mark_published`, comments, approver functions, `audit_write` catalog), `…130020_calendar_notes.sql` (notes, `list_calendar_entries` with ideas and dates, `reschedule_channel`) and `…130030_content_single_aggregate_portal.sql` (portal, dashboard and scanner); server functions in `src/lib/marketing/content/*` (`content.functions.ts`, `workflow.functions.ts`, `comments.functions.ts`, `revisions.server.ts`), `src/lib/marketing/calendar/*`, `src/lib/portal/approvals/*`; the editor (`content-editor.tsx` with `ChannelPicker`, `CaptionSection`, `ChannelRowsSection`, `ContentSettingsSection`), the list and board with channel logos, the approval and portal screens with channel tabs (`RevisionView`), the calendar with logos, status marks, "Adicionar" on each day, ideas and dates; `PlatformIcon` moved to `shared/preview`; `variants.functions.ts`, the variant editor, the item page and the new-variant dialog were removed.

**Existing data.** The linked project had one content with one variant and no versions, requests or comments on 2026-10-19; the migration converts it (its caption, files and status move to the content and the variant becomes its first channel row). A backup of those rows was taken before the change. The migration refuses to run when a content has two or more variants or any version, request or comment exists (`content_single_aggregate: unsupported data`).

Validation performed: 741 pgTAP assertions on PGlite (tests 09 to 12 rewritten: 180 for content and approvals, 18 for the dashboard, 79 for the calendar and notes, 15 for the scanners; the rest unchanged), 132 Vitest tests (rich text schema, combined file rules, calendar fixtures), lint, Prettier, build, `check:consistency` for the SQL and TypeScript constants. The migrations were applied to the linked project on 2026-10-19 and the types regenerated from it; the existing content was converted and read back. **Not tested**: any screen in a browser; two simultaneous sessions; upload and signing from the editor against a real bucket; the portal flow with real accounts.

History of the earlier model (kept for context): phase 3 delivered items, variants and revisions on 2026-10-18 with 158 pgTAP assertions; decisions D12 (plain captions), D13 (board moves by menu), D14 (comments are never edited), D15 (internal review always available) are in [../pending-external-setup.md](../pending-external-setup.md); on 2026-10-19 the briefing became rich text (`RichTextEditor`, `RichTextView`, no migration), dates use `DatePickerField` and tags use `TagInputField`.

2026-10-19: The shared list-filter trigger now uses an icon with a tooltip and active-count badge. This applies to the content list. Validation performed: targeted ESLint, Prettier and `git diff --check`. `check:docs` is currently blocked by ten audit-action registry mismatches for `calendar_note.*` and `variant.*` in the audit/functions documents. Full typecheck is blocked by existing `brand-logos.server.ts` type errors. **Not tested**: browser interaction.

2026-10-19: Grouped publication rows by channel with the add-occurrence action in each channel header. Format options now carry format-specific icons; `DateTimeField` uses a localized calendar popover and a custom HH:mm time input, with the time zone exposed through an icon tooltip. Validation performed: targeted ESLint, typecheck, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser interaction or daylight-saving edge cases in the new input.

2026-10-19: The existing editor supports an embedded full-screen modal mode for scheduling content from a calendar day. Successful creation refreshes calendar entries and closes the modal without navigating to the content detail route. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser interaction or responsive modal layout.

2026-10-19: Content editor loading now uses section-level skeletons for the channel, copy, media, schedule, settings, preview and (for existing content) version and comment areas. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering during slow requests.

2026-10-19: Content editor actions now use compact buttons; reopen and cancel use icon buttons with tooltips, and internal review and approval use distinct message and send icons. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or tooltip interaction.

2026-10-19: Content media now use `@dnd-kit/react` for animated drag-and-drop reordering, with a keyboard-operable drag handle and the existing persisted list order. Files: `src/components/marketing/content/file-strip.tsx`, `package.json` and `package-lock.json`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs`, production dependency audit and `git diff --check`. **Not tested**: browser pointer, touch and keyboard interactions.

2026-10-19: The content editor's channel preview now uses the registered brand logo as its avatar, with the existing profile initial as fallback. Files: `src/components/marketing/content/content-editor.tsx` and `src/components/shared/preview/channel-preview.tsx`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or fallback behavior.

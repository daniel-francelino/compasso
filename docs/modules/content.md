# Module — Content

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (`/admin/marketing/content` and the "Conteúdos" tab of a brand). It is the **core** of the product together with [approvals.md](approvals.md).

## Goal and scope

A **content item** is an editorial idea that belongs to a brand: it holds the objective, the briefing, the owner, the deadlines and internal notes. Each item can originate several **variants**, one per channel and publication occurrence, each with its own format, caption, files, planned date and approval cycle. When a variant is sent for approval it becomes an **immutable revision** that is exactly what the client sees.

Included: items, variants, revisions, internal comments, board and list by status, manual publication record, cancelling and reopening. Not included in the MVP: automatic publishing, campaigns and tasks, multiple approvers, content templates, AI assistance, metrics.

## Concepts

| Concept | Meaning |
|---|---|
| Content item (`content_items`) | The idea: title, objective, briefing, owner, tags, production deadline, internal notes |
| Variant (`content_variants`) | The adaptation for **one channel and one publication occurrence**: format, caption, call to action, files, planned date, statuses |
| Revision (`content_revisions`) | **Immutable** snapshot of a variant at the moment it is sent for approval (text, files, order, channel, date) |
| Revision media (`content_revision_media`) | The ordered, immutable media **versions** shown in a revision |
| Comment (`comments`) | Internal or external, attached to a variant (and optionally to a revision) |

Example: a campaign "Lançamento de outono" generates a carousel for Instagram and a different text for LinkedIn: one item, two variants, with different dates, formats and decisions.

## Content item

| Field | Rule |
|---|---|
| Brand | Required; fixed after creation |
| Title | Required; internal title, 2–140 characters (never shown to the client unless used as the revision title) |
| Objective | Optional |
| Briefing | Optional; rich text (Tiptap JSON); internal |
| Owner | Optional; an internal user linked to the brand |
| Tags | Optional |
| Production deadline | Optional; a **local date** of the brand (no time) |
| Internal notes | Optional; **never exposed to external users** |
| Cancelled | Cancelling hides the item from active lists without deleting history |

Briefing and internal notes live in tables that external roles cannot read; the portal only receives the revision snapshot.

## Variant

| Field | Rule |
|---|---|
| Channel | Required; an **active** channel of the same brand |
| Format | Required; `image`, `carousel`, `video`, `text`, `story`, `reel`, `article`, `other` (constant `ContentFormat`); allowed formats depend on the channel platform |
| Caption | Rich text/plain per platform rules; counter with the platform guidance |
| Call to action | Optional text |
| Files | Ordered list of media **versions** from the library (max by format: for example a carousel up to 20) with alternative text per usage |
| Planned date and time | Optional; stored as an instant (UTC) plus the IANA zone (brand zone by default) |
| Approval deadline | Optional; a local date |
| Editorial status | See below |
| Publication status | `unplanned`, `planned`, `published_manually`, `cancelled` |
| `version` | Optimistic locking counter |

Rules: `planned_at` requires `planned_timezone`; publication status `planned` requires `planned_at`; `published_manually` requires an approved revision.

## Statuses and transitions

Editorial status of a variant: `draft` → `in_production` → `internal_review` → `awaiting_approval` → `approved`; `changes_requested` after a request; `cancelled` at any time (constants `EditorialStatus`; the transition map lives in `shared/editorial`).

| From | To | Action required | Notes |
|---|---|---|---|
| `draft` | `in_production` | `content.update` | |
| `in_production` | `internal_review` | `content.update` | Optional step; configurable (see organization settings) |
| `in_production` / `internal_review` | `awaiting_approval` | `content.submit` | Creates a revision and an approval request ([approvals.md](approvals.md)) |
| `awaiting_approval` | `approved` / `changes_requested` | Designated approver | Through the portal |
| `changes_requested` | `in_production` | `content.update` | A new revision is prepared |
| `approved` | `in_production` | `content.reopen` | Audited with a reason; clears the approved revision and keeps history |
| any | `cancelled` | `content.cancel` | Does not delete history |

Publication status is separate: `unplanned → planned → published_manually | cancelled`. "Planned" is an **editorial date**; it never means a platform will publish automatically. "Scheduled" is reserved for a future integration that confirms a real scheduling.

## Revisions

When a variant is submitted (`submit_for_approval`):

1. The variant row is locked (`for update`) and the expected `version` is checked (`conflict` if outdated).
2. A revision is created with `snapshot` = format, caption, call to action, channel (platform and profile name), planned date + zone, title shown to the client; the exact media versions in order go to `content_revision_media`.
3. The previous pending request of the variant becomes `superseded`; a new approval request is created for the designated approver.
4. The variant moves to `awaiting_approval`; notifications and an audit event are written in the same transaction.

Revisions and their media rows are **immutable** (triggers refuse `update` and `delete`). Editing a variant that is `awaiting_approval` or `approved` is not an in-place edit: the working copy is edited and a **new revision** is submitted. Changing text, files, order, channel or date after submission always requires a new revision and a new approval.

## Screens and flows

Routes: `/admin/marketing/content` (all authorized brands), `/admin/marketing/brands/$brandId/content`, `/admin/marketing/content/$itemId`, `/admin/marketing/variants/$variantId`.

- **List:** title, brand, channels (icons), statuses, planned date, owner, deadline. Search; filters by brand, channel, owner, editorial status, publication status and tag; sorting by deadline or planned date. Main action "Novo conteúdo".
- **Board:** columns by editorial status with drag and drop (`@dnd-kit`); moving a card calls the transition function and obeys the table above (a refused move returns the card and explains why). Keyboard alternative: a "Mover para…" menu.
- **Item page:** briefing, owner, deadlines, internal notes and the list of variants (one card per channel with status, date and thumbnail), action "Adicionar variante" (choose channel and format; option "Duplicar de outra variante" copies caption and files).
- **Variant editor:** caption editor with counter and guidance; file strip with the `MediaPicker`, ordering by buttons and drag, alternative text per file; date/time field with the **brand time zone** shown; platform preview (`ChannelPreview`) updating live; internal comments panel; history of revisions and decisions; action buttons contextual to the status: "Enviar para aprovação", "Reabrir", "Registrar publicação", "Cancelar".
- **Send for approval dialog:** choose the **designated approver** among external members with `can_decide`; optional message; approval deadline; the dialog states "Isto cria a revisão nº N. O cliente verá exatamente esta versão."; checks run first (required fields, files available, channel active, date in the future with a warning).
- **Manual publication:** "Registrar publicação" (only for the **currently approved** revision) asks real date/time, URL or evidence file (optional) and a note; it changes the publication status to `published_manually`, audits it and **never calls a social network**.
- **Reopen:** requires a reason; supersedes any pending request; the variant returns to `in_production`.
- **Cancel:** with confirmation; pending requests become `cancelled`.

## Comments

Comments belong to a variant (and optionally a revision) with visibility `internal` or `external`:

- Internal comments need `comments.create_internal`; external users never see them.
- External comments need `comments.create_external`; internal users with `approvals.view` see them with an "Externo" badge; they are shown to external users linked to the brand.
- Comments are plain text with mentions of internal users (optional later), immutable after 5 minutes except for deletion by the author with an audit event. A decision comment is part of the decision and cannot be edited.
- A new external comment notifies the content owner.

## Rules

1. A variant belongs to an item **and** a channel of the same brand (composite foreign keys).
2. Only files with status `available` can be attached; the exact media version is frozen on submission; replacing a file later never changes a past revision.
3. A concurrent submission and decision are serialized by the row lock; the loser receives `revision_superseded` or `conflict`.
4. Rescheduling a variant in `awaiting_approval` or `approved` requires a new revision (`requires_new_revision`).
5. A cancelled item cancels its active variants; a cancelled brand blocks new content.
6. Drafts and internal notes are never visible to external users; only the submitted revision snapshot is.
7. Optimistic locking: edits send `version`; on conflict the editor offers to reload and keeps the person's text.

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

`content_items`, `content_variants`, `content_revisions`, `content_revision_media`, `comments` as in [../reference/data-model.md](../reference/data-model.md) section 5 (composite FKs `(content_item_id, brand_id)` and `(channel_id, brand_id)`, immutability triggers, `unique (variant_id, revision_no)`). Server functions: `submit_for_approval`, `reopen_variant`, `reschedule_variant`, `mark_published`, plus `cancel_variant` and `cancel_item`.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `content.view` | See items and variants of linked brands | — |
| `content.create` | Create items and variants | `content.view`, `channels.view` |
| `content.update` | Edit items, variants and working copies; move status before approval | `content.view` |
| `content.delete` | Delete items without revisions | `content.update` |
| `content.submit` | Send for approval | `content.update` |
| `content.cancel` | Cancel items and variants | `content.update` |
| `content.reopen` | Reopen approved or pending variants | `content.update` |
| `content.publish_manual` | Record the manual publication | `content.view` |
| `comments.create_internal` | Internal comments | `content.view` |

## Audit events

`content.created/updated/cancelled/deleted`, `variant.created/updated/cancelled`, `variant.submitted`, `variant.reopened` (with reason), `variant.rescheduled`, `variant.published_manually`, `comment.created/deleted`.

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`conflict`, `revision_superseded`, `requires_new_revision`, `channel_archived`, `channel_brand_mismatch`, `media_not_available`, `approver_required`, `approver_without_access`, `transition_not_allowed`, `not_approved`, `denied`, `not_found`.

## Acceptance criteria

- A content item with two channels has two variants with different dates, formats and decisions.
- Submitting freezes text, files, order, channel and date; editing the working copy afterwards does not change what the approver sees.
- A new submission supersedes the pending request and its approver sees a "versão substituída" notice.
- Editing an approved variant forces a new revision and a new approval; reopening is audited with a reason.
- A file attached to an approved revision cannot be overwritten or permanently deleted.
- Registering a manual publication is only possible for the approved revision and never triggers external calls.
- External users never receive the briefing, internal notes, internal comments or drafts.
- Board moves obey the transition table and are available by keyboard.
- Concurrent edits produce a `conflict` that keeps the typed text.

## Implementation status

Not started (phase 3 of the plan).

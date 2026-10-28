# Module — Content

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (`/admin/marketing/content` and the "Conteúdos" tab of a brand). It is the **core** of the product together with [approvals.md](approvals.md) and [calendar.md](calendar.md).

## Goal and scope

A **content** is one piece of work for one brand: the person writes it once (the idea, the text and the files), says which **types** it is (Atmosfera, Produto, CTA…), chooses **one publication date** and **one or more channels** and, for each channel, the format and the date (which starts as the publication date and can be changed). The whole content goes through **one approval cycle**: when it is sent, it becomes an **immutable version** that is exactly what the client sees, with a preview tab per channel.

Included: contents with several channels, versions, internal comments, board and list by status, manual publication record per channel, cancelling and reopening, ideas and dates that can be converted into contents ([calendar.md](calendar.md)). Not included in the MVP: automatic publishing outside connected Instagram channels ([instagram-publishing.md](instagram-publishing.md)), campaigns and tasks, multiple approvers, content templates, AI assistance; metrics are a separate module ([metrics.md](metrics.md)).

The earlier model (content item → variant per channel → revision) was replaced on 2026-10-19: the three layers confused the team and repeated the same text and files for every network (see [Open decisions](#open-decisions)). Benchmark: mLabs ("Agendar post"): 1 choose profiles, 2 choose channels, 3 text with tabs "Todos | one per channel", 4 media, 5 date and time per channel with "Incluir mais dias e horários", 6 settings.

## Concepts

| Concept | Meaning |
|---|---|
| Content (`content_items`) | The only editable aggregate: title, **types**, **publication date**, planning idea and files, **caption, call to action, files**, owner, deadlines, internal notes, **editorial status**, approval fields, `version`. UI name: "Conteúdo" |
| Content type (`content_types`) | An entry of the organization's catalog (name, color and optional emoji) that a content can carry several of. Managed in the settings by `settings.manage`; archived instead of deleted. UI name: "Tipo de conteúdo" |
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
| Types | Optional; any number of active entries of the `content_types` catalog, chosen with a multi-select that has a search box ("Tipo de conteúdo"). They replace the objective: they say what the content is for (decided 2026-10-28). Not locked with the plan. An archived type stays on the contents that already have it and is no longer offered |
| Publication date | Optional; one **local date** of the brand (`publish_date`, no time), chosen in the planning card with `DatePickerField` ("Data de publicação"). Every channel row starts on this day (with the default hour) and keeps its own date and time: a row can be moved to another day. Changing the publication date moves only the rows that were on the previous publication date; a row already on another day stays. Locked together with the plan, like the dates of the rows |
| Planning idea | "Ideia inicial": free rich text (Tiptap JSON, closed set: bold, italic, heading, bullet and numbered lists; no links or HTML) where the person organizes the information as they like, with the "Referências" files below it. It is the only free-text briefing: the objective, the guided briefing fields and "Detalhes e notas" were removed from the screen and the portal on 2026-10-28 (their columns stay until a contract migration) |
| Caption | One base text for every channel (plain text, up to 5000 characters) |
| Call to action | Optional text, up to 300 characters |
| Files | Ordered list of media **versions** from the library (up to 20), shared by every channel; alternative text is no longer typed in the editor (decided 2026-10-24; an existing value is kept); the allowed count follows the strictest format among the channel rows. Items are shown as a grid of cards (type icon, name, thumbnail, order number) and reordered by dragging the thumbnail or with "Mover para antes"/"Mover para depois" in the card menu; the saved order follows the grid. The whole area is the drop zone, as in Google Drive: with no files it shows the empty state ("Arraste arquivos aqui ou clique para enviar"); with files it shows the grid plus an "Adicionar arquivos" tile, and files dropped anywhere on the area are uploaded. |
| Owner | Optional; an internal user linked to the brand |
| Tags | Not edited or saved any more (replaced by the types, 2026-10-28); the column stays with its old values until a contract migration |
| Production deadline | Not edited in the editor any more (removed with the briefing step, 2026-10-28). The calendar marker, the dashboard reason and the production reminders keep working on the dates already stored; whether to remove that whole chain is open decision O16 |
| Internal notes | Optional; **never exposed to external users** |
| Editorial status | `EditorialStatus` of the whole content (see below) |
| `version` | Optimistic locking counter |

Internal notes and types live in tables that external roles cannot read; the portal only receives the version snapshot, which no longer carries the objective in what the portal shows.

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

> Two approval stages (planning, then art) add four statuses and more transitions, in [Two-stage approval](#two-stage-approval-decided-2026-10-20). The table below is the art cycle, which is also the whole flow when `plan_required` is false.

Editorial status of a content: `draft` → `in_production` → `internal_review` → `awaiting_approval` → `approved`; `changes_requested` after a request; `cancelled` at any time (constants `EditorialStatus`; the transition map lives in `shared/editorial`).

| From | To | Action required | Notes |
|---|---|---|---|
| `draft` | `in_production` | `content.update` | |
| `in_production` | `internal_review` | `content.update` | Optional step |
| `in_production` / `internal_review` | `awaiting_approval` | `content.submit` | Creates a version and an approval request ([approvals.md](approvals.md)); needs at least one channel row (`channel_required`) |
| `awaiting_approval` | `approved` / `changes_requested` | Any approver of the brand | Through the portal; the first decision wins |
| `changes_requested` | `in_production` | `content.update` | A new version is prepared |
| `approved` | `in_production` | `content.reopen` | Audited with a reason; clears the approved version and keeps history; refused once any channel row is published |
| `approved` | `published` | `content.publish_manual` | Manual only, through "Marcar como publicado" (`publish_content`); every non-cancelled channel row must be `published_manually` (`channels_not_published`); terminal and read-only; the originals and the planning files are removed and only the previews stay ([content-publication.md](content-publication.md)) |
| any but `published` | `cancelled` | `content.cancel` | Does not delete history |

Publication status is separate and lives on each channel row: `unplanned → planned → published_manually | cancelled`. "Planned" is an **editorial date**; it never means a platform will publish automatically. "Scheduled" is reserved for a future integration that confirms a real scheduling.

## Versions

When a content is submitted (`submit_for_approval`):

1. The content row is locked (`for update`) and the expected `version` is checked (`conflict` if outdated).
2. A version is created with the title, base caption, call to action, brand zone and **every non-cancelled channel row** (row id, platform, profile name, format, caption adjustment, planned date and zone); the exact media versions in order go to `content_revision_media`.
3. The previous pending request of the content becomes `superseded`; a new approval request is created for the brand's approvers (anyone who can approve may decide).
4. The content moves to `awaiting_approval`; notifications and an audit event are written in the same transaction.

Versions and their media rows are **immutable** (triggers refuse `update` and `delete`). Editing a content that is `awaiting_approval` edits the working copy and a **new version** must be sent; an `approved` content refuses a change of text, files, channels, formats or dates (`requires_new_revision`) until it is reopened. The internal title, objective, briefing, owner, tags, deadline and notes can change at any time.

## Screens and flows

Routes: `/admin/marketing/content` (all authorized brands), `/admin/marketing/brands/$brandId/content`, `/admin/marketing/content/new`, `/admin/marketing/content/$itemId`.

- **List:** the columns follow the agency's own calendar: **"Data"** first (the publication date; the migration filled it for existing contents with the earliest planned day of their rows; "—" when there is none), then "Tipos" (one or more colored chips with the emoji), "Conteúdo" (the name), "Formato" (the formats of the active rows), "Canais" (logos, up to 4 and "+N"), "Estado" and "Responsável". The default order is **chronological, oldest date first**, contents without a date last; the "Data" header toggles the direction; sorting is also by update or title. Search; filters by brand, channel, owner, editorial status, publication status and type in the shared filter popover. A single icon button beside the filter button switches between list and board. Main action "Novo conteúdo". The page is limited to `max-w-7xl` and centered, like the editor. The row menu says only the action, since the page is already about content: "Editar", "Abrir", "Duplicar", "Cancelar", "Excluir".
- **Board:** columns by editorial status; each card shows the channel logos, the format badges and the next planned date, and has a "Mover para…" menu that calls the transition function and obeys the table above. Card moves use the menu, not drag and drop (decision D13).
- **Editor** (one screen for create and edit, `ContentEditor`) is split into two compact, connected steps: **Planejamento** and **Conteúdo** (the "Briefing" step was removed on 2026-10-28). The current step is indicated by a numbered circle; steps are directly selectable and share one draft and save action. A step that holds a field with an error shows an alert mark in the step bar, and a failed save or send **moves to the first step with an error and focuses its first invalid field**, so a required field forgotten in "Planejamento" (the only required field is the content name, plus the brand and at least one channel) is found from "Conteúdo" without searching.
  1. **Planejamento:** two columns from `xl`. **Left:** one large card titled **"Briefing"** with the types ("Tipo de conteúdo", multi-select with search), the publication date ("Data de publicação"), the "Ideia inicial" rich-text field (taller than before, so the person can organize the information freely) and the "Referências" files. **Right:** the card "Identificação" (content name "Nome do conteúdo", the brand for a new content, the owner "Responsável") and the channel card (channel selection and multi-selectable formats; Instagram offers post, carousel, story and reel; a video goes inside a post, carousel or reel). Each selected channel and format becomes a publication row that starts on the publication date with its own preview. Internal notes remain in the content model but are not shown in the editor.
  2. **Conteúdo:** caption tabs "Todos | one per channel row", call to action, media strip (`MediaPicker`) with keyboard-accessible ordering and alternative text, and publication rows with the selected format, date/time (`DateTimeField`), "Registrar publica??o", "Cancelar este canal" and "Adicionar publicação".
  The right column keeps only the preview of the "Conteúdo" step; the revision history and the comments moved to the **Atividade** section at the bottom of the editor (see "Activity section"). `ChannelPreview` accompanies the content step. Actions in the editor header: always visible are the main progression of the status (for example "Iniciar produção"), "Enviar para aprovação" (or the review step) and "Criar conteúdo"/"Salvar"; the **"⋯" menu** holds the rest: the other state moves, "Aprovar planejamento"/"Aprovar artes" (the team approves on behalf of the client, with or without a request already sent; saved changes only), "Reabrir planejamento", "Reabrir artes", "Marcar como publicado", "Duplicar" and "Cancelar conteúdo". Unsaved changes warn before leaving; a save conflict keeps the typed text.
- **Send for approval dialog:** by stage ("Enviar planejamento para aprovação" or "Enviar artes para aprovação"); it lists who will be asked, the brand's approvers, with no choice to make, and refuses to send when there is nobody ("Convidar aprovador"); optional message; approval deadline; the dialog states "Isto cria a versão nº N … O cliente verá exatamente esta versão."; checks run first (plan: a channel with a planned date, files available; art: at least one channel, text or files, file count for every format, files available, channels active, dates in the future as a warning).
- **Manual publication:** "Registrar publicação" on a channel row (only when the content is `approved`) asks real date/time, link or evidence file (optional) and a note; it changes that row to `published_manually`, audits it and **never calls a social network**.
- **Reopen:** requires a reason; supersedes any pending request; the content returns to `in_production`.
- **Duplicate:** "Duplicar conteúdo" (row menu of the list and an icon button in the editor, with `content.create`) creates a new draft in the same brand through `content_item_save`, with the title "Cópia de …", and opens it. It copies types, internal notes, owner, base caption, call to action, planning summary, planning files, art files and the active channel rows with format and caption adjustment. It does **not** copy the publication date, planned dates, publication data, versions, approvals, comments or archived/cancelled channel rows; the editorial status restarts as for any new content.
- **Cancel:** the content (with confirmation and a reason) cancels its unpublished rows and pending requests; one channel row can be cancelled alone while another active row remains.
- **From an idea or a date:** "Converter em conteúdo" on the calendar opens `/admin/marketing/content/new?note=…` with the title and the description (as the "Ideia inicial") filled and, for a date, the day as the publication date, which the rows inherit; the note is linked only when that content is first saved ([calendar.md](calendar.md)).

## Comments

Comments belong to a content (and optionally a version) with visibility `internal` or `external`:

- Internal comments need `comments.create_internal`; external users never see them.
- External comments need `comments.create_external`; internal users with `approvals.view` see them with an "Externo" badge; they are shown to external users linked to the brand.
- Comments are plain text. **The author can edit their own comment** at any time while it exists (decided 2026-10-24, replaces D14): the text changes, `edited_at` is set, the screen shows "editado" and an audit event `comment.edited` records only ids. The author can also delete it (audit event). Nobody else can edit or delete a comment. A decision comment is part of the decision and cannot be edited.
- **Replies** (decided 2026-10-24): a comment can be answered; there is **one level** (a reply to a reply is attached to the same thread). A reply has the same visibility as the comment it answers and needs the matching create action. A deleted comment that still has replies stays as a placeholder ("Comentário removido") so the thread keeps its meaning. The client portal list does not show threads: it keeps listing external comments flat.
- A new external comment notifies the content owner.

## Activity section

Decided 2026-10-24, modelled on the **Activity** section of a Jira work item. Reference notes (what is documented by Atlassian and what is general knowledge, so it can be checked later):

| Jira behaviour | Source | Aura Creative |
|---|---|---|
| Activity is near the bottom of the work item, below the fields | [Atlassian: types of activity on an issue](https://support.atlassian.com/jira-software-cloud/docs/what-are-the-different-types-of-activity-on-an-issue/) | Card "Atividade" below the editor steps, full width, only for a saved content |
| Filters: **All**, **Comments**, **History**, **Work log** ("All" was added to the new issue view in 2021) | same page; [JRACLOUD-73217](https://jira.atlassian.com/browse/JRACLOUD-73217) | Two tabs, **Comentários** (default) and **Histórico**; no "All" or work log (no time tracking exists) |
| The Activity tabs cannot be disabled; some were hidden behind a "More" menu in Server/Data Center, which users asked to revert | [Tempo KB](https://help.tempo.io/kb/latest/issue-activity-tabs-and-information-displayed-in-t); [JIRAAUTOSERVER-1217](https://jira.atlassian.com/browse/JIRAAUTOSERVER-1217) | Tabs stay visible, never in a menu |
| Newest-first ordering applies to comments and history together | secondary source (a third-party blog), not verified in an instance | **No sort toggle** (decided 2026-10-24): comments are newest first (replies oldest first inside a thread), the history is newest first |
| Keyboard shortcut **M** jumps to the comment field; Jira Service Management lets the agent choose "Add internal note" or "Reply to customer" | [Atlassian keyboard shortcuts](https://support.atlassian.com/jira-software-cloud/docs/use-keyboard-shortcuts/); [Watch, vote, share and comment](https://support.atlassian.com/jira-service-management-cloud/docs/watch-and-share-issues-from-the-new-issue-view/) | The visibility choice is the existing "Quem vê" (internal or external); the **M** shortcut is **not** implemented (a global key needs its own decision) |
| A collapsed "Add a comment…" box with the person's avatar that expands into the editor with Save and Cancel; each comment shows avatar, name, time, Edit / Delete and Reply; history lines read "person changed field from A to B" | general knowledge of the Jira UI, **not found in the sources above** | Collapsed box "Adicionar um comentário…" with the person's avatar; expands to the text area, "Quem vê", "Cancelar" and "Comentar"; comments show avatar, name, time, "Responder" and, for the author, the "⋯" menu with "Editar" and "Excluir"; history is a feed of events with avatar, person, action and time |

Rules:

- **Comentários** tab: the composer comes first (collapsed until focused; cancelling clears the text), then the threads, newest first, with the replies of each thread below it, oldest first, indented with a guide line. Each comment: avatar, name, date and time, "editado" when edited, version number when it belongs to a version, the "Externo" badge, "Responder", the "⋯" menu for the author, the text. The tab label shows the number of comments (replies included) as a badge. The section uses its own icon (`Activity`), different from the comments tab. Panels animate with Motion (expanding composer and replies, entering and leaving comments, tab change), respecting `prefers-reduced-motion`. States: loading, error, empty ("Nenhum comentário"), data.
- **Histórico** tab: a feed of the approval events of the content, one line per event: request sent (who, stage, version, deadline), decision (who, outcome, the decision comment) and cancellation (reason). It reads the data of the approval requests only; there is no field-level change history in the product, and the audit screen stays the place for it.
- Permissions are unchanged: the composer needs `comments.create_internal` or `comments.create_external`; the list follows the existing visibility rules. No new function, action, audit action or error code.

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

`conflict`, `revision_superseded`, `requires_new_revision`, `channel_required`, `channel_archived`, `channel_brand_mismatch`, `media_not_available`, `approver_required`, `plan_not_approved`, `plan_locked`, `plan_incomplete`, `transition_not_allowed`, `not_approved`, `content_has_history`, `denied`, `not_found`.

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

## Two-stage approval (decided 2026-10-20)

> Status: **implemented in code and on PGlite (2026-10-20)**, not applied to the linked project and not seen in a browser (see the implementation status). The sections above describe the single approval cycle, which is what a content with `plan_required = false` still follows; this section is the rule for the others (DOC-5: fold it into the sections above once the migrations are applied and the flow was used for real).

### Why

The agency works in two client approvals: first the **planning** (what will be posted, where, in which format and when, and the direction of the text), and only after the client approves it does the team **create the art** (files and final text), which the client approves again. Today a content has one cycle that mixes both, so the team either produces art before the plan is agreed or sends a plan without a proper place for it.

### The two stages

| Stage | Constant | What the team prepares | What the client sees and decides | Frozen after approval |
|---|---|---|---|---|
| Planning | `ApprovalStage.Plan` (`plan`) | Title, objective, **planning summary** (client-facing text), draft of the caption (optional), channel rows with format and planned date, and optional **planning images** (references, sketches, layout drafts) | A **plan version**: title, objective, planning summary, caption draft, the planning images, one tab per channel with its format and planned date and time (with zone). The planning images are **not the art** | Channels, formats, planned dates, objective, planning summary, planning images |
| Art | `ApprovalStage.Art` (`art`) | Final caption, call to action, files, channel caption adjustments | An **art version**: the whole content as today (preview per channel, caption, files), plus the approved plan as context | Caption, call to action, files, adjustments (as today) |

Rules:

1. **Art files can be attached at any time** (decided 2026-10-20), alongside the planning images. What waits for the plan is the **art approval**: `submit_for_approval` for the art stage is refused with `plan_not_approved` until the plan is approved.
2. Each stage has its **own approval cycle**: its own versions, its own request, its own decision, supersession and reopening. At most one pending request per content (the existing index) because the stages are sequential.
3. Versions are numbered by one running counter per content ("Versão 1" is the plan, "Versão 2" the first art, and so on); the stage is shown next to the number ("Planejamento · Versão 1", "Artes · Versão 2"). `unique (item_id, revision_no)` stays.
4. After the plan is approved, **channels, formats, planned dates, objective and the planning summary are locked**: changing them is refused with `plan_locked`. To change the plan the team uses **"Reabrir planejamento"** (`content.reopen`, reason required): it supersedes any pending request, clears the plan approval **and** the art approval, keeps the files and the history, and returns the content to `planning`. Rescheduling a channel from the calendar after the plan is approved follows the same rule (see O7).
5. Once the art is approved the content behaves as today: manual publication per channel row, "Reabrir" (art only, to `in_production`) with a reason, and `requires_new_revision` for any change of caption or files.
6. The plan stage is **optional per organization**: policy `requirePlanApproval` in the approvals settings group, default on ([organization-settings.md](organization-settings.md)). The value is copied to the content when it is created (`plan_required`) so changing the policy never changes a content already in progress. With `plan_required = false` the content goes `draft → in_production` and has only the art stage, exactly as today. Contents that exist when phase T is migrated get `plan_required = false`.

### Editorial statuses

`EditorialStatus` gets four values; the transition map in `shared/editorial` and the `CHECK` change with them.

| Status | Meaning |
|---|---|
| `draft` | Idea or brief, nothing sent |
| `planning` (new) | The team is writing the plan |
| `awaiting_plan_approval` (new) | A plan version is with the client |
| `plan_changes_requested` (new) | The client asked for changes to the plan |
| `plan_approved` (new) | The plan is approved; art production can start |
| `in_production` | Art in production (as today) |
| `internal_review` | Optional internal review of the art (as today) |
| `awaiting_approval` | An art version is with the client (as today) |
| `changes_requested` | The client asked for changes to the art (as today) |
| `approved` | Art approved (as today) |
| `cancelled` | Cancelled (as today) |

| From | To | Action required | Notes |
|---|---|---|---|
| `draft` | `planning` | `content.update` | Only when `plan_required` |
| `draft` | `in_production` | `content.update` | Only when not `plan_required` (today's path) |
| `planning` / `plan_changes_requested` | `awaiting_plan_approval` | `content.submit` | Creates a plan version and a request; needs at least one channel row with a planned date (`channel_required`, `plan_incomplete`) |
| `awaiting_plan_approval` | `plan_approved` / `plan_changes_requested` | An eligible approver | Through the portal ([approvals.md](approvals.md)) |
| `plan_changes_requested` | `planning` | `content.update` | The plan is edited again |
| `plan_approved` | `in_production` | `content.update` | "Iniciar produção das artes" |
| `in_production` / `internal_review` | `awaiting_approval` | `content.submit` | Art stage as today; refused with `plan_not_approved` when the plan is required and not approved |
| `plan_approved`, `in_production`, `internal_review`, `changes_requested`, `awaiting_approval`, `approved` | `planning` | `content.reopen` | "Reabrir planejamento"; reason required; audited |
| any | `cancelled` | `content.cancel` | As today |

Publication status of the channel rows is unchanged. Recording a manual publication still requires `approved`.

### Data model changes (to be added to [../reference/data-model.md](../reference/data-model.md) in task T-01)

| Table | Change |
|---|---|
| `content_items` | `plan_required boolean not null`; `plan_media jsonb not null default '[]'` (ordered `{ media_version_id, alt_text }`, at most 10, images only); `plan_summary text` (client-facing, up to 4000 characters, plain text); `plan_approved_revision_id` (the approved plan version, composite foreign key like `approved_revision_id`); `editorial_status` `CHECK` extended with the four new values |
| `content_revisions` | `stage text not null check (stage in ('plan','art'))`, default `art` for rows that exist; the plan snapshot holds title, objective, planning summary, caption draft the channel rows with format and planned date, and the **planning images** in order (stored in `content_revision_media`; the art version holds the art files only) |
| `approval_requests` | `stage` (same values, copied from the version); `approver_user_id` becomes nullable and stops being written ([approvals.md](approvals.md), approver pool) |
| `organization_settings` (key `approvals`) | New field `requirePlanApproval` (boolean, default true) in the zod schema of the group |

Migration strategy (expand, then contract; DATA-12): count the rows first; add the columns with defaults that describe today's behavior (`stage = 'art'`, `plan_required = false` for existing contents); migrate the code; only then drop the designated-approver code and columns in the contract migration.

### Functions

| Function | Change |
|---|---|
| `submit_for_approval(p_item, p_due_date, p_message, p_expected_version)` | No approver parameter. The stage comes from the editorial status (planning side sends a plan, production side sends an art). The plan stage requires a channel row with a planned date; the art stage requires `plan_approved` (or not `plan_required`), text or files and the file rules of today. Notifies every eligible approver |
| `content_move` | Handles `draft → planning`, `plan_changes_requested → planning` and `plan_approved → in_production` (no side effects) |
| `reopen_content(p_item, p_reason, p_scope)` | `p_scope` is `art` (today's behavior) or `plan` |
| `content_item_save` | Refuses channels, formats, dates, objective and planning summary once the plan is approved (`plan_locked`); accepts art files at any stage (migration `20261020120000_content_art_files_before_plan.sql`) |
| `reschedule_channel` | After the plan approval it returns `plan_locked` (see O7) |
| `portal_decide_approval`, `portal_get_approval`, `portal_list_pending` | Follow the approver pool ([approvals.md](approvals.md)); every result carries `stage` |

### Screens

- **Editor:** a stepper at the top, "Planejamento" and "Artes", with the status of each (pendente, em aprovação, aprovado). In planning the editor shows the channels, the planning summary and caption draft, the **planning images** (an optional file strip with the same picker, ordering and alternative text as the art files, up to 10 images), the dates per channel and the settings; the art files section is locked. In art it shows everything, with channels, formats and dates read-only and a link "Reabrir planejamento". The primary action follows the stage: "Enviar planejamento para aprovação", "Iniciar produção das artes", "Enviar artes para aprovação".
- **Send dialog:** no approver choice. It lists who will be asked to decide (the brand members who can approve), the optional message and the approval deadline, and says "Isto cria a versão nº N do planejamento/das artes. O cliente verá exatamente esta versão."
- **List and board:** one board column per editorial status that exists; a stage badge ("Planejamento", "Artes") beside the status badge; filter by stage.
- **Calendar and dashboard:** entries of a content in planning keep their dates and show the planning status icon; the dashboard counts pending approvals by stage.
- **Portal:** the card and the review screen show the stage badge. A plan version shows its planning images (when there are any) next to the caption draft and the channel with format and date, and the screen says what is being approved ("Você está aprovando o planejamento: canais, formatos, datas e direção do texto. As artes vêm depois.").

### Registries and copy to add in task T-01

- Enums: `ApprovalStage` (`plan`, `art`); `EditorialStatus` with `planning`, `awaiting_plan_approval`, `plan_changes_requested`, `plan_approved`.
- Error codes: `plan_not_approved` ("Aguarde a aprovação do planejamento para enviar as artes."), `plan_locked` ("O planejamento já foi aprovado. Reabra o planejamento para mudar canais, formatos ou datas."), `plan_incomplete` ("Para enviar o planejamento, escolha ao menos um canal com data e horário.").
- Audit: no new action; `content.submitted`, `content.reopened` and `approval.decided` carry `stage` in their metadata.
- Notifications: no new kind; the title and body of `approval.requested` and `approval.decided` name the stage ("Planejamento aguarda sua decisão", "Artes aguardam sua decisão").
- Glossary: Planning "Planejamento"; Art "Artes"; Reopen the plan "Reabrir planejamento"; Start art "Iniciar produção das artes"; Plan approved "Planejamento aprovado".

### Acceptance criteria (two stages)

- With the policy on, a new content cannot send art, and cannot attach files, before the plan is approved.
- The client sees a plan version (summary, caption draft, channels, dates and the optional planning images) and an art version (the final files); each is immutable and has its own request and decision.
- A content can go to planning approval with images or without any; images attached to the plan are never treated as the art, and art production still waits for the plan approval.
- After the plan is approved, channels, formats and dates are locked; "Reabrir planejamento" unlocks them with a reason, supersedes any pending request and clears both approvals.
- A change requested on the plan returns the content to `planning`; a change requested on the art returns it to `in_production`; neither affects the other approval until reopened.
- With the policy off, or on a content created before phase T, the flow is exactly today's single cycle.
- The board, the list, the calendar and the portal show the stage and use the new statuses.

## Flexible approval (decided 2026-10-22)

> Status: **implemented in the database, the server and the editor** (2026-10-23, see the implementation status); the board, list badge and filter are still missing. The names are in the registries ([../reference/README.md](../reference/README.md)). The request, decision and notification rules are in [approvals.md](approvals.md#approval-by-the-team-decided-2026-10-22).

### Why

The client's approval must not block publication. A client may trust the agency and have no interest in approving every piece, or may simply not answer. Today a content only reaches `approved`, and therefore `published`, through a client decision, so a silent client stops the work. The **content manager** can now record the approval **on the client's behalf**, for the plan and for the art, whenever they judge it appropriate.

This does not break "delay or silence never equals approval" ([approvals.md](approvals.md) rule 6): nothing is approved by itself. A named person with the permission does it explicitly, and the history shows it.

### All editorial statuses at a glance

`EditorialStatus` does **not** change: the approval given by the team lands on the same `plan_approved` and `approved` statuses, so manual publication, locks, reopening and the portal history keep working without a new case.

| Status | Stage | Who puts the content here | The client sees |
|---|---|---|---|
| `draft` | — | Creation | Nothing |
| `planning` | Plan | Team (`content.update`), only when `plan_required` | Nothing |
| `awaiting_plan_approval` | Plan | Team sends the plan (`content.submit`) | A plan request |
| `plan_changes_requested` | Plan | Client asks for changes | Their own decision |
| `plan_approved` | Plan | **Client** approves, **or the manager approves for the client** | The plan as approved |
| `in_production` | Art | Team (`content.update`) | Nothing |
| `internal_review` | Art | Team (optional step) | Nothing |
| `awaiting_approval` | Art | Team sends the art (`content.submit`) | An art request |
| `changes_requested` | Art | Client asks for changes | Their own decision |
| `approved` | Art | **Client** approves, **or the manager approves for the client** | The art as approved |
| `published` | — | Manual only (`content.publish_manual`); terminal | The preview |
| `cancelled` | — | `content.cancel` | History |

With `plan_required = false` the plan rows do not apply and the content goes `draft → in_production → … → approved → published`.

### What the manager can do

| Situation | Manager action | Result |
|---|---|---|
| Plan not yet sent, being written or with changes requested | "Aprovar planejamento pelo cliente" | `plan_approved`; art production can start |
| Plan sent and the client has not answered | Same action | The pending request is closed (approvals.md), `plan_approved` |
| Art in production, in internal review, with changes requested or sent and unanswered | "Aprovar arte pelo cliente" | `approved`; the content is ready for manual publication |
| Client already decided | Nothing to override | The first decision wins; the second attempt gets `request_not_pending` |

Rules:

1. **Permission.** A new action `approvals.override` (internal, requires `content.submit`), held by `owner` (implicit) and by the starting role `manager`; `collaborator` does not have it. It replaces the reserved action of the same name in [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md). The brand link is checked as usual (SEC-2).
2. **Allowed from any status before that stage's approval**, except `cancelled` and `published`. The action is refused with `transition_not_allowed` otherwise.
3. **The art needs the plan first** when `plan_required` is true and the plan is not approved (`plan_not_approved`, decision O10). The manager approves the plan, then the art.
4. **There is always a version.** Approving on behalf freezes the content exactly as sending would, so `approved_revision_id` / `plan_approved_revision_id`, the locks (`plan_locked`, `requires_new_revision`) and manual publication behave as after a client approval. The same checks run as for sending: at least one channel row (`channel_required`), a channel with a planned date for the plan (`plan_incomplete`), files available (`media_not_available`), channels active (`channel_archived`).
5. **Never by a plain status move.** `content_move` keeps refusing `plan_approved` and `approved` (`transition_not_allowed`); only the dedicated function writes them, because a status without a frozen version would break rule 4.
6. **Reopening is unchanged** (`content.reopen`, reason required, plan or art scope). After reopening, the manager may approve again or send a new request.
7. **Optimistic locking** as everywhere: the call carries the expected `version` (`conflict`).
8. **Visible in the history.** The version list and the decision timeline show "Aprovado pela equipe" with the manager's name internally; the client sees "Aprovado pela equipe" without a name. The optional reason is internal only and is never returned by a `portal_*` function (DATA-2).

### Screens

- **Editor, actions:** for people with `approvals.override`, a secondary action follows the stage: "Aprovar planejamento pelo cliente" or "Aprovar arte pelo cliente". It opens a `ConfirmDialog`/`ReasonDialog` titled "Aprovar no lugar do cliente" with the text "Você está registrando a aprovação do cliente. Isto fica no histórico com o seu nome. Se houver um pedido aberto, ele será encerrado e o cliente será avisado." and an optional reason. The primary action is still "Enviar … para aprovação"; the override is never the default.
- **Board:** "Mover para…" offers "Planejamento aprovado" and "Aprovado" to those people, and choosing one opens the same dialog instead of calling `content_move`.
- **List and board badges:** a small "Aprovado pela equipe" marker next to the status badge when the approving decision was made on behalf; filterable in the shared filter popover.
- **Approvals list and request detail (team):** the decided request shows "Aprovado pela equipe por {nome}" and the reason.
- **Portal:** a request closed this way leaves "Aguardando você" and appears in the decisions list as "Aprovado pela equipe"; the review screen is read-only and says "A equipe aprovou esta versão. Você ainda pode comentar."

### Acceptance criteria (flexible approval)

- A manager approves a plan that was never sent: the content becomes `plan_approved`, a plan version exists, and art production can start with no client action.
- A manager approves an art while its request is pending: the request is closed as approved by the team, the content is `approved`, the eligible approvers are notified and their "Aguardando você" entry disappears.
- A collaborator, or any user without `approvals.override`, cannot call the function and does not see the actions; an external user can never call it; a manager of brand A cannot act on brand B.
- Moving a card to "Aprovado" without the function is refused; with the function it works from the board.
- After an approval by the team the content behaves like a client-approved one: channels and text are locked, "Marcar como publicado" works, reopening works with a reason.
- Two simultaneous attempts (client and manager) leave one decision; the loser gets a clear error and the typed reason is not lost.
- The audit shows who approved, for which stage and with which version, with ids only (SEC-12).

## Open decisions

| ID | Decision | Status |
|---|---|---|
| O10 | Approving the **art on behalf** while `plan_required` and the plan is not approved: refuse (`plan_not_approved`) and have the manager approve the plan first, so the chain stays consistent | Decided 2026-10-23 (the recommendation) |
| O11 | The **reason** of an approval on behalf is optional ("Motivo (opcional)") so it does not slow the manager down; the record of who approved is mandatory either way | Decided 2026-10-23 (the recommendation) |
| O12 | Where the flexibility is decided: **per content, by the manager**, with no brand-level setting such as "client approval optional". A default per brand can be added later if managers repeat the click for the same clients | Decided 2026-10-22 |
| O13 | Status used after the approval by the team: the **same** `plan_approved` and `approved`, with the origin kept in the decision (`on_behalf`), not a new status | Decided 2026-10-22 |
| O14 | The `Briefing` step has **persisted guided fields** (audience and context, key message, creative direction, tone and things to avoid) plus the existing rich text, renamed "Detalhes e notas" | **Superseded 2026-10-28 by O15**: the step, the fields and "Detalhes e notas" left the editor and the portal |
| O15 | The editor has **two steps** (Planejamento, Conteúdo). The "Briefing" step is removed with the objective, the guided fields, "Detalhes e notas", the tags and the production deadline field. They are replaced by the **types** (organization catalog with color or emoji, multi-select with search) and **one publication date** that the channel rows inherit. The list is chronological. The columns stay (expand → migrate code → contract, DATA-12); a later contract migration drops them | Decided 2026-10-28 (the person's request) |
| O16 | The **production deadline** has no field any more, but the calendar marker, `reschedule_production_deadline`, the dashboard reason `production_overdue` and the `content.due_soon`/`content.overdue` reminders still read it. Recommended: remove the whole chain in a later change, because nothing can set a new deadline | Open; recommendation above |
| O17 | Who manages the **type catalog**: `settings.manage` (the Owner), on the screen `/admin/settings/content-types`. Recommended to keep until a role asks to create types while editing; then add `content_types.manage` | Decided 2026-10-28 (reuses the existing action, GOLD-2) |
| O1 | The **objective** is per content, from one closed list | Superseded 2026-10-28 by O15 (replaced by the types) |
| O2 | Each channel having **its own files** (a vertical video for Reels, a square image for the feed) | Not in this delivery; add an optional per-channel list later without touching the shared one |
| O3 | The approval is **per content**; a channel the client does not want is removed by the team in a new version | Decided |
| O4 | A date change after approval creates a new version and a new approval (as before). If it proves heavy, take the planned date **out of the approved snapshot**: the approval would cover text and files and dates become scheduling | Open; revisit after real use |
| O5 | At most 20 channel rows per content | Decided |
| O6 | The planning stage is **optional per organization** (policy `requirePlanApproval`, default on) and frozen into each content at creation (`plan_required`) | Decided 2026-10-20 (go-ahead to develop) |
| O7 | A date change **after the plan is approved**: recommended is to require "Reabrir planejamento" (the plan is what the client agreed). The alternative is to let the team move a planned date during art production without a new approval, taking the date out of the frozen plan | Open; revisit after real use |
| O8 | What the client sees in the plan version: title, planning summary (the objective was removed on 2026-10-28), caption draft, channels with format and planned date, plus the optional planning files (O9); no briefing, no internal notes | Decided 2026-10-20 (go-ahead to develop) |
| O9 | A plan version can carry **planning files** (references, sketches, layout drafts, any file type the library accepts): optional, up to 10, kept in their own ordered list `plan_media` on the content (same shape as `working_media`) and frozen into the plan version on submission. Whether the client may also upload references of their own stays out of scope | Decided 2026-10-20 |

## Implementation status

**Refactor to one content with several channels (Phase R, 2026-10-19).** Done in code: migrations `20261019130000_content_single_aggregate.sql` (guards the data, adds the editorial and caption columns to `content_items`, renames `content_variants` to `content_channels`, moves the `variant_id` columns of versions, requests and comments to `item_id`, redefines the guards, renames the notification kind to `content.publish_due`), `…130010_content_single_aggregate_functions.sql` (`content_item_save` with the channel rows, `content_move`, `content_channel_cancel`, `submit_for_approval`, `reopen_content`, `mark_published`, comments, approver functions, `audit_write` catalog), `…130020_calendar_notes.sql` (notes, `list_calendar_entries` with ideas and dates, `reschedule_channel`) and `…130030_content_single_aggregate_portal.sql` (portal, dashboard and scanner); server functions in `src/lib/marketing/content/*` (`content.functions.ts`, `workflow.functions.ts`, `comments.functions.ts`, `revisions.server.ts`), `src/lib/marketing/calendar/*`, `src/lib/portal/approvals/*`; the editor (`content-editor.tsx` with `ChannelPicker`, `CaptionSection`, `ChannelRowsSection`, `ContentSettingsSection`), the list and board with channel logos, the approval and portal screens with channel tabs (`RevisionView`), the calendar with logos, status marks, "Adicionar" on each day, ideas and dates; `PlatformIcon` moved to `shared/preview`; `variants.functions.ts`, the variant editor, the item page and the new-variant dialog were removed.

**Existing data.** The linked project had one content with one variant and no versions, requests or comments on 2026-10-19; the migration converts it (its caption, files and status move to the content and the variant becomes its first channel row). A backup of those rows was taken before the change. The migration refuses to run when a content has two or more variants or any version, request or comment exists (`content_single_aggregate: unsupported data`).

Validation performed: 741 pgTAP assertions on PGlite (tests 09 to 12 rewritten: 180 for content and approvals, 18 for the dashboard, 79 for the calendar and notes, 15 for the scanners; the rest unchanged), 132 Vitest tests (rich text schema, combined file rules, calendar fixtures), lint, Prettier, build, `check:consistency` for the SQL and TypeScript constants. The migrations were applied to the linked project on 2026-10-19 and the types regenerated from it; the existing content was converted and read back. **Not tested**: any screen in a browser; two simultaneous sessions; upload and signing from the editor against a real bucket; the portal flow with real accounts.

History of the earlier model (kept for context): phase 3 delivered items, variants and revisions on 2026-10-18 with 158 pgTAP assertions; decisions D12 (plain captions), D13 (board moves by menu), D14 (comments are never edited), D15 (internal review always available) are in [../pending-external-setup.md](../pending-external-setup.md); on 2026-10-19 the briefing became rich text (`RichTextEditor`, `RichTextView`, no migration), dates use `DatePickerField` and tags use `TagInputField`.

2026-10-19: The shared list-filter trigger now uses an icon with a tooltip and active-count badge. This applies to the content list. Validation performed: targeted ESLint, Prettier and `git diff --check`. `check:docs` is currently blocked by ten audit-action registry mismatches for `calendar_note.*` and `variant.*` in the audit/functions documents. Full typecheck is blocked by existing `brand-logos.server.ts` type errors. **Not tested**: browser interaction.

2026-10-27: The "Aprovar no lugar do cliente" dialog for the plan stage now shows the publication schedule (`PlanScheduleFields`, one `DateTimeField` per unpublished row, passed to `ReasonDialog` as `children`). If the draft has unsaved changes, they are saved first and the approval uses the new version; a failed save or approval keeps the dialog open with the message. The date button in `DateTimeField` now fills its column, which fixes the gap before "Hora" in "5. Programação das publicações". Validation performed: typecheck, targeted ESLint, Prettier. **Not tested**: browser pass of the dialog, the save-then-approve path against a real database, and the same schedule fields in the "Enviar para aprovação" dialog (it still only lists the check "Ao menos um canal tem data e horário").

2026-10-19: Grouped publication rows by channel with the add-occurrence action in each channel header. Format options now carry format-specific icons; `DateTimeField` uses a localized calendar popover and a custom HH:mm time input, with the time zone exposed through an icon tooltip. Validation performed: targeted ESLint, typecheck, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser interaction or daylight-saving edge cases in the new input.

2026-10-19: The existing editor supports an embedded full-screen modal mode for scheduling content from a calendar day. Successful creation refreshes calendar entries and closes the modal without navigating to the content detail route. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser interaction or responsive modal layout.

2026-10-19: Content editor loading now uses section-level skeletons for the channel, copy, media, schedule, settings, preview and (for existing content) version and comment areas. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering during slow requests.

2026-10-19: Content editor actions now use compact buttons; reopen and cancel use icon buttons with tooltips, and internal review and approval use distinct message and send icons. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or tooltip interaction.

2026-10-19: Content media loading now joins `media_versions` to `media_assets` through the explicit asset foreign key and propagates query failures instead of labeling unreadable results as removed. This restores the correct availability state for attached files used by approval checks. Files: `src/lib/marketing/content/revisions.server.ts`, `src/lib/marketing/content/content.functions.ts` and `src/lib/marketing/approvals/approvals.functions.ts`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or approval submission with the affected content.

2026-10-19: Content media now use `@dnd-kit/react` for animated drag-and-drop reordering, with a keyboard-operable drag handle and the existing persisted list order. Files: `src/components/marketing/content/file-strip.tsx`, `package.json` and `package-lock.json`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs`, production dependency audit and `git diff --check`. **Not tested**: browser pointer, touch and keyboard interactions.

2026-10-19: The content editor's channel preview now uses the registered brand logo as its avatar, with the existing profile initial as fallback. Files: `src/components/marketing/content/content-editor.tsx` and `src/components/shared/preview/channel-preview.tsx`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering or fallback behavior.

2026-10-20: Shared content previews now use a platform-and-format-specific media frame, handle failed image/video loads with a clear fallback, and provide keyboard-accessible carousel indicators. The preview uses the media URL supplied by its caller without applying a lower-resolution transform. Files: `src/lib/shared/preview/platforms.ts`, `src/lib/shared/preview/platforms.test.ts`, `src/components/shared/preview/channel-preview.tsx`. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: Vitest could not start because esbuild returned `spawn EPERM`; visual comparison with each live platform app or browser behavior for every media kind.

2026-10-20 (two-stage approval, tasks T-01 to T-07): migrations `20261020100000_two_stage_approval_expand.sql` (stage columns, `plan_required`, `plan_summary`, `plan_media`, `plan_approved_revision_id`, the four statuses and their transitions, `brand_approver_ids`, `plan_approval_required`, `content_plan_signature`), `…100010_two_stage_approval_functions.sql` (`content_item_save` with the locks, `content_move`, `submit_for_approval` without an approver and per stage, `reopen_content` with a scope, `cancel_request`, `send_approval_reminder`, `reschedule_channel`, and the portal functions for the approver pool) and `…100020_two_stage_approval_contract.sql` (drops `reassign_approver` and `approver_user_id`). Server: `content.functions.ts`, `workflow.functions.ts`, `revisions.server.ts`, `schemas.ts`, `stage-state.ts`. Screens: the stepper (`stage-stepper.tsx`), the planning section (`plan-section.tsx`), the action bar (`content-actions.tsx`), the stage-aware send dialog, the board with the new columns. Validation performed: 59 new SQL assertions in `19_two_stage_approval.test.sql` (808 in total, 0 failures; plan then art, art before the plan refused, locks, reopen scope, two approvers with the first decision winning, a member without `can_decide`, brand A versus brand B, nobody able to approve, anon), tests 09 to 12 adapted (policy off keeps the old cycle), Vitest for `stageStateOf` and the transition map against the SQL, typecheck, lint. **Not applied to the linked project** (the three migrations are waiting for the go-ahead) and the types are from the offline generator; **not seen in a browser**; **not tested**: the new board with ten columns, the planning files in the portal on a real bucket, the policy switch on the policies screen.

2026-10-20: Removed the stage stepper from the content editor (`stage-stepper.tsx` deleted; `StageState` lost `plan`/`art`; `stageStateOf` no longer takes the status) and the "Adicione ao menos N arquivo(s)" hint now shows only after at least one file is attached (the server still refuses on submit). Validation performed: typecheck, ESLint, Vitest for `stageStateOf`. **Not seen in a browser.**

2026-10-20: art files can be attached before the plan is approved (decision above). Migration `20261020120000_content_art_files_before_plan.sql` redefines `content_item_save` without the `plan_not_approved` check on files; the "4. Artes e mídias" section is no longer locked (`artLocked` removed from `StageState`). In the portal, a plan request card shows a channel/format/date list instead of the post preview (`plan-request-summary.tsx`). The "Não foi possível salvar" conflict after sending for approval came from the dialog form event bubbling (React portal) to the editor form, which saved with the stale version; the editor now ignores submit events that are not its own. Validation performed: see the run below. **Not seen in a browser.**

2026-10-20: the portal plan card now shows the objective and the planning summary (not the briefing, decision O8 stays). Migration `20261020130000_portal_request_plan_summary.sql` adds `objective_kind` and `plan_summary` to `portal_request_row`; `PortalRequest` and `portalRequestRowSchema` follow. **Not seen in a browser**; no pgTAP assertion was added for the two new keys.

2026-10-20: migrations `20261020120000_content_art_files_before_plan.sql` and `20261020130000_portal_request_plan_summary.sql` applied to the linked project with `npx supabase db push` (the dry run listed only these two). No table or function signature changed, so the types were not regenerated. **Not tested** against the remote project: saving art files before the plan is approved and the portal plan card.

2026-10-20: the portal request preview (`request-preview.tsx`) now shows one channel at a time with a tab per channel ("Instagram · Story"); with a single channel there are no tabs. Validation performed: typecheck, ESLint. **Not seen in a browser.**

2026-10-20: the `ContentFormat.Image` label is now "Post" (was "Imagem"; `MediaKind` keeps "Imagem"), and the portal plan card shows an icon per format (`format-icons.ts` moved to `shared/content`, reused by the channel rows). Validation performed: typecheck, ESLint, Vitest. **Not seen in a browser.**

2026-10-20: portal panel ("Painel", `portal-brand-page.tsx`) lays the request cards out as a bento/masonry grid: `useBentoLayout` (`src/hooks/portal/use-bento-layout.ts`) measures the container, picks 1 to 3 columns (min 340 px) and `packBento` (`src/lib/portal/approvals/bento.ts`) puts each card in the shortest column using an estimated height from the preview aspect ratio (`previewAspectRatio`) or, for plan cards, from the summary and the channel rows. Previews keep their proportions (never cropped). Only the panel uses it so far. Validation performed: typecheck, ESLint, Vitest (`bento.test.ts`). **Not seen in a browser**; the heights are estimates, so columns may differ by a few dozen pixels.

2026-10-20: the portal approvals screen (`portal-approvals-page.tsx`) uses the same bento grid as the panel; the page of results is packed into columns, pagination and filters are unchanged. Validation performed: typecheck, ESLint, Vitest (`platforms.test.ts`, `bento.test.ts`). **Not seen in a browser.**

2026-10-20: the **`published`** editorial state (decisions P1 to P4 of [content-publication.md](content-publication.md)). Migration `20261020140000_content_published.sql`: the `CHECK`, `editorial_transition_allowed` (`approved → published`), `publish_content`, `media_purge_pending` and `media_purge_confirm`, the columns `purge_requested_at`, `purge_keep_preview` and `original_purged_at` on `media_versions`, `content_item_save`, `content_item_is_ready`, `dashboard_attention`, `media_storage_used` and `media_storage_keys` adjusted, `content.published` in `audit_write`. Code: `publishContent` (`workflow.functions.ts`), `purgePublishedMedia` (`cleanup.server.ts`, run right after publishing and again by the daily `/api/cron/media-cleanup`), the button and the confirmation in the editor, the "Publicado" status, board column and banner. Validation performed: `npm run db:verify` (917 assertions, 0 failures, 17 new in `21_content_published.test.sql`), typecheck, ESLint, Vitest, `check:consistency`, `check:docs`. Applied to the linked project on 2026-10-20 (`db push`, then `db:types -- --linked`). **Not done:** the reduced video copy (videos keep their original for now), the width and height on the internal DTOs, the removal from a real bucket (`purgePublishedMedia` was not exercised), the `file_purged` guard on signed URLs, the screens in a browser.

2026-10-20: fallback for purged originals. Migration `20261020150000_purged_originals_fallback.sql` (applied): `portal_media_urls` returns a null `storage_key` once the original is purged and `publish_content` queues a kept version only when it has a display copy. Code: `getMedia`/`signMedia`/`signPortalMedia` ignore a purged original, `PreviewMedia.unavailable` (`media-urls.ts`) shows "Prévia indisponível" instead of an endless skeleton in the portal preview, the revision view, the portal calendar entry and the editor. Validation performed: `db:verify` (919 assertions, 0 failures; 2 new for the portal keys), typecheck, ESLint. **Not tested** in a browser nor against a real bucket.

2026-10-20: the board view no longer produces a second, page-level horizontal scrollbar: `SidebarInset` got `min-w-0` (`src/components/shared/ui/sidebar.tsx`), so only the board scrolls horizontally. Global scrollbar styling is in `src/styles.css` (see [design-system.md](../standards/design-system.md)). Validation performed: ESLint, typecheck, Prettier. **Not tested**: browser, Firefox, touch devices.

2026-10-22: **flexible approval specified (documents only).** The manager can record the approval of the plan or of the art on the client's behalf (`approvals.override`, `approve_on_behalf`), reusing `plan_approved` and `approved`; section "Flexible approval" above, rules in [approvals.md](approvals.md). Files: this document, `approvals.md`, `../foundations/roles-and-actions.md`. Validation performed: `npm run check:docs`. **Nothing implemented**: no migration, function, action seed, `Action`/`AuditAction` constant, notification kind, screen or test exists yet; the new names are not in the registries on purpose (they enter with the implementation). Open: O10 and O11.

2026-10-22: Content editor reorganized into a compact connected three-step navigation: planning, briefing and content. Planning groups channel and objective details and internal work settings; briefing is isolated; content groups copy, media and publication rows. Files: `src/components/marketing/content/content-editor.tsx`, `src/components/marketing/content/content-settings-section.tsx`. Validation performed: Prettier and TypeScript. **Not tested** in a browser.

2026-10-22: the content editor was split into steps. New generic `StepNav` (`src/components/shared/admin/step-nav.tsx`), `EditorStep`/`editorSteps` (`src/lib/marketing/content/editor-steps.ts`) and one component per step (`planning-step.tsx`, `briefing-step.tsx`, `content-step.tsx`) plus `editor-preview.tsx`; `content-editor.tsx` keeps state, save and dialogs (about 500 lines, was 640). No behavior change; the `??` characters that corrupted "Conteúdo", "Organização" and the nav label were fixed. Validation performed: targeted ESLint, Prettier. `npm run typecheck` fails only in `src/components/marketing/calendar/calendar-page.tsx` (duplicate `StoredKey`/`writeStored` imports, not touched here). **Not run:** Vitest, `check:docs`, the screens in a browser.

2026-10-22: the browser tab title of the "new" routes was "New | Aura Creative" (fallback of `pageTitle` in `src/routes/__root.tsx` capitalized the segment). It now reads "Novo conteúdo", "Nova marca" and "Novo cliente" (resolved from the parent segment). Validation performed: ESLint, Prettier, typecheck. **Not seen in a browser.**

2026-10-22: in the content editor the actions (including "Criar conteúdo"/"Salvar") now sit at the right of the header, on the same line as the title and description, in both the page and the calendar modal. A new content starts with the last brand chosen (`StoredKey.CalendarBrand`, the same key as the calendar), on the page and in the modal; choosing a brand in the editor writes the key. The key is read after mount (the editor shows its skeleton for one frame) so the server and client renders match. Files: `content-editor.tsx`, `content-editor-page.tsx`, `planning-step.tsx`. Validation performed: ESLint, Prettier, typecheck. **Not seen in a browser**; a remembered brand the person can no longer access is not filtered out (the calendar behaves the same way).

2026-10-22: the editor steps got an icon each (`editorSteps`), animated navigation (`StepNav`, active pill, filled connector, check on completed steps), an animated change of step with "back" and "next" buttons (new `StepPanel`, `src/components/shared/admin/step-panel.tsx`) and a layout that uses the width: the side column (preview, history, comments) exists only when it has content (existing content, or the "Conteúdo" step), so "Planejamento" and "Briefing" of a new content fill the whole width, and the planning cards sit in two columns from `xl`. New dependency `motion` ^14.6.0 (MIT, maintained; chosen because the project had only CSS classes from `tw-animate-css`, which cannot animate the exit of a step or the shared active pill); `npm install` also updated `package-lock.json`. Validation performed: ESLint, Prettier, typecheck, `check:docs`. **Not seen in a browser**, not tested: the animation at 360 px, with `prefers-reduced-motion`, and with a field error on a step that is not the visible one (the first invalid field is not focused if its step is hidden).

2026-10-22: the first step of the editor is reorganized: a card "Identificação" with the brand (new content only) and the title (new `content-title-field.tsx`) comes first, then channels and organization on the left and the planning card on the right (from `xl`). The title left `ContentSettingsSection`, and the second copy of the settings ("6. Configurações" in the "Conteúdo" step, a duplicate of "Organização") was removed. Validation performed: ESLint, Prettier, typecheck. **Not seen in a browser.** The planning summary is still plain text (see the open point on rich text in the conversation: it changes `plan_summary`, so it needs a decision first).

2026-10-23: When creating a new content, the only available assignee for its brand is selected automatically after assignee options load. Existing content and a deliberate user choice are preserved. Files: `src/hooks/marketing/use-auto-select-assignee.ts`, `src/components/marketing/content/content-editor.tsx`. Validation performed: targeted ESLint, TypeScript and Prettier. **Not tested**: browser interaction.

2026-10-23: The objective select now displays a matching icon with each option and the selected label; stored objective values are unchanged. File: `src/components/marketing/content/content-settings-section.tsx`. Validation performed: targeted ESLint, TypeScript and Prettier. **Not tested** in a browser.

2026-10-23: Removed the tags and internal notes controls from the content editor. Their existing values remain in the draft and save payload, so editing other fields does not clear them. Files: `src/components/marketing/content/content-settings-section.tsx`. Validation performed: targeted ESLint, Prettier and `git diff --check`. **TypeScript not passed** because of an unrelated unused `label` in `src/components/marketing/content/row-format-field.tsx`. **Not tested** in a browser.

2026-10-23: migration `20261023100000_plan_summary_rich_text.sql` applied to the linked project (`db push`, then `db:types -- --linked`; the types file did not change). Editor polish: `StepNav` shows a pointer cursor and a hover effect; the editor is capped at `max-w-7xl` and centered; channels are shown as round brand-colored marks (`PlatformMark`, new `platform-*` tokens in [color-palette.md](../standards/color-palette.md)) with a tooltip, also in `ChannelLogos`; the format of each channel is now chosen in the "Planejamento" step (`planning-formats.tsx`, shared `RowFormatField`), because format is locked together with the plan; `DatePickerField` now has the same height, radius and border as the other inputs. Validation performed: ESLint, typecheck, `check:consistency`, Prettier. **Not seen in a browser.** Channel gap analysis (not implemented, needs a decision): the `Platform` list has no Google Business Profile, WhatsApp, Telegram, Bluesky or Snapchat.

2026-10-23: Removed the planning summary helper sentence from the form body and moved its guidance into the existing section info tooltip. File: `src/components/marketing/content/planning-step.tsx`, `src/components/marketing/content/plan-section.tsx`. Validation performed: targeted ESLint, Prettier and `git diff --check`. **Not tested** in a browser.

2026-10-23: Formats are now selected as multiple icon-and-label toggles per channel in the planning step. Each selected format creates its own publication row, reusing the planned time from that channel?s first row; the publication step shows the format read-only, and existing per-row preview tabs display each selected format. Removed the obsolete single-format selector. Files: `src/components/marketing/content/planning-formats.tsx`, `src/components/marketing/content/channel-rows-section.tsx`, deleted `src/components/marketing/content/row-format-field.tsx`. Validation performed: targeted ESLint, TypeScript, Prettier and `git diff --check`. **Not tested** in a browser.

2026-10-23: Added an analysis and recommendation for improving the briefing step to the existing content module document. Documentation only; no interface or data contract changed. Validation performed: Prettier, `check:docs` and `git diff --check`.


2026-10-23: **flexible approval implemented** (the manager approves the plan or the art on the client's behalf). O10 and O11 were decided with the recommendations (art refused without an approved plan; reason optional). Migration `20261023110000_approvals_approve_on_behalf.sql`: `approval_decisions.on_behalf` and `reason`, the action `approvals.override` (starting role `manager`), the notification kind `approval.approved_by_team`, the audit action of the same name, `editorial_transition_allowed` widened (a status can now reach `plan_approved`/`approved` from the statuses before it; `content_move` still refuses both), the internal helper `content_freeze_revision` (extracted from `submit_for_approval`, which now calls it, so sending and approving freeze a version the same way), `approve_on_behalf`, and `portal_request_row`/`portal_get_approval` returning `decided_on_behalf` and hiding the manager's name. Code: `approveOnBehalf` (`workflow.functions.ts`), `approveStageOf` and the new transitions (`editorial.ts`), the action "Aprovar planejamento pelo cliente"/"Aprovar arte pelo cliente" and its dialog (`content-actions.tsx`, `content-editor.tsx`, `ReasonDialog` got `optional`), the team approval detail and list ("Aprovado pela equipe", the reason), and the portal decision card and request card. Validation performed: `npm run db:verify` (950 assertions, 0 failures; 31 new in `22_approve_on_behalf.test.sql`), Vitest (153), typecheck, ESLint, Prettier, `check:consistency`, `check:docs`; Applied to the linked project on 2026-10-23 (`db push`, then `db:types -- --linked`; typecheck passes with the real types). **Not done:** the board's "Mover para…" opening the dialog, the "Aprovado pela equipe" marker and filter on the list and board badges, the same text in the revision history of the editor. **Not tested:** the screens in a browser, two simultaneous decisions from real sessions, the notification email.

2026-10-23: editor polish and guided briefing (decision O14). **Formats** are chosen with round brand-colored toggles with an SVG per format (post, carousel, video, story, reel; `formatIcons` in `src/components/shared/content/format-icons.tsx`, now also used by the publication rows and the portal plan summary), the same pattern as the channel picker, and the channel mark was removed from the format header (it repeated the channel). **Briefing**: migration `20261023120000_content_briefing_fields.sql` adds `briefing_audience`, `briefing_key_message`, `briefing_creative_direction` and `briefing_constraints` to `content_items` and replaces `content_item_save` (same name, same errors) to read them; `briefingFields` goes through `saveContentSchema`, `saveContentItem`, `getContentItem`, `ContentDetail` and the draft (`src/lib/marketing/content/briefing-fields.ts` holds the labels and placeholders); the free rich text is now "Detalhes e notas". **Files list**: "Adicionar da biblioteca" sits on the same row as the label, the counter ("2/10 arquivos") sits below the list like the character counter, and the planning list is called "Referências" (new `label` prop of `FileStrip`; the art list of "Conteúdo" keeps "Arquivos"); "Resumo do planejamento" became "Ideia inicial". **Placeholders** on the title, objective detail, ideia inicial, briefing fields, caption (all and per channel) and call to action (`placeholder` added to `TextAreaField` and `RichTextEditor`; the editor shows an overlay while empty, no new dependency). The mojibake in the format limit message was fixed. Validation performed: `npm run lint`, `typecheck`, `format:check`, `check:consistency`, `check:docs`, `vitest` (153 tests), `npm run db:verify` (954 assertions, 0 failures, including 4 new in `09_content.test.sql`). **Not done**: `db push` to the linked project and `db:types` against it (the four columns were added to `database.types.ts` by hand in the generator's format because the offline generator rewrites the whole file; regenerate once the migration is applied); `supabase test db` (Docker); the screens in a browser (360 px, keyboard, `prefers-reduced-motion`, the empty-state overlay of the rich text, a field error on the briefing fields). Existing contents keep their rich-text briefing as "Detalhes e notas" with the guided fields empty. A briefing converted from a calendar note still fills "Detalhes e notas".

2026-10-23: **duplicate content**, field rename and layout fix. Server function `duplicateContentItem` (`content.functions.ts`, reuses `content_item_save`, no new SQL) with the list action and the editor button (`content-page.tsx`, `content-actions.tsx`, `content-editor.tsx`); the title field is now "Nome do conteúdo"; the publication row (`channel-rows-section.tsx`) got a "Formato" label so the format box lines up with the date field. Migration `20261023120000_content_briefing_fields.sql` was applied to the linked project (`db push`) and `db:types -- --linked` produced the same four columns I had added by hand. Validation performed: lint, typecheck. **Not tested**: duplicating in a browser (including a source with a trashed file, which `content_item_save` refuses with `media_not_available`), the row layout at 360 px, no pgTAP for the duplicate (it only calls `content_item_save`).

2026-10-24: **profile photos** (new `profile` media scope, [media-library.md](../spaces/media-library.md)). Migration `20261024100000_profile_avatars.sql`: `media_assets.owner_id`, scope `profile`, `profiles.avatar_media_version_id`, usage type `profile_avatar`, functions `profile_set_avatar` and `person_avatar_keys`, and `media_request_upload`/`media_confirm_upload`/`media_assert_asset_access`/`can_view_media_asset` updated (profile uploads need no `media.upload` and skip the quota check, which external users cannot call). Server: `setAvatar`, `getAvatarUrls` (`profile.functions.ts`), upload functions gate the profile scope with the approved-profile guard. UI: `PersonAvatar`, `useAvatarUrls`, `ProfileAvatarField` (upload, replace, remove on `/admin/profile` and `/portal/profile`), avatars in the owner select, the owner filters, the content list, the sidebars and the users list; the library lists the photos under "Fotos de perfil". Also: leaner editor skeleton; automatic selections (brand, only channel, only owner) no longer count as unsaved changes (`setAutomatic` in `use-content-draft.ts`); objective and production deadline moved to the briefing, owner to "Identificação", "Detalhe do objetivo" removed from the screen, brand after the name, Instagram no longer offers `video`, placeholders shortened. Validation performed: lint, typecheck, `db:verify` (new `23_profile_avatars.test.sql`, 21 assertions). **Not tested**: the screens in a browser, a real upload to R2, signed avatar URLs, comment authors and portal decisions still show names only (no avatar), library cards of profile photos still show actions that the server refuses (`not_found`), an existing Instagram row with format `video` cannot be unselected from the new selector.

2026-10-24: migration `20261024100000_profile_avatars.sql` applied to the linked project (`db push`) and `db:types -- --linked` regenerated the types (it also added the foreign-key relationships that were missing from the hand-added lines). The pgTAP run is `db:verify` only; `supabase test db` (Docker) was not run.

2026-10-24: **files component reworked** (`file-strip.tsx`, `file-dropzone.tsx`, used by "Referências" and "Artes e mídias"): one surface instead of a list plus a separate drop box; Drive-style grid of cards with a menu (move before/after, remove); no alternative-text input; drag-and-drop upload works over the whole area even when files exist (overlay "Solte para enviar"). `FileDropzone` now wraps the content and receives the grid as a render function. Validation performed: lint, typecheck. **Not tested**: in a browser (dragging files from the desktop over the grid, reordering by drag in a grid with `@dnd-kit`, the card menu with the keyboard, 360 px). Alternative text of images already attached stays in the data but cannot be edited; the rule that publishing images need alternative text is not enforced by this editor.

2026-10-24: the editor preview (`editor-preview.tsx`) no longer shows the planning references, in any stage: it shows only the art files ("Artes e mídias"). The references stay in the plan version the client approves (decision O9 unchanged). Select options with an avatar use the 32 px avatar (`PersonAvatar` size `md`). Files: `editor-preview.tsx`, `content-editor.tsx`, `content-assignee-field.tsx`, `content-page.tsx`, `calendar-page.tsx`. No migration. Validation performed: lint, typecheck, `check:docs`. **Not tested**: the select rows with a long name at 360 px, and a browser run of the preview.

2026-10-24: publication schedule copy. Card "5. Programação das publicações" (was "Data e horário das publicações"); button "Adicionar publicação" (was "Incluir mais dias e horários neste canal"); `DateTimeField` now labels the two inputs separately (the given label over the date, "Hora" with the time-zone tip over the time) with placeholders "Selecionar data" and "Selecionar hora" (the time box is wider, `w-40`); `DatePickerField` also says "Selecionar data"; callers renamed to "Data", "Nova data" and "Data da publicação". Glossary updated. Files: `date-time-field.tsx`, `date-picker-field.tsx`, `channel-rows-section.tsx`, `content-step.tsx`, `reschedule-dialog.tsx`, `publish-dialog.tsx`. Validation performed: lint, typecheck, Vitest (153). **Not seen in a browser** (the calendar event dialog, which uses "Início"/"Fim" with the new "Hora" label, at 360 px).

2026-10-24: audit of the files component (`file-strip.tsx`, `file-dropzone.tsx`) after a reordering bug reported in the grid (spacing wrong on the vertical axis). Cause suspected from the code, not reproduced: the grid cell was a `motion.li` with `layout="position"` (Motion animated the cell on every reorder while `@dnd-kit` also moved it) and the sortable element was the inner card, not the grid cell. Fix: the `li` is now the sortable element (`ref`), the enter/exit animation lives on an inner `motion.div`, and there is no layout animation on the cell. Other points checked and left as they are: native file drops are told apart from internal drags by `dataTransfer.types` including `Files`; the card menu offers keyboard reordering ("Mover para antes"/"Mover para depois"); `disabled` disables dragging and the menu; the add tile only shows while there is room and upload is allowed. Validation performed: lint, typecheck. **Not tested** in a browser: reordering in 2, 3 and 4 columns, dragging the last card, and dropping a file while a card is being dragged.

2026-10-24: the editor page header now shows the brand avatar (logo, or initials as fallback) before the content name, for new and existing content once a brand is known (`BrandAvatar` through the `leading` slot of `PageHeader`, in `content-editor.tsx`). Validation performed: lint, typecheck. **Not seen in a browser**; the header inside the calendar modal does not show it.

2026-10-24: **activity section and header actions.** `Atividade` card at the bottom of the editor (`activity-section.tsx`): tabs "Comentários" and "Histórico" with a sort toggle, a collapsed comment box with the person's avatar (`comment-composer.tsx`), comments with avatar, name, time and "Excluir" (`comments-panel.tsx`), and a history feed built from the approval requests (`revision-history.tsx`; `RequestRow` got `requestedById` and `decidedById`, no SQL change). Header actions reduced to the main ones plus the "⋯" menu (`content-actions.tsx`). List: shorter row-menu labels and `max-w-7xl`. The editor preview already shows only the art files ("Artes e mídias"); the planning references only appear in the version the client approves. Validation performed: lint, typecheck. **Not tested**: in a browser (the tabs, the collapsed box, the menu with the keyboard, the feed with several versions), the M shortcut is not implemented, and whether approving a plan with no request sent works end to end (the SQL function supports it; only the UI path was reviewed). Files: `activity-section.tsx`, `activity-entry.tsx`, `comment-composer.tsx`, `comments-panel.tsx`, `revision-history.tsx`, `content-actions.tsx`, `content-editor.tsx`, `content-page.tsx`, `use-content-comments.ts`, `types.ts` and `content.functions.ts` (request ids). No migration.

2026-10-24: **comments with replies and editing** (decision D14 changed, see "Comments"). Migration `20261024120000_comment_threads_and_edit.sql`, **applied to the linked project** together with `20261024110000_dashboard_publication_pending.sql`; `db:types -- --linked` regenerated the types. It adds `comments.parent_id` and `edited_at`, relaxes `comments_guard` (body and `edited_at` may change while the comment exists; everything else stays immutable), replaces `comment_add` (new `p_parent`; a reply inherits the visibility of its parent and attaches to the thread root), adds `comment_edit`, replaces `comment_list` (carries `parent_id`, `edited_at`, `deleted`; a deleted comment with live replies stays as a placeholder) and adds `comment.edited` to the `audit_write` catalog (`AuditAction.Comment.Edited`, label, `audit.md`). Server: `editComment`, `parentId` in `addComment`. UI: `comment-entry.tsx` (the "⋯" menu with "Editar"/"Excluir" for the author, inline edit, "editado", "Responder"), `comment-composer.tsx` (also used for replies; "Cancelar" with an icon before the primary button, as in `FormActions`), threads in `comments-panel.tsx` (newest first, replies oldest first, indented with a guide line), the section icon `Activity`, a count badge on the tab, no sort toggle, Motion transitions (composer, replies, entering and leaving comments, tab change). Validation performed: `db:verify` (996 assertions, 0 failures; new `25_comment_threads.test.sql` with 14; two old assertions in `09_content.test.sql` adjusted: the body is no longer immutable, the date still is), lint, typecheck, `check:consistency`. **Not tested**: in a browser (animations with several comments, reduced motion, the menu and inline edit with the keyboard, replying while another reply box is open), `supabase test db` (Docker). **Known limits**: the client portal still lists external comments flat, so replies appear as separate comments there; only the thread root can be answered; there is no edit history.

2026-10-26: **automatic publication per channel row** ([instagram-publishing.md](instagram-publishing.md)). Section "6. Publicação automática" of the content editor lists the Instagram rows of a content: a switch "Publicar automaticamente" (only when the channel is connected), the state ("Sai sozinho em…", "Publicando agora", "Falhou", "Publicado automaticamente" with the link), and "Tentar de novo" / "Publicar agora". The row keeps `planned` while waiting, so the manual flow, the dashboard and the reminders still work; a failed row appears first in "Marcar como publicado". `publication_status = published_manually` now means "recorded as published" (label "Publicada"); `published_via` tells whether it was automatic. Files: `src/components/marketing/content/publish-automation-section.tsx`, `content-step.tsx`, `content-editor.tsx`, `src/lib/marketing/content/publishing.functions.ts`. Migration `20261026100100_instagram_publishing.sql`. Validation performed: pgTAP `27_instagram_publishing` (28 assertions), typecheck, lint, build. **Not tested**: the section in a browser; any real publication.

2026-10-28: **two-step editor, types and publication date** (decision O15). Migration `20261028100000_content_types_publish_date.sql` (not applied to the linked project): `content_items.publish_date` (filled for existing contents from the earliest planned day of their rows), tables `content_types` and `content_item_types`, functions `content_type_save` and `content_type_set_archived` (`settings.manage`), `content_item_save` rewritten (reads `type_ids` and `publish_date`, locks `publish_date` with the plan, no longer writes objective, briefing, tags; still writes `production_due_date` only when the key is sent) and `audit_write` with `content_type.saved` and `content_type.archived`. Server: `src/lib/shared/content-types/*`, `content.functions.ts` (list sorted by `publish_date`, type filter, types in list and detail, duplicate copies the active types), `schemas.ts`, `types.ts`, `publish-date.ts` (rows follow the publication date), `draft-payload.ts`. Screens: the editor lost the "Briefing" step (`briefing-step.tsx`, `content-settings-section.tsx`, `briefing-fields.ts` deleted); the planning step has the large "Briefing" card on the left (types, "Data de publicação", taller "Ideia inicial", "Referências") and "Identificação" plus the channels on the right (`plan-section.tsx`, `planning-step.tsx`, new `MultiSelectField`, `ContentTypeChip`); a failed save moves to the first step with an error and focuses it (`useFormSubmit` got `onInvalid`, `StepNav` got `invalid`); the list has "Data" first, "Tipos", "Formato", sorted by date ascending by default (`useListState` got a default sort) and a "Tipo" filter; the portal no longer shows the objective (`dto.ts`, `types.ts`, `plan-request-summary.tsx`, `portal-approval-page.tsx`); new settings screen `/admin/settings/content-types`. Not removed yet (contract migration, DATA-12): the columns `objective`, `objective_kind`, `briefing*`, `tags` and the `objective_kind` key that the portal SQL functions still emit. Validation performed: `npm run lint`, `typecheck`, `check:consistency`, `check:docs`, Vitest (241 tests, 6 new for the publication date and the step redirect), `npm run db:verify` (1119 assertions, new `29_content_types.test.sql` with 19; `09_content.test.sql` lost the tag, objective and briefing assertions). **Not tested**: the screens in a browser (the multi-select, the two-column layout at 360 px, the focus after the step change, the type chips and the list at narrow widths), `supabase test db`, the migration on the linked project and `db:types` against it (the types were edited by hand), contents with an archived type in the editor, the calendar "Converter em conteúdo" flow with the new seed, and the production deadline chain (O16) with no way to set a new deadline.

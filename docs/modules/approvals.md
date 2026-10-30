# Module — Approvals

> Functional specification. Context and conventions in [README.md](README.md). Spaces: `marketing` (requesting and following up, `/admin/marketing/approvals`) and `portal` (deciding, see [portal.md](portal.md)). Transactional rules in `technical-architecture-v0.1.md`, section 10.

## Goal and scope

Let the team send a content to the client and obtain a **traceable decision about exactly what was sent**. Approval is by **revision** (immutable), by **one designated approver per request**, and never implicit: delay or silence is not approval.

Included: requests, decisions (approve / request changes), supersession, deadlines, overdue handling, history, reopening. Not included in the MVP: multiple approvers or approval chains, anonymous approval links, automatic reminders by email beyond the notification kinds.

## Concepts

| Concept | Meaning |
|---|---|
| Approval request (`approval_requests`) | A request for a decision about **one revision** of a content, addressed to a designated approver |
| Decision (`approval_decisions`) | The result: `approved` or `changes_requested`, with the revision, the approver, the date and (when requesting changes) a mandatory comment |
| Designated approver | An external member of the brand with `can_decide` chosen when submitting |
| Status of a request | `pending`, `approved`, `changes_requested`, `superseded`, `cancelled` |

At most **one pending request per content** (partial unique index). A decision is recorded **once** per request (unique index).

## Rules

> Replaced on 2026-10-20: rules 1 and 5 and the "designated approver" wording below are superseded by the [approver pool](#approver-pool-decided-2026-10-20), and every request has a **stage** (planning or art, see [content.md](content.md#two-stage-approval-decided-2026-10-20)).

1. In the MVP there is **one designated approver per request**. Other external members may comment (if they have `comments.create_external`) but do not decide that request.
2. The decision identifies the revision, approver, date and outcome; **requesting changes requires a comment**.
3. Changing text, files, order, channel or date requires a **new revision and a new approval**.
4. A **superseded** revision accepts no new decisions. Concurrent submissions and decisions are serialized by locking the content (`for update`) so an outdated version is never approved.
5. Revoking the approver's access (or `can_decide`) blocks new decisions; the pending request keeps its history and the team must designate another approver (`approver_without_access`).
6. **Delay or silence never equals approval.** An approval arriving after the planned date raises a warning on the content and requires rescheduling; it does not trigger publishing.
7. Manual publication can only be recorded for the **currently approved** revision ([content.md](content.md)).
8. Cancelling and reopening are audited. An approved revision is never edited directly.
9. An approval decision cannot be changed; to change the outcome the team reopens the content and a new revision/request is created.

## Flows

### Request (team, `marketing`)

1. In the content editor choose "Enviar para aprovação".
2. Choose the designated approver (list of active external members with `can_decide`; if none, the dialog offers "Convidar aprovador", which opens the invitation flow), an approval deadline (default: the organization's default days) and an optional message.
3. The server runs `submit_for_approval(item, approver, due_date, message, expected_version)` (see [content.md](content.md)).
4. The approver receives an in-app notification (and an email if enabled) `approval.requested`.

### Decision (client, `portal`)

1. The approver opens the request (from the notification, email or `/portal`).
2. They see **exactly the revision sent**: per-channel preview, caption, files, planned date with time zone, history and external comments.
3. They choose **"Aprovar"** or **"Pedir alterações"** (comment required, minimum 5 characters).
4. `portal_decide_approval(request, outcome, comment)` runs in one transaction: validates `approvals.decide`, being the designated approver, active external membership with `can_decide`, pending status, and that the revision is still the content's current one; records the decision; updates the request and the content (`approved` or `changes_requested`, `approved_revision_id`); writes an audit event; notifies the team (`approval.decided`).
5. If the revision was superseded in the meantime the screen shows "Esta versão foi atualizada" with a link to the new request, and the decision is refused (`revision_superseded`).

### After the decision

- `approved`: the content is ready for planning/publishing; the team may record the manual publication.
- `changes_requested`: the team edits, then sends a **new revision**; the previous request stays in the history as `changes_requested`.
- A new submission while a request is pending supersedes it: the old request becomes `superseded` and its approver is notified.

### Reopening and cancellation

- **Reopen** (`content.reopen`, reason mandatory): supersedes any pending request and returns the content to `in_production`; an approved revision stays in the history and `approved_revision_id` is cleared.
- **Cancel** (`content.cancel`): pending requests become `cancelled`.

## Approver pool (decided 2026-10-20)

> Status: **implemented in code and on PGlite (2026-10-20)**, not applied to the linked project. It replaces the designated approver: rules 1 and 5 of the "Rules" section and the wording "designated approver" in the flows above are superseded by it (DOC-5: fold it in once the migrations are applied and used).

### Why

Today the sender picks **one designated approver** and only that person can decide. A brand can have several people who may approve (a founder and a marketing manager, for example) and the one picked may be away. The right to decide should come from the **permission**, not from a name chosen per request.

### Target rules

1. **Anyone who can approve may decide.** Eligibility is the existing rule, checked in the database at the moment of the decision: an approved external account whose role has `approvals.decide` **and** an active brand link with `can_decide` for the request's brand ([../foundations/roles-and-actions.md](../foundations/roles-and-actions.md)). No new action and no new flag.
2. **No approver is chosen when sending.** The send dialog lists who will be asked (read-only) and refuses to send when nobody is eligible (`approver_required`, with the "Convidar aprovador" shortcut of today).
3. **One decision per request; the first one wins** (the `approval_decision_once` index and the row lock already guarantee it). The second person who tries receives `request_not_pending` and the screen shows the decision made and by whom ("Aprovado por Marta em 20/10"). The decision keeps recording the person who decided (`approval_decisions.decided_by`).
4. **Every eligible approver is notified** of `approval.requested`, respecting their notification preferences, and every one of them sees the request under "Aguardando você" until it is decided; when someone decides, the others' notifications are resolved (`resolve_notifications`).
5. Members who are **not** eligible (commenters, members without `can_decide`) still see the request and can comment, with the message "Você pode comentar, mas a decisão é de quem aprova a marca" (it no longer names a person).
6. Revoking `can_decide` or the link of someone blocks their next decision immediately; requests are never orphaned by it, because the pool is evaluated at decision time. A request only has no possible decider when **nobody** is eligible, and the team sees a warning on it ("Ninguém pode aprovar esta marca agora").
7. The decision is **any one** approver (no "all must approve" in this delivery, see O1 below).
8. Reminders (`send_approval_reminder`) go to every eligible approver who has not been notified in the last day; the overdue scanner keeps notifying the sender.

### What goes away

`reassign_approver` and the "Reatribuir aprovador" button; the error codes `not_designated_approver` and `approver_without_access`; `is_mine` and the "Pendentes com outras pessoas" section of the portal panel; `approver_user_id` as a required column (it becomes nullable in the expand migration and is dropped in the contract one). Existing requests keep their old value only as history.

### Screens

- **Team, request detail:** the "Aprovador" line becomes "Quem pode aprovar" (names of the eligible members) and, after the decision, "Decidido por {nome}". "Reenviar lembrete" stays; "Reatribuir aprovador" is removed; "Cancelar pedido" stays.
- **Team, approvals list:** the approver column shows "Quem decidiu" for decided requests and "Qualquer aprovador da marca" for pending ones; the filter by approver becomes a filter by who decided.
- **Brand members tab:** the column "Pode aprovar" (today's `can_decide`) is explained with an `InfoTip`: "Pessoas com esta permissão podem aprovar ou pedir alterações nos conteúdos da marca."
- **Portal:** "Aguardando você" lists every pending request of the brand the person may decide; the section "Pendentes com outras pessoas" goes away; non-eligible members see their requests read-only with the comment option.

### Open decisions

| ID | Decision | Status |
|---|---|---|
| O1 | Quorum: **any one** eligible approver decides. "All must approve" or "N of M" can come later as a brand setting | Decided for this delivery |
| O2 | Let the sender mark a **preferred** approver who is notified first | Not needed; every eligible approver is notified |

## Approval by the team (decided 2026-10-22)

> Status: **implemented** (2026-10-23; the board, list badge and filter of [content.md](content.md) are missing). The statuses, the manager's options, the screens and the acceptance criteria are in [content.md](content.md#simplified-approval-decided-2026-10-30) (changed on 2026-10-30: no stage); this section holds the request, decision, permission and notification rules. Names are proposals and enter the registries in the implementing change (GOLD-4).

The client's approval must not block publication. The content manager records the approval **for the client**. It is an explicit, audited act by a named person; rule 6 ("delay or silence never equals approval") still holds, and rule 9 (a decision is never changed) too: the decision is created, not altered.

1. **Function.** `approve_on_behalf(p_item, p_reason, p_expected_version)`, one transaction, called by a server function. It locks the content, checks the version and the status (`planning`, `in_production`, `changes_requested` or `awaiting_approval`), and then:
   - **With a pending request:** the request keeps its version (the client sees exactly what is approved), the decision is recorded on it, the request becomes `approved`.
   - **Without a pending request:** a version is created exactly as `submit_for_approval` would, with a request created already decided.
   - In both cases it updates the content (`approved`, and the approved version when it is an art version), writes the audit event, resolves the notifications of the eligible approvers and notifies them (rule 5).
2. **Permission.** `approvals.override` (internal, requires `content.submit`) and the brand link (`has_action` + `can_access_brand`). External users never call it; `anon` cannot.
3. **Decision record.** `approval_decisions` gets `on_behalf boolean not null default false` and `reason text` (internal only). `decided_by` is the manager. The unique decision per request and the immutability trigger stay.
4. **What the client may still do.** Comment. A decision attempt on the closed request is refused with `request_not_pending`; the first decision wins, whoever it is.
5. **Notifications.** A new kind `approval.approved_by_team` goes to the eligible approvers **only when a request was pending** (they were asked): "A equipe aprovou «Lançamento de outono»." No notification when nothing had been sent. The email follows the usual preferences and outbox.
6. **Audit.** One event, proposed action `approval.approved_by_team` (entity `approval_request`, metadata: stage, revision number, whether a request was pending, `reason_given` as a flag; ids and counts only, SEC-12). The reason text stays in the decision row, not in the audit metadata.
7. **Errors.** Existing codes only: `denied`, `conflict`, `transition_not_allowed`, `invalid_input`, `plan_incomplete`, `channel_required`, `media_not_available`, `channel_archived`, `request_not_pending`.
8. **Portal exposure.** `portal_*` functions return `decided_on_behalf` (boolean) and never the manager's name or the reason.

| Open decision | See |
|---|---|
| Art on behalf without an approved plan | Not applicable since 2026-10-30 (O23): there is no required order |
| Reason optional or required | O11, decided: optional, in [content.md](content.md#open-decisions) |

## Screens (team side)

Route: `/admin/marketing/approvals` and the "Aprovações" tab of a brand.

- **List:** content, brand, channel, approver, requested at, deadline, status, age. Filters by brand, approver, status ("Pendentes", "Atrasadas", "Aprovadas", "Alterações solicitadas", "Substituídas") and period. Sorted by deadline; overdue highlighted with text and icon (not color alone).
- **Request detail:** the revision shown to the client (read-only), the decision with its comment, the external comments, the timeline (`ApprovalTimeline`: sent, viewed, decided, superseded), and actions "Reenviar lembrete" (re-sends the notification/email), "Reatribuir aprovador" (supersedes and creates a new request on the same revision only if it is still current), "Cancelar pedido".
- **Viewed indicator:** the portal records the first time the approver opened the request (`viewed_at`), shown on the timeline; it is informational and does not change the status.

## Deadlines and overdue

- The approval deadline is a local date of the brand. A request is **overdue** when the deadline passed and the status is `pending`.
- The scheduled scanner creates `approval.overdue` for the sender and the approver (next day, then every 2 days until resolved) and marks the request visually; nothing changes automatically in the status.
- If the planned publication date passes while the request is pending, the content shows a "Data prevista ultrapassada — replanejar" warning.

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

`approval_requests` and `approval_decisions` as in [../reference/data-model.md](../reference/data-model.md) section 5, with composite foreign keys to the revision and the content (`item_id`), `approval_one_pending_per_item` and `approval_decision_once` indexes, and immutability triggers on decisions. Additional columns proposed: `due_date` (date), `message` (text), `viewed_at` (timestamptz), `cancelled_reason`.

Functions: `submit_for_approval`, `portal_decide_approval`, `portal_get_approval`, `portal_list_pending`, `reassign_approver`, `cancel_request`, `reopen_content`, `record_request_view`.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `approvals.view` | See requests, decisions and history of linked brands | — |
| `content.submit` | Create requests (send for approval) | `content.update` |
| `content.reopen` | Reopen/supersede | `content.update` |
| `approvals.decide` | **External** designated approver: decide through the portal | `portal.view` |
| `comments.create_external` | Comment in the portal | `portal.view` |

Deciding also requires being the designated approver and an active external membership with `can_decide` for the brand.

## Notifications

`approval.requested`, `approval.decided`, `approval.superseded`, `approval.overdue` (see [../foundations/notifications.md](../foundations/notifications.md)). Email failure never removes a request: it stays available in the portal.

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`request_not_pending`, `revision_superseded`, `comment_required`, `approver_required`, `conflict`, `denied`, `not_found`.

## Acceptance criteria

- The approver sees exactly the revision submitted; editing the content afterwards does not change it.
- A decision on a superseded revision is refused, including when two sessions act at the same time.
- Requesting changes without a comment is refused; every decision records revision, approver, date and outcome.
- An external member of brand A cannot see, comment on or decide a request of brand B, even by changing identifiers.
- A member who is not the designated approver cannot decide, only comment (if allowed).
- Revoking the approver's access blocks the decision immediately and keeps the history.
- An approval received after the planned date raises a warning and does not publish anything.
- Reopening an approved content is audited with a reason and requires a new approval.
- Overdue requests are flagged and notified without changing their status.

## Implementation status

Phase 3 (tasks P3-02, P3-03, P3-05, P3-06, 2026-10-18). Done: `approval_requests` and `approval_decisions` with their guards in `20261018100900_content.sql`; `submit_for_approval`, `reassign_approver`, `cancel_request`, `send_approval_reminder`, `reopen_content` in `…100910_content_functions.sql`; `portal_decide_approval`, `portal_get_approval`, `portal_record_view`, `portal_list_pending`, `portal_list_approvals` in `…100920_portal_functions.sql`; team screens `/admin/marketing/approvals` (tabs Pendentes, Atrasadas, Aprovadas, Alterações solicitadas, Substituídas; brand filter; overdue marked with text and icon) and `/admin/marketing/approvals/$requestId` (exact revision shown to the client, timeline sent/viewed/decided, decision, external comments, "Reenviar lembrete", "Reatribuir aprovador", "Cancelar pedido") and the brand tab "Aprovações"; notifications `approval.requested`, `approval.decided`, `approval.superseded` written in the same transaction as the operation and queued for e-mail through `email_outbox` (worker `/api/cron/email-outbox`, migration `…100940_email_outbox_worker.sql`).

Validation performed: the pgTAP assertions of [content.md](content.md) cover submission, supersession, designated approver, member without `can_decide`, commenter, approver of another brand, superseded revision, decision recorded once, revoked `can_decide` and revoked link, reassignment, cancellation, reminder de-duplication and the audit events; Vitest for the outbox rules (back-off, final failure, internal links only, escaped template). **Not tested**: simultaneous sessions, sending through the real e-mail provider, the worker against a database. **Not done**: the scheduled `approval.overdue` scanner (task P4-04), the period filter of the list.

2026-10-19: The shared list-filter trigger now uses an icon with a tooltip and active-count badge. This applies to the approvals list. Validation performed: targeted ESLint, Prettier and `git diff --check`. `check:docs` is currently blocked by ten audit-action registry mismatches for `calendar_note.*` and `variant.*` in the audit/functions documents. Full typecheck is blocked by existing `brand-logos.server.ts` type errors. **Not tested**: browser interaction.

2026-10-20 (approver pool and two stages, tasks T-02 to T-07): `portal_decide_approval`, `portal_get_approval`, `portal_list_pending`, `portal_record_view`, `portal_list_brands`, `portal_list_calendar`, `portal_request_row`, `submit_for_approval`, `send_approval_reminder`, `cancel_request` and `dashboard_attention` follow the pool (anyone with the right to approve decides; the first decision wins; every approver is notified and their notifications are resolved on the decision); `reassign_approver`, `approver_user_id`, `is_mine`, "Reatribuir aprovador" and the portal section "Pendentes com outras pessoas" were removed (the section is now "Em análise pela marca", read-only, for members who cannot decide). Team screens: the list shows the stage and "Quem decidiu", the detail shows "Quem pode aprovar". Validation performed: see the status of [content.md](content.md) (808 SQL assertions, Vitest, typecheck, lint). **Not tested**: simultaneous decisions from two real sessions, the screens in a browser.

2026-10-22: **approval by the team specified (documents only).** See "Approval by the team" above and [content.md](content.md#flexible-approval-decided-2026-10-22). The "dispensing approval" item left the list of exclusions. Validation performed: `npm run check:docs`. **Nothing implemented** (no migration, `approve_on_behalf`, `on_behalf` column, `approval.approved_by_team` kind or audit action, screens or pgTAP tests).


2026-10-23: **flexible approval implemented** (the manager approves the plan or the art on the client's behalf). O10 and O11 were decided with the recommendations (art refused without an approved plan; reason optional). Migration `20261023110000_approvals_approve_on_behalf.sql`: `approval_decisions.on_behalf` and `reason`, the action `approvals.override` (starting role `manager`), the notification kind `approval.approved_by_team`, the audit action of the same name, `editorial_transition_allowed` widened (a status can now reach `plan_approved`/`approved` from the statuses before it; `content_move` still refuses both), the internal helper `content_freeze_revision` (extracted from `submit_for_approval`, which now calls it, so sending and approving freeze a version the same way), `approve_on_behalf`, and `portal_request_row`/`portal_get_approval` returning `decided_on_behalf` and hiding the manager's name. Code: `approveOnBehalf` (`workflow.functions.ts`), `approveStageOf` and the new transitions (`editorial.ts`), the action "Aprovar planejamento pelo cliente"/"Aprovar arte pelo cliente" and its dialog (`content-actions.tsx`, `content-editor.tsx`, `ReasonDialog` got `optional`), the team approval detail and list ("Aprovado pela equipe", the reason), and the portal decision card and request card. Validation performed: `npm run db:verify` (950 assertions, 0 failures; 31 new in `22_approve_on_behalf.test.sql`), Vitest (153), typecheck, ESLint, Prettier, `check:consistency`, `check:docs`; Applied to the linked project on 2026-10-23 (`db push`, then `db:types -- --linked`; typecheck passes with the real types). **Not done:** the board's "Mover para…" opening the dialog, the "Aprovado pela equipe" marker and filter on the list and board badges, the same text in the revision history of the editor. **Not tested:** the screens in a browser, two simultaneous decisions from real sessions, the notification email.

2026-10-30 (O23, simplified approval): a content has one approval with no stage in its status. `submit_for_approval`, `approve_on_behalf` (no `p_stage`), `portal_decide_approval` (status `approved` or `changes_requested`, `approved_revision_id` only for an art version), `reopen_content` (no `p_scope`), `send_approval_reminder` and the notification texts were replaced in `20261030100000_simplified_approval.sql`; the request keeps `stage` to tell a planning version from an art version. Validated with `npm run db:verify` (1105 assertions, tests `19_simplified_approval`, `21_content_published` and `22_approve_on_behalf` rewritten). The migration was applied to the linked project on 2026-10-30. **Not tested**: the portal screens with a real session.

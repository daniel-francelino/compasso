# Module — Approvals

> Functional specification. Context and conventions in [README.md](README.md). Spaces: `marketing` (requesting and following up, `/admin/marketing/approvals`) and `portal` (deciding, see [portal.md](portal.md)). Transactional rules in `technical-architecture-v0.1.md`, section 10.

## Goal and scope

Let the team send a content to the client and obtain a **traceable decision about exactly what was sent**. Approval is by **revision** (immutable), by **one designated approver per request**, and never implicit: delay or silence is not approval.

Included: requests, decisions (approve / request changes), supersession, deadlines, overdue handling, history, reopening. Not included in the MVP: multiple approvers or approval chains, anonymous approval links, dispensing approval (a manager's override, to be validated later as `approvals.override`), automatic reminders by email beyond the notification kinds.

## Concepts

| Concept | Meaning |
|---|---|
| Approval request (`approval_requests`) | A request for a decision about **one revision** of a content, addressed to a designated approver |
| Decision (`approval_decisions`) | The result: `approved` or `changes_requested`, with the revision, the approver, the date and (when requesting changes) a mandatory comment |
| Designated approver | An external member of the brand with `can_decide` chosen when submitting |
| Status of a request | `pending`, `approved`, `changes_requested`, `superseded`, `cancelled` |

At most **one pending request per content** (partial unique index). A decision is recorded **once** per request (unique index).

## Rules

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

`request_not_pending`, `revision_superseded`, `comment_required`, `approver_without_access`, `approver_required`, `not_designated_approver`, `conflict`, `denied`, `not_found`.

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

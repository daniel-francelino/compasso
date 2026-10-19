# Module — Dashboard

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (`/admin/marketing`, UI label "Visão geral" / "Início"). It is the work panel of the team: **what needs attention, what is coming, and how the work is going**.

## Goal and scope

A single screen that gathers, by permission and brand access, what the other modules produce, without duplicating data or creating new records. It answers three questions: *What needs me now?* *What is coming?* *Is anything late or blocked?*

Included: attention list, upcoming schedule, status summary, activity feed. Not included in the MVP: performance metrics or social analytics, custom dashboards, exports, goals and targets.

## Blocks

Every block is computed on the server from the source tables, paginated or limited, filtered by `can_access_brand` and the person's actions. A block the person has no action for is not rendered (and its query is not executed).

| Block | Content | Source | Action needed |
|---|---|---|---|
| **Precisa de atenção** | Overdue approvals, contents with `changes_requested`, overdue production deadlines, planned dates already passed without publication, approvers without access | content, approvals | `content.view` / `approvals.view` |
| **Aprovações pendentes** | Requests awaiting the client, age and deadline, by brand | approvals | `approvals.view` |
| **Próximos prazos e publicações** | The next 14 days: production deadlines and planned posts (by day) | content, calendar | `calendar.view` |
| **Conteúdos por estado** | Counts by editorial status (draft → approved), per brand filter | content | `content.view` |
| **Minhas tarefas** | Items where I am the owner, with the next deadline | content | `content.view` |
| **Atividade recente** | Latest internal events: submissions, decisions, comments (with an "Externo" badge), publications | audit (business events) | `audit.view` or `approvals.view` |
| **Acessos** | Pending invitations and expiring invitations | invitations | `users.view` |
| **Armazenamento** | Library quota use (only when above 80 %) | media | `media.delete` |

Each item links to the exact record. Counts that would reveal brands or content the person cannot access are never shown.

## Filters and behavior

- Brand selector (all authorized brands by default); the choice lives in the URL.
- Blocks load independently with skeletons; a failing block shows an inline error with "Tentar novamente" without breaking the page.
- Responsive: on mobile the blocks stack in the order "Precisa de atenção", "Pendentes", "Próximos"; the rest below.
- **Everything is derived**: nothing on the dashboard is stored or editable. Definitions of the counts live in one place (`lib/marketing/dashboard`) and are reused by notifications and list filters so numbers always agree.
- Definitions: **overdue approval** = pending request past its deadline; **late production** = production deadline past and the content is not yet `approved`; **needs attention** counts each content once even if it matches several rules; the reason is shown.

## Data and functions

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

Server functions (`lib/marketing/dashboard/*.functions.ts`) such as `getAttention`, `getUpcoming`, `getStatusCounts`, `getMyItems`, `getRecentActivity`; outputs validated with zod. Heavy aggregations use SQL functions with the proper indexes `(brand_id, editorial_status)`, `(brand_id, planned_at)`, `(status, due_date)`.

Cache: `staleTime` of 30–60 seconds in TanStack Query; invalidated after relevant mutations (submit, decide, reopen, publish record); live updates through the notification subscription when an approval is decided.

## Permissions

The dashboard itself requires an approved account with at least one marketing action (`brands.view`, `content.view` or `approvals.view`); each block applies its own action as listed above. The Owner sees all brands; others only linked brands.

## Acceptance criteria

- A user linked to brand A sees only brand A in every block and every count.
- A user without `approvals.view` does not see approval blocks or their counts.
- A content that is late for two reasons appears once, with both reasons.
- Opening an item from the dashboard leads to the right record and, after the action, the dashboard updates without a full reload.
- A failure in one block does not affect the others; skeletons keep the layout stable.
- The numbers on the dashboard equal those of the filtered lists they link to.

## Implementation status

Phase 3 (task P3-07, 2026-10-18). Done: migration `20261018100930_dashboard.sql` (`dashboard_attention`, `dashboard_status_counts`, `dashboard_my_items`); `src/lib/marketing/dashboard/dashboard.functions.ts`; the page `/admin/marketing` ("Visão geral", reached from `/admin` for people with a marketing action) with the blocks "Precisa de atenção" (each content once with all its reasons), "Aprovações pendentes" (reuses the approvals list), "Conteúdos por estado" (links to the filtered list) and "Minhas tarefas", each with its own skeleton and retry, a brand filter in the URL and blocks hidden without the action.

Validation performed: 18 pgTAP assertions on PGlite (every reason, a content with two reasons listed once, brand isolation, external user refused, anon refused); typecheck, lint, build. **Not tested**: the page in a browser. **Not done**: "Próximos prazos e publicações" (`dashboard_upcoming`, still open after phase 4: the calendar itself is the place for it), "Atividade recente", "Acessos" and "Armazenamento" blocks, live update through the notification subscription (the blocks refetch after the 30-second stale time and after mutations).

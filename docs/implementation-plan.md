# Implementation plan (task backlog)

> The ordered, task-level plan for building Compasso. The technical architecture (section 23) gives phases and estimates; this document turns each phase into **tasks with IDs, dependencies, the documents to read, the registries to touch and the acceptance checks**, so an implementation session can take one task, do it completely and mark it done. Work **one task at a time**, in order, unless a task says it is independent. Every task follows base.md (rule IDs), the Definition of Done (base.md section 10) and updates the "Implementation status" of the module it belongs to. Status values: `todo`, `doing`, `done`, `blocked`. Anything that needs an account, a machine setup or an owner decision, and anything written but not verified on the real service, is listed in [pending-external-setup.md](pending-external-setup.md). Update the status column in the same change that finishes the task.

## How to execute a task (checklist for the assistant)

1. Read the **Read** column documents and the rule IDs of base.md that apply.
2. Look up every name in [reference/](reference/README.md); add the missing ones to the registries first.
3. Search for existing implementations (base.md section 2); extend, never duplicate.
4. Implement in this order: migration → SQL functions → pgTAP tests → `db:types` → server functions → hooks → components → route → e2e.
5. Run the checks (base.md section 11) and update docs and status.
6. Report: what was done, what was verified, what was not.

## Phase 0 — Foundations

| ID | Task | Read | Registries / outputs | Done when | Status |
|---|---|---|---|---|---|
| P0-01 | Repository bootstrap: copy the Memoria Print skeleton (`package.json`, `tsconfig.json`, `.prettierrc`, `eslint.config.js`, `eslint-local/`, `.husky/`, `components.json`, `scripts/`), remove Lovable, ERP, POS and brand code; empty the legacy exception lists; npm only | architecture §17.1, project-structure | scripts `lint`, `typecheck`, `format`, `format:check`, `check:consistency`, `check:docs` (runs `scripts/check-docs.mjs`, already written), `db:types`, `test`, `e2e`; husky `pre-commit`/`pre-push` | `npm run lint && npm run typecheck` pass on the empty skeleton | done (2026-10-18). Verified: lint, typecheck, format:check, check:docs, test (no tests yet), `vite build` with the Vercel preset. Not done yet: Playwright config (P0-09), real `check:consistency` (P0-07), space boundaries (P0-02) |
| P0-02 | ESLint boundaries for spaces `marketing`, `cms`, `site`, `portal`, `shared`; `noSiteContentInCode`; color lint; `no-restricted-imports` for the service-role module | project-structure, base.md CODE, UI-9 | `eslint.config.js` | A test file importing across spaces fails lint | done (2026-10-18). Verified with throwaway files: marketing→cms import and service-role import outside the allow-list fail; the service-role import in `lib/shared/jobs` passes the restriction. Color lint is active but only exercised by the guard hook so far |
| P0-03 | Design tokens and base styles from the palette; fonts by `<link>` in `__root.tsx`; heading utilities | color-palette, design-system | `src/styles.css` | Page renders with tokens; no hex outside `styles.css` | done (2026-10-18). Verified: build compiles the tokens and `heading-*` utilities, lint/typecheck/format pass, hex only in `styles.css`. Not verified: visual check in a browser; fonts still pending confirmation with the brand material |
| P0-04 | Supabase projects (staging, production), local `supabase init`, migration 1 `core_extensions_and_organization` | data-model §2, §10 | migrations, `.env.example` (no values) | `supabase db reset` works locally | doing. Done: `supabase init`, migration 1, `.env.example`. Blocked on S1/S2 (Docker, Supabase projects): see [pending-external-setup.md](pending-external-setup.md) |
| P0-05 | Migration 2 `auth_roles_profiles`: roles, actions, profiles, guards, `has_action`, `is_admin`, `my_actions`, seeds (actions catalog, 5 roles) | roles-and-actions, authentication, data-model §3 | actions seed = [roles-and-actions](foundations/roles-and-actions.md) catalog | pgTAP: each role × protections (self-change, last Owner, admin-only) | done (2026-10-18) on PGlite: migration `auth_roles_profiles` + 61 assertions in `supabase/tests/01_*.sql` (`npm run db:verify`). Real stack not run, see [pending-external-setup.md](pending-external-setup.md) V1/V3 |
| P0-06 | Migration 4 `audit_events` + `audit_write` + `AuditAction` + catalog | audit, data-model §8 | `lib/shared/audit/actions.ts` | `check:consistency` compares catalog and constants | done (2026-10-18) on PGlite: migration `audit_events`, `AuditAction`, 14 assertions, `check:consistency` compares SQL, TS and the catalog. Real stack: [pending-external-setup.md](pending-external-setup.md) V1/V3 |
| P0-07 | `scripts/seed-owner.mjs` (env password, idempotent), `scripts/check-consistency.mjs` adapted to the registries, `scripts/db-types.mjs` | authentication §7, reference/README | scripts | Owner created; consistency script green on the seed | done except the run against a real project: `seed-owner.mjs` (idempotent, syntax-checked), real `check:consistency` (actions, error codes, audit actions, 3 CHECK lists), `db-types.mjs` and `db-types-offline.mjs`. Pending: S4/S5, V2, V5 in [pending-external-setup.md](pending-external-setup.md) |
| P0-08 | Supabase clients typed with `Database`; `env.ts`; `logger.ts`; `server-utils.ts` (`Result`, `fail`, `parseOutput`); `errors.ts` with the generic codes; `query-keys.ts`; `stored-keys.ts`; `format.ts` | base.md CODE/SEC, error-codes §2 generic | `lib/shared/*` | unit tests for `fail`, `parseOutput`, `format` | done (2026-10-18): lib/shared core (logger, results, errors, query keys, stored keys, format, env), typed Supabase clients (browser, server, anon, admin), 17 Vitest tests. Types come from the offline generator until V2 in [pending-external-setup.md](pending-external-setup.md) |
| P0-09 | Auth flow: login, session, `getAuthState`, guards (`requireAction`, `requireActionServer`), `/admin` layout, `forbidden`, `pending`, `access-denied`, `Action` constants | authentication, routes §2–3 | `lib/shared/auth/*`, routes | E2E: login → `/admin`; no session → `/admin/login?redirect=` | done except authenticated flows: login, sign-out, `getAuthState`, guards, `/admin` and `/portal` layouts, pending, access-denied, forbidden. 3 Playwright tests pass for the unauthenticated flows; authenticated E2E pending S2–S5, V4 in [pending-external-setup.md](pending-external-setup.md) |
| P0-10 | Shell of the admin: sidebar, space switcher, `nav-config.ts`, `PageHeader`, skeletons, `EmptyState`, `DataTable`, `PaginationBar`, `ConfirmDialog`, `Field`, toasts | admin-layout-and-standards, design-system | `components/shared/admin/*`, `ui/*` | Storybook-like `/admin/design` page renders all states | done (2026-10-18): sidebar, space switcher, `nav-config`, `PageHeader`, `DataTable`, `PaginationBar`, dialogs, `Field`, `StatusBadge`, toasts and the development page `/admin/design`. Visual review pending (V7 in [pending-external-setup.md](pending-external-setup.md)) |
| P0-11 | CI (GitHub Actions: lint, typecheck, vitest, `supabase test db`, types diff, build), Vercel project with an example deploy | architecture §18, §22 | `.github/workflows`, `vercel.json` | CI green; preview deploy opens the login | done as files: `.github/workflows/ci.yml` (checks, database, e2e) and `vercel.json`. Not run: needs a remote and a Vercel project, S6/S7/V6 in [pending-external-setup.md](pending-external-setup.md) |
| P0-12 | Documentation check: registries match the first migration; `/check-standards` passes | base.md §14 | — | no divergence between docs and code | todo until S1 and S2 are done: the registries must be compared with the migrations on the real stack. Today `check:consistency` and `check:docs` pass |

## Phase 1 — Access and commercial structure

| ID | Task | Read | Registries | Done when | Status |
|---|---|---|---|---|---|
| P1-01 | Migration 3 `auth_invitations`; `accept_invitation`; invitation server functions and email adapter (Resend) | authentication §4, functions §2 | error codes `invitation_*`; email templates | Accept flow works with a stub mailer; token hash only stored | todo |
| P1-02 | Users and Roles screens (`/admin/settings/users`, `/roles`), invite/revoke/resend, role matrix | authentication §5, roles-and-actions §9, routes | `Action` for `users.*`, `roles.manage`, `invitations.create` | E2E: Owner invites a Manager; the Manager accepts and sees only allowed items | todo |
| P1-03 | Migration 6 `clients_brands_channels`; `can_access_brand`, `is_external_brand_member`; save/archive/delete functions | clients, brands, channels, data-model §4 | functions §3; error codes | pgTAP matrix: Owner, Manager linked, Collaborator, unlinked user, external user, anon × tables | todo |
| P1-04 | Clients UI (list, create with first brand, record with tabs, contacts, archive) | clients | routes `/admin/marketing/clients*` | acceptance criteria of clients.md | todo |
| P1-05 | Brands UI (list, overview, members, identity, settings, brand switcher) | brands | routes `/admin/marketing/brands*` | acceptance criteria of brands.md | todo |
| P1-06 | Channels UI + platform descriptors (`Platform` constants, limits) | channels | `Platform`, descriptors in `shared/preview` | acceptance criteria of channels.md | todo |
| P1-07 | Organization settings screen and policies (`organization_settings`) | organization-settings | policies keys | policies validated by zod; audited | todo |
| P1-08 | Audit screen (`/admin/settings/audit`) | audit | — | filters, brand scope, export audited | todo |
| P1-09 | Notifications infrastructure (migration 5), bell, page, preferences, `pg_cron`/Realtime | notifications | `NotificationKind` (`invitation.accepted` first) | dedupe, RLS and real-time criteria | todo |

## Phase 2 — Media Library

| ID | Task | Read | Done when | Status |
|---|---|---|---|---|
| P2-01 | Migration 7 `media`; storage layer `ServerStorage`/`BrowserStorage` with `aws4fetch`; limits; quota | media-library, r2-storage, data-model §6 | pgTAP + integration tests with a rehearsal bucket | todo |
| P2-02 | Upload flow: `requestUpload`, browser upload, reduced copies, `confirmUpload` (stat → range → validate → RPC), cleanup cron | media-library §8, r2-storage §5 | wrong size/MIME/oversized copy refused without full download | todo |
| P2-03 | Library screens: grid/list, record, collections, trash, "used in", storage bar, `MediaPicker` | media-library §5–6 | acceptance criteria of media-library.md | todo |
| P2-04 | Signed reads (`signMediaUrls`) with authorization; CORS verified on real domains | r2-storage §4, §6 | an external user of brand A gets nothing of brand B | todo |

## Phase 3 — Content and approvals (core)

| ID | Task | Read | Done when | Status |
|---|---|---|---|---|
| P3-01 | Migration 8 part 1: content tables, immutability triggers, save/move/cancel functions | content, data-model §5 | pgTAP: transitions, composite FKs, immutability | todo |
| P3-02 | `submit_for_approval`, `reopen_variant`, `mark_published`, concurrency tests | content, approvals, functions §4 | two-session concurrency test passes; audit written in the same transaction | todo |
| P3-03 | Portal functions and policies (`portal_*`), `portal_decide_approval` | portal, approvals, functions §5 | pgTAP: brand A vs B, non-designated approver, superseded revision | todo |
| P3-04 | Content UI: list, board, item page, variant editor, `ChannelPreview`, comments, send-for-approval dialog, manual publication | content | acceptance criteria of content.md | todo |
| P3-05 | Approvals UI (team side) and portal (`/portal/*`): dashboard, approval screen, comments | approvals, portal | E2E: invite → approve; request changes → new version → approve | todo |
| P3-06 | Notifications for approvals (`approval.*`, `comment.created`), email outbox + cron | notifications | email failure does not remove the request | todo |
| P3-07 | Dashboard blocks (attention, pending, status counts, my items) | dashboard | acceptance criteria of dashboard.md | todo |

## Phase 4 — Calendar

| ID | Task | Read | Done when | Status |
|---|---|---|---|---|
| P4-01 | Spike: FullCalendar vs porting the Memoria Print calendar; decide and record the decision in calendar.md | calendar, architecture §4 | decision documented | todo |
| P4-02 | `list_calendar_entries`, `portal_list_calendar`, `reschedule_variant`; time zone tests (DST) | calendar, functions §6 | DST and non-DST zones tested | todo |
| P4-03 | Calendar UI (month, week, list, no-date list, drag with confirmation, filters in URL); portal calendar | calendar, design-system | acceptance criteria of calendar.md | todo |
| P4-04 | Scheduled notifications (`approval.overdue`, `content.due_soon`, `variant.publish_due`) | notifications | scanners idempotent | todo |

## Phase 5 — Site and CMS

| ID | Task | Read | Done when | Status |
|---|---|---|---|---|
| P5-01 | Migration 10 `site_cms`; settings, public read functions, public rendering with 503 states | cms-site, public-site-delivery, data-model §7 | states of public-site-delivery §3 verified | todo |
| P5-02 | Section registry, `renderPage`, editor, preview, publish checks, rollback | cms-dynamic-architecture, cms-site | preview equals production | todo |
| P5-03 | Public derivatives (`media_publish_derivative`) and `media.publish` UI | media-library, r2-storage §7 | publishing refuses unpublished images | todo |
| P5-04 | Services, testimonials, portfolio and case study authorization | cms-site §12 | unauthorized case never published | todo |
| P5-05 | Contact form (Turnstile, rate limit), messages inbox, SEO, sitemap/robots, redirects | cms-site §8, §11 | acceptance criteria phases D–E | todo |

## Phase 6 — Hardening and launch

| ID | Task | Done when | Status |
|---|---|---|---|
| P6-01 | CSP and security headers; secrets review; MFA for Owners | headers verified; MFA enforced | todo |
| P6-02 | Backups and **restore test** (PostgreSQL and R2); runbooks in `docs/foundations/` | restore executed and documented | todo |
| P6-03 | Performance (Lighthouse LCP < 2.5 s on the public site) and accessibility (`axe`) | scores recorded | todo |
| P6-04 | Real data setup, retention policies, LGPD register | policies applied | todo |
| P6-05 | Final consistency pass: registries ↔ code ↔ docs; all "Implementation status" sections honest | `/check-standards` clean | todo |

## Rules for this plan

- Do not start a task whose dependencies are not `done`.
- A task is not `done` until its tests exist and pass (or the gap is written in the module's "Implementation status").
- If a task needs a name that is not in the registries, add it first.
- If reality changes the plan, update this document in the same change (DOC-2), not afterwards.

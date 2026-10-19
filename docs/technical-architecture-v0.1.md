# Marketing management platform — Technical architecture

Version 0.3 • October 18, 2026 • Technical document to start implementation
Base: [product-documentation-v0.1.md](product-documentation-v0.1.md) (v0.3). Code rules inherited from the Memoria Print project.

---

## Table of contents

1. Goal, scope and conventions
2. Rules inherited from Memoria Print
3. Architecture decisions (ADRs)
4. Technology stack
5. Architecture overview
6. Spaces, modules and folder structure
7. Authentication, identity and invitations
8. Authorization: profiles, actions and brand link
9. Data model (summary; schema in reference/data-model.md)
10. State machines and transactional rules
11. Media Library (Cloudflare R2)
12. Public site and CMS
13. Editorial calendar and time zones
14. Client Portal
15. Application layer (code patterns)
16. Routes, guards and navigation
17. Frontend: interface kit, design system and standards
18. Deploying on Vercel
19. Environments, configuration and secrets
20. Security
21. Observability, audit and notifications
22. Tests, quality and automation
23. Implementation plan by phase
24. Risks and open points
25. Appendices

---

## 1. Goal, scope and conventions

This document turns the product document into an implementable technical specification: it fixes the stack, the code structure, the data model, the critical flows (approval, upload, publishing) and the deployment.

**Document conventions**

- **[Confirmed]**: decided by the author (Supabase, Cloudflare R2, Vercel, TanStack Start, English everywhere except UI, Memoria Print rules).
- **[Proposed]**: technical choice of this document, changeable at the cost indicated.
- **Language rule**: documentation, folder names, file names, code, routes, tables, columns and SQL are in **English**. Only the **UI copy** (what the user reads on screen, emails and notification texts) is in **Brazilian Portuguese**. Where a screen or status is named in this document, its pt-BR UI label is shown in quotes.
- Library versions, TanStack Start API names and plan limits (Vercel, Supabase, Cloudflare) change. Confirm them in the official pages when installing or contracting. As a starting point for versions, use the `package.json` of Memoria Print.
- Code snippets in this document are illustrative and carry comments only to explain; in the real `src` code there are **no comments** (section 2).

**Out of MVP scope**: automatic publishing to social networks, billing, commercial CRM, multi-organization SaaS, anonymous approval links, AI.

**Scale assumption (to validate)**: one organization, about 10 internal users, dozens of clients, a few hundred brands and channels, thousands of files. Nothing requires infrastructure beyond Vercel, Supabase and R2.

---

## 2. Rules inherited from Memoria Print

The `memoria-print` project (TanStack Start + Supabase + R2) is the reference for code, security and organization. Compasso starts from its skeleton (phase 0) and follows the same rules. The `AGENTS.md` of Compasso summarizes them and **prevails over any document**. This chapter says how each rule applies here.

### 2.1 Organization

| Rule | Application in Compasso |
|---|---|
| Type → space → module: `components/<space>/<module>`, same in `lib` and `hooks` | Spaces: `marketing`, `cms`, `site`, `portal`, `shared` (section 6) |
| A space never imports from another; what two spaces use goes to `shared` | Enforced by `no-restricted-imports` in ESLint, one block per space |
| Imports always through the `@/` alias; relative paths only inside the same module; no re-exporting `index.ts` | Same |
| The route file only assembles the screen; logic lives in `components`, `lib` and `hooks` | Same |
| Server functions in `*.functions.ts` files | Same |
| Code in English; UI texts in Brazilian Portuguese; **documentation, folders and files in English** | Same (stricter than Memoria Print, whose docs are in Portuguese) |
| Generic components in `shared/ui` (shadcn) and `shared/admin` (back office kit) | Copied from Memoria Print and adapted |
| Component file over 600 lines raises a warning | Same |

### 2.2 Code style and quality (enforced by ESLint and husky)

- No comments in `src` (not even JSDoc). Only `eslint-disable … -- reason` and `@ts-expect-error` remain.
- No `console`: use `logError` from `src/lib/shared/logger.ts`.
- Imports in a single block, no blank line between them; `consistent-type-imports` with `inline-type-imports`.
- No nested `if` (`local/no-nested-if`), no empty JSX, no `no-magic-strings`.
- No `as unknown as`, no `!` (non-null assertion), no `any`.
- `eqeqeq`, `prefer-const`, `no-else-return`, `object-shorthand`, `exhaustive-deps` as errors.
- Prettier: width 100, double quotes, semicolons, trailing commas everywhere.
- TypeScript at maximum strictness: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`.
- Lists of legacy ESLint exceptions can only shrink. In a new project they **start empty**.
- `lint` runs with `--max-warnings 0`.

### 2.3 Constants and contracts

- No loose text where a constant exists: permissions as `Action.Module.Verb`, cache keys as `QueryKey.X`, statuses as `as const` objects with the derived union (`ValueOf`), browser storage through `StoredKey` with `readStored`/`writeStored`, `z.nativeEnum` instead of `z.enum([...])`.
- SQL and TypeScript must match: `npm run check:consistency` (in `pre-push`) compares permissions, error codes, notification kinds and the `CHECK` lists of the statuses.
- Generated database types (`npm run db:types`) passed to the Supabase clients.
- Every server function input has `.validator(zodSchema)`. Every RPC `jsonb` output goes through `parseOutput(schema, data)`.
- `Result<T>` defined in a single place (`server-utils.ts`), with an error `code` and `fields` for per-field errors. Pagination with `Page<T>`.

### 2.4 Security

- Permissions by **actions** (`module.verb`) of configurable profiles, checked in four layers: menu, route (`requireAction`), server (`requireActionServer`) and RLS (`has_action`). Hiding a button is never security.
- Access protections: nobody changes their own profile or suspends themselves; never remove the last Owner; `user_metadata` never decides access; write actions require the read action; administration-only actions belong only to the system profile.
- Audit of access decisions and profile changes (`profile_audit`, `role_audit`).
- CSRF enabled in `start.ts` for server functions; generic login messages; validated redirects; signing out clears cookies and the TanStack Query cache.
- Secrets only on the server (never with the `VITE_` prefix); errors shown to the person without internal details; sensitive data out of the logs.

### 2.5 Interface (`docs/standards/base.md`, `admin-layout-and-standards.md`, `design-system.md`)

- Feature completion checklist: pagination/search/filters on the server, skeleton and states (loading, empty, no result, error, success), double-submit blocking, validation on client and server with focus on the first error, unsaved-changes warning, permissions in menu, route, server and RLS, confirmation of destructive actions, layout tested on phone, tablet and desktop.
- Colors only through tokens in `styles.css`: no hex, no pure black/white, no default Tailwind palette (enforced by lint). Fonts through `<link>` in `__root.tsx`, never a remote `@import`.
- A section card is always `SectionCard`; a group of fields is always `FieldGroup`.
- Money in integer cents; dates formatted by `src/lib/shared/format.ts`.
- Menu configured in a single file (`nav-config.ts`), each item with the required `action`.

### 2.6 Process and documentation

- Husky: `pre-commit` runs `lint-staged` (Prettier); `pre-push` runs `lint`, `typecheck` and `check:consistency`.
- Documentation by folder in `docs/` (all names in English): `modules/`, `spaces/`, `foundations/`, `standards/`, `audits/`, `history/` (the last three or four are created when there is something to put in them). Each module document has an "Implementation status" section.
- Maintenance rule: each delivery updates the status, lists the relevant files and migrations and records the validation done.

**Document map** (all in English; the technical architecture gives the overview and these documents give the detail of each area):

| Area | Document |
|---|---|
| Product scope | [product-documentation-v0.1.md](product-documentation-v0.1.md) |
| Task-level implementation backlog | [implementation-plan.md](implementation-plan.md) |
| Registries (tables, functions, routes, enums, error codes) | [reference/README.md](reference/README.md) |
| UI terms in pt-BR | [standards/ui-glossary.md](standards/ui-glossary.md) |
| Functional specification of each module | [modules/README.md](modules/README.md) (clients, brands, channels, content, approvals, calendar, dashboard, portal, organization and settings, audit) |
| Cross-cutting rules, layout, component kit | [standards/base.md](standards/base.md), [standards/admin-layout-and-standards.md](standards/admin-layout-and-standards.md), [standards/design-system.md](standards/design-system.md) |
| Folder structure and import rules | [standards/project-structure.md](standards/project-structure.md) |
| Colors, contrast, tokens | [standards/color-palette.md](standards/color-palette.md) |
| Accounts, invitations, sessions | [foundations/authentication.md](foundations/authentication.md) |
| Roles, actions and brand scope | [foundations/roles-and-actions.md](foundations/roles-and-actions.md) |
| In-app alerts and email | [foundations/notifications.md](foundations/notifications.md) |
| File storage (R2) | [spaces/r2-storage.md](spaces/r2-storage.md) |
| Media Library | [spaces/media-library.md](spaces/media-library.md) |
| Site and CMS space; CMS model | [spaces/cms-site.md](spaces/cms-site.md), [spaces/cms-dynamic-architecture.md](spaces/cms-dynamic-architecture.md) |
| Public site delivery | [spaces/public-site-delivery.md](spaces/public-site-delivery.md) |

### 2.7 What is **not** copied from Memoria Print

| Memoria Print item | Decision in Compasso |
|---|---|
| First admin password inside a migration (stays in git history) | The first Owner is created by a seed script that reads the password from an environment variable; the password never enters the repository |
| Login by username through `email_for_username`, callable with the public key (reveals emails) | Login by email only |
| Open sign-up with internal approval | Sign-up **by invitation only**; self-registration disabled in Supabase |
| No automated tests or CI | Vitest, pgTAP, Playwright and GitHub Actions from phase 0 |
| Lovable integration (markers in `AGENTS.md`, `@lovable.dev/vite-tanstack-config`, `.lovable/`) | Removed; `vite.config.ts` uses the TanStack Start plugin and Nitro with the Vercel preset |
| Cloudflare deployment (wrangler) | Deployment on Vercel |
| Documentation, folder and file names in Portuguese | Everything in English; only UI copy in Portuguese |
| Colors, fonts and logo of the Memoria Print brand | Compasso has its own palette ([standards/color-palette.md](standards/color-palette.md)); only the token mechanics and the lint are reused |

---

## 3. Architecture decisions (ADRs)

| # | Decision | Status | Discarded alternative | Reason |
|---|---|---|---|---|
| ADR-01 | **TanStack Start** (React 19 + Vite, TanStack Router and Query) with strict TypeScript | Confirmed | Next.js | Same skeleton and lint rules, many reusable modules from Memoria Print |
| ADR-02 | **Modular monolith** by space (`marketing`, `cms`, `site`, `portal`, `shared`) | Confirmed (Memoria Print rule) | Microservices, multi-app monorepo | Small team; boundaries enforced by lint |
| ADR-03 | **Supabase PostgreSQL** | Confirmed | — | — |
| ADR-04 | **Supabase Auth**, sign-up by invitation only | Confirmed | Auth.js, Clerk | Integrates with `auth.uid()` in RLS |
| ADR-05 | **RLS on every table** and checks repeated on the server | Confirmed | Authorization only in the application | The product requires isolation even with tampered IDs |
| ADR-06 | **Configurable profiles made of actions** (`has_action`) combined with the brand link (`brand_members`) | Confirmed | Fixed roles in an enum | Memoria Print model; the brand link is Compasso's specific extension |
| ADR-07 | External access (portal) **only through dedicated `security definer` functions**, with no `SELECT` on internal tables | Proposed | Per-row RLS policies on internal tables | RLS is per row, not per column: internal notes would leak |
| ADR-08 | **Cloudflare R2** behind a storage interface, S3 API through `aws4fetch`, direct browser upload by presigned URL | Confirmed | Supabase Storage, AWS SDK | Avoids the Vercel function body limit; implementation already used in Memoria Print |
| ADR-09 | Versioned SQL migrations with Supabase CLI; generated types | Confirmed | ORM | RLS, functions and triggers are first-class SQL |
| ADR-10 | **Server functions** (`createServerFn`) for server logic; HTTP server routes only for webhooks, cron and downloads | Confirmed | tRPC | zod validation and end-to-end typing with no extra layer |
| ADR-11 | **Tailwind v4 + shadcn/ui (Radix)**, `shared/admin` kit | Confirmed | MUI, Chakra | Same kit as Memoria Print |
| ADR-12 | Transactional email through **Resend** behind an adapter | Proposed | Default Supabase SMTP | Deliverability and logs; replaceable |
| ADR-13 | Scheduled jobs: **pg_cron** (database only) and **Vercel Cron** (R2 and email); persistent queue only in the automatic-publishing phase | Proposed | Queue from the start | Low volume; avoids premature complexity |
| ADR-14 | Reduced copies (thumbnail and display) generated **in the browser** and validated on the server | Confirmed (Memoria Print pattern) | `sharp` on the server | Avoids memory and CPU time in Vercel functions |
| ADR-15 | Package manager **npm** (scripts, README and husky from Memoria Print); a single lockfile | Proposed | pnpm, bun | Memoria Print has `bun.lock` and npm scripts; pick one and remove the other |
| ADR-16 | Documentation, folder, file, code and SQL names in **English**; only UI copy in Brazilian Portuguese | Confirmed | Portuguese documentation | Decision of the author on 2026-10-18 |

---

## 4. Technology stack

### 4.1 Core

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | Flags from section 2.2 |
| Framework | TanStack Start + TanStack Router (file routes, `( )` groups) | `routeTree.gen.ts` generated and ignored by lint |
| Build | Vite + Nitro (`vercel` preset) | Confirm the preset option in the TanStack Start and Nitro docs |
| UI | React 19, Tailwind CSS v4 (`@theme inline` in `styles.css`), shadcn/ui (Radix), `class-variance-authority`, `lucide-react`, `sonner` | `components.json` points the aliases to `shared` |
| Forms | `react-hook-form` + `zod` (`@hookform/resolvers`) | Same schema on client and server; `zodFieldErrors` and `focusFirstInvalid` |
| Client data | TanStack Query | Keys through `QueryKey.*`; debounced search; an old response never replaces a new one |
| Tables | `DataTable` from the `shared/admin` kit | Pagination, search and filters on the server |
| Calendar | FullCalendar (`dayGrid`, `timeGrid`, `list`, `interaction`; MIT modules) | Alternative: port `month-grid` and `time-grid` from Memoria Print. Decide in a spike at the start of phase 4 |
| Drag and drop | `@dnd-kit` | Content board by status |
| Rich text | Tiptap (minimal extensions) | Store JSON, never HTML |
| Dates | `date-fns` v4 | Instants in UTC; IANA time zone per brand; formatters in `format.ts` |
| Virtualization | `@tanstack/react-virtual` | Large library grids |

### 4.2 Backend and data

| Component | Technology |
|---|---|
| Database | Supabase PostgreSQL |
| Clients | `@supabase/supabase-js` and `@supabase/ssr` (session in cookies), typed with `Database` |
| Migrations | Supabase CLI (`supabase/migrations/YYYYMMDDHHMMSS_name.sql`) |
| Auth | Supabase Auth (email and password; recovery; invitations through our own table) |
| Files | Cloudflare R2 through `aws4fetch`, behind `ServerStorage` and `BrowserStorage` |
| Email | Resend (adapter in `lib/shared/email`), templates in Brazilian Portuguese |
| Rate limiting | Supabase Auth (login and recovery) and, for public server functions (contact form), a counter table in the database or Upstash Redis through the Vercel Marketplace |
| Anti-bot | Cloudflare Turnstile on the site contact form |

### 4.3 Quality and operations

| Area | Tool |
|---|---|
| Lint and formatting | ESLint 9 (flat config, local rules in `eslint-local/`), Prettier, `lint-staged`, husky |
| Unit and integration tests | Vitest |
| RLS and SQL tests | pgTAP (`supabase test db`) |
| E2E and accessibility | Playwright and `@axe-core/playwright` |
| Errors | `logError` as the single output point; plug Sentry (or similar) inside it when budget allows |
| Web metrics | Vercel Analytics and Speed Insights |
| CI | GitHub Actions |

---

## 5. Architecture overview

```
                       ┌──────────────────────────── Vercel ─────────────────────────────┐
 Visitor    ──────────▶│  TanStack Start (SSR + server functions + server routes)        │
 Team       ──────────▶│   ├─ (site)    public pages, read from the published version   │
 Client     ──────────▶│   ├─ admin     /admin/*   (marketing, cms, library, settings)  │
                       │   ├─ portal    /portal/*                                        │
                       │   ├─ *.functions.ts   server logic validated with zod          │
                       │   ├─ server routes    cron, downloads, webhooks                 │
                       │   └─ start.ts         middlewares: error + CSRF                 │
                       └──────┬─────────────────────────────┬────────────────────────────┘
                              │ supabase-js (user JWT)      │ S3 API (aws4fetch, server only)
                              ▼                             ▼
                   ┌─────────────────────┐       ┌──────────────────────────┐
                   │ Supabase            │       │ Cloudflare R2            │
                   │  Postgres + RLS     │       │  private bucket (orig.)  │
                   │  Auth, Realtime     │       │  public bucket (deriv.)  │
                   │  pg_cron, functions │       │   └ media domain         │
                   └─────────────────────┘       └──────────────────────────┘
                              ▲                             ▲
                              └──────────── Browser ────────┘  direct PUT/GET (signed URL)
```

**Principles**

1. The database is the last line of defense (RLS); the server function applies the same rules beforehand and returns useful errors.
2. The browser never receives `SUPABASE_SERVICE_ROLE_KEY`, R2 credentials or privileged keys.
3. Files never pass through Vercel functions: upload and download go straight to R2 by signed URL.
4. The public site reads only **published revisions**, through limited read functions.
5. Critical transitions (submit, approve, manual publish) are transactional SQL functions.
6. The site keeps no content in the code (texts, images and case studies come from the CMS), enforced by lint.

---

## 6. Spaces, modules and folder structure

### 6.1 Spaces

| Folder | Space | Who uses it | URL |
|---|---|---|---|
| `marketing` | Marketing Management ("Gestão de Marketing"): clients, brands, channels, content, approvals (internal side), calendar | Team | `/admin/marketing/...` |
| `cms` | **Site and CMS** ("Site e CMS") space of the back office: pages, services, portfolio, testimonials, SEO, navigation, publishing | Team | `/admin/site/...` |
| `site` | **Public site**: what the visitor sees, drawn from the published version | Visitors | `/`, CMS pages, `/sitemap.xml`, `/robots.txt` |
| `portal` | **Client Portal** ("Portal do Cliente"): pending items, calendar, approval | External users | `/portal/...` |
| `shared` | What more than one space uses: `ui`, `admin`, `auth`, `media`, `calendar`, `editorial`, `preview`, `notifications`, `content`, `storage`, `supabase`, `email` | Everyone | — |

Mind the name: in the back office the space is called "Site and CMS"; in the code the folder is `cms`, so it is not confused with `site`, which is the public site. On screen it stays "Site e CMS". The library (`/admin/library`) and settings (`/admin/settings`) belong to `shared`: library in `shared/media`, users, profiles and invitations in `shared/auth`.

### 6.2 Who may import whom

```
            shared
        ↗    ↑    ↖    ↖
  marketing  cms  site  portal
```

| Space | May import from | Never imports from |
|---|---|---|
| `shared` | itself | `marketing`, `cms`, `site`, `portal` |
| `marketing` | `shared` | `cms`, `site`, `portal` |
| `cms` | `shared` | `marketing`, `site`, `portal` |
| `site` | `shared` | `marketing`, `cms`, `portal` |
| `portal` | `shared` | `marketing`, `cms`, `site` |
| `routes` | all (routes assemble the screens) | — |

Design consequences:

- **CMS and public site do not know each other.** They talk through `shared/content`: the editor writes to that model (sections, SEO, published snapshot) and the site reads from it.
- **Marketing and portal do not know each other.** What both use (editorial statuses, the revision snapshot model, per-channel preview, calendar, comments) goes to `shared/editorial`, `shared/calendar` and `shared/preview`. The write side is kept apart: sending for approval is `lib/marketing/approvals`; the decision is `lib/portal/approvals`.
- The CMS reads brand data (for example authorized case studies) **only through server functions in its own layer**, never importing code from `marketing`.
- If two spaces need the same piece, it moves to `shared` with its own module. No copying and no exceptions.

### 6.3 Folder tree

```
compasso/
├─ AGENTS.md                      project rules (prevail over any document)
├─ docs/                          all names in English
│  ├─ modules/  spaces/  foundations/  standards/  audits/  history/
│  ├─ product-documentation-v0.1.md
│  └─ technical-architecture-v0.1.md
├─ eslint-local/                  local rules copied from Memoria Print
├─ eslint.config.js
├─ scripts/                       check-consistency.mjs, db-types.mjs, seed-owner.mjs
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  ├─ tests/                      pgTAP
│  └─ seed.sql                    development data (no real passwords)
├─ e2e/                           Playwright
├─ src/
│  ├─ routes/                     (see section 16)
│  ├─ components/
│  │  ├─ marketing/<module>/  cms/<module>/  site/<module>/  portal/<module>/
│  │  └─ shared/{ui,admin,media,calendar,editorial,preview,notifications,icons}/
│  ├─ lib/
│  │  ├─ marketing/<module>/  cms/<module>/  site/<module>/  portal/<module>/
│  │  └─ shared/{auth,supabase,storage,media,content,editorial,notifications,email}/
│  │     + loose files: server-utils.ts, query-keys.ts, stored-keys.ts, enums.ts,
│  │       format.ts, logger.ts, pagination.ts, utils.ts
│  ├─ hooks/
│  │  ├─ marketing/<module>/  cms/<module>/  portal/<module>/
│  │  └─ shared/                  use-list-state, use-form-submit, use-server-action, ...
│  ├─ assets/shared/
│  ├─ router.tsx  server.ts  start.ts  styles.css  routeTree.gen.ts
```

Modules inside each space:

| Space | Modules (same name in `components`, `lib` and `hooks`) |
|---|---|
| `marketing` | `clients`, `brands`, `channels`, `content` (items, variants, revisions, internal comments), `approvals` (request and follow-up), `calendar` (internal-side queries), `dashboard` |
| `cms` | `editor`, `pages`, `services`, `portfolio`, `testimonials`, `navigation`, `seo`, `publishing`, `settings`, `media` (site images) |
| `site` | `render` (single renderer of the published pages), `layout` (header and footer), `contact` (form), `public` (in `lib`: reading the published version) |
| `portal` | `brands`, `approvals` (read and decide), `calendar`, `comments` |
| `shared` | see table below |

| `shared` module | What it holds |
|---|---|
| `ui` | Base shadcn components |
| `admin` | Back office kit: `PageHeader`, `DataTable`, `PaginationBar`, `EmptyState`, `ConfirmDialog`, `Field`, `SectionCard`, `FieldGroup`, `Can`, `nav-config.ts`, sidebar and space selector |
| `auth` | Session, profiles, actions, configurable roles, users, invitations, guards |
| `media` | Media Library: components, server functions, upload hooks |
| `storage` | Interface and R2 implementation |
| `supabase` | Clients, generated types, `env.ts` |
| `calendar` | Calendar components and rules used by `marketing` and `portal` |
| `editorial` | Editorial and publication statuses, revision snapshot schema, allowed transitions |
| `preview` | Per-channel preview (aspect ratio, caption truncation, carousel) |
| `content` | **Contract between the CMS and the public site**: section model, component registry, rich text, published snapshot, address resolution, sitemap |
| `notifications` | Bell, items, preferences, kinds |
| `email` | Email adapter and templates |

### 6.4 Where to put a new file

1. What type is it? Component → `components/`. Server function, schema, types, business rule → `lib/`. Hook → `hooks/`. Image or static data → `assets/`.
2. Who uses it? Only one space → that space's folder. More than one → `shared`.
3. Which module is it part of? Look for the folder; if it does not exist, create it with the feature name (English, lowercase, hyphen).
4. Is it a route? In `src/routes`, inside the space's group.

Before creating a component, search the space and `shared`. A new component is only born when the pattern repeats in two places.

---

## 7. Authentication, identity and invitations

### 7.1 Principles

- A single set of identities (Supabase Auth). Internal and external differ by **profile** (set of actions) and by **brand links** (`brand_members.kind`).
- Public sign-up **disabled** (`enable_signup = false`). New accounts are born from invitations.
- Account statuses, as in Memoria Print: `pending`, `approved`, `rejected`, `suspended`. With an invitation the account is born `approved` with the invitation's profile; the other statuses cover later suspension and accounts created by other means.
- Only `approved` with a defined profile gives access to data. Status and profile only change through administration.
- After login, the redirect depends on the actions: whoever has back office actions goes to `/admin`; whoever has only portal actions goes to `/portal`.
- The first Owner is created by `scripts/seed-owner.mjs` (email and password from environment variables), never by a migration with a password. After the first login, create a second Owner so nobody is locked out.
- Password with at least 10 characters; enable Supabase leaked-password protection; mandatory email confirmation; own SMTP in production (the default Supabase email has low limits).

### 7.2 Invitation flow

Own `invitations` table, to grant access to specific brands, expire, revoke and control use.

1. Whoever has `invitations.create` provides: email, profile, brands and, if external, whether they can decide (`can_decide`).
2. The server generates a random 32-byte token (base64url), stores **only the SHA-256 hash**, sets `expires_at` (7 days) and sends the email with `/admin/invite/<token>`.
3. The recipient opens the page: the server validates hash, expiry and `pending` status, and shows the invited email.
4. They set the password. Acceptance requires the **authenticated email to equal the invited one**.
5. In a transaction (RPC `accept_invitation`): marks the invitation `accepted`, creates the `approved` profile with the invitation's profile, creates the `brand_members`, records audit.
6. Revoking the invitation makes it `revoked`. An accepted invitation is not reusable.

### 7.3 Session and guards

- `@supabase/ssr` with cookies; the server reads the user with JWT validation (`getUser`), not `getSession`, for authorization decisions.
- The protected layout `admin/_app.tsx` uses `beforeLoad` to decide the destination: no session → `/admin/login` keeping the requested route; `pending` → pending screen; `rejected`/`suspended` → access-denied screen; `approved` → enters, and each restricted page calls `requireAction(context, Action.X.Y)`.
- `use-session-watch`: if the session ends without the person asking, they go to the login with the current page as the return destination.
- Guards improve the experience; the real protection is in RLS and in the server functions.

### 7.4 Authentication screens (`routes/admin/(shared)/`)

`login`, `invite.$token`, `recover-password`, `reset-password`, `callback`, `confirm-email`, `pending`, `access-denied`, and, in the protected layout, `profile`, `users`, `roles`, `notifications`, `forbidden`. Confirmation and recovery links only work in the same browser where they were requested (PKCE flow); show this limitation on the screen.

---

## 8. Authorization: profiles, actions and brand link

### 8.1 Two axes

1. **Action** (`module.verb`): what the user's profile allows them to do. A fixed catalog coming from migrations; the interface only manages which profiles have which actions.
2. **Brand scope**: on which brands the user can act.

Golden rule: **effective right = profile action AND brand scope**. Example: editing a content item requires `has_action('content.update')` **and** `can_access_brand(brand_id)`.

| Who | Brand scope |
|---|---|
| Owner (`is_admin()`) | All |
| Internal profile (Manager, Collaborator, etc.) | Brands with an active `brand_members` row of `kind = 'internal'` |
| External profile | Brands with an active `brand_members` row of `kind = 'external'`; deciding also requires `can_decide = true` |

### 8.2 Action catalog (initial proposal)

Convention `module.verb`, in English. Writing requires reading. `admin_only` actions are exclusive to the Owner.

| Module | Actions |
|---|---|
| Clients | `clients.view`, `clients.create`, `clients.update`, `clients.delete` |
| Brands | `brands.view`, `brands.create`, `brands.update`, `brands.delete`, `brands.manage_members` |
| Channels | `channels.view`, `channels.create`, `channels.update`, `channels.delete` |
| Content | `content.view`, `content.create`, `content.update`, `content.delete`, `content.submit`, `content.cancel`, `content.reopen`, `content.publish_manual` |
| Approvals (internal) | `approvals.view` |
| Approvals (external) | `approvals.decide` (requires `portal.view`) |
| Comments | `comments.create_internal`, `comments.create_external` |
| Portal | `portal.view` |
| Calendar | `calendar.view`, `calendar.manage` |
| Media | `media.view`, `media.upload`, `media.update`, `media.delete`, `media.publish` |
| Site and CMS | `site.view`, `site.edit`, `site.settings`, `site.structure`, `site.publish` |
| Notifications | `notifications.configure` |
| Audit | `audit.view` |
| Invitations | `invitations.create` (requires `users.view`) |
| Users | `users.view`, `users.approve`, `users.manage` (`admin_only`) |
| Profiles | `roles.manage` (`admin_only`) |
| Settings | `settings.manage` (`admin_only`) |

Dependencies stored in the catalog (`requires`), for example: `content.update` → `content.view`; `content.submit` → `content.update`; `approvals.decide` → `portal.view`; `media.publish` → `media.update`.

Roles carry a `portal_only` flag and actions a `portal` flag: a `portal_only` role may only contain `portal` actions (`portal.view`, `approvals.decide`, `comments.create_external`), enforced by a trigger (details in [foundations/roles-and-actions.md](foundations/roles-and-actions.md)).

Starting profiles (seed migration, with `insert ... on conflict do nothing`):

| Profile | Type | Actions |
|---|---|---|
| `owner` ("Proprietário") | System, no rows in `role_actions` (implicit full access, including future actions) | All |
| `manager` ("Gestor") | Pre-created, editable | `clients.*`, `brands.view/update/manage_members`, `channels.*`, `content.*` (except `delete`), `approvals.view`, `comments.create_internal`, `calendar.*`, `media.view/upload/update`, `invitations.create` |
| `collaborator` ("Colaborador") | Pre-created, editable | `clients.view`, `brands.view`, `channels.view`, `content.view/create/update`, `approvals.view`, `comments.create_internal`, `calendar.view`, `media.view/upload` |
| `external_approver` ("Aprovador externo") | Pre-created, editable, portal actions only | `portal.view`, `approvals.decide`, `comments.create_external` |
| `external_commenter` ("Comentarista externo") | Pre-created, editable, portal actions only | `portal.view`, `comments.create_external` |

### 8.3 SQL authorization functions

The tables `roles`, `actions`, `role_actions` and the functions `is_admin()`, `has_action(p_action)` and `my_actions()` come from the Memoria Print authentication migration (`20261005000000_auth_profiles.sql`), adapted to Compasso. The two new functions implement the brand scope. All are `security definer` with a fixed `search_path`; revoke `execute` from `anon` on those that do not need it.

```sql
create function public.can_access_brand(p_brand uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1
    from public.brand_members bm
    join public.profiles p on p.id = bm.user_id
    where bm.brand_id = p_brand and bm.user_id = (select auth.uid())
      and bm.status = 'active' and p.status = 'approved'
  )
$$;

create function public.is_external_brand_member(p_brand uuid, p_must_decide boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.brand_members bm
    join public.profiles p on p.id = bm.user_id
    where bm.brand_id = p_brand and bm.user_id = (select auth.uid())
      and bm.kind = 'external' and bm.status = 'active' and p.status = 'approved'
      and (not p_must_decide or bm.can_decide)
  )
$$;
```

Use `(select auth.uid())` (evaluated once per query) and index `brand_members (user_id, brand_id) where status = 'active'`.

### 8.4 Policies by layer

**Internal users**: access to the tables through the Supabase client with the user's JWT; policies combine action and scope.

```sql
alter table public.content_items enable row level security;

create policy content_items_read on public.content_items for select
  using (public.has_action('content.view') and public.can_access_brand(brand_id));
create policy content_items_insert on public.content_items for insert
  with check (public.has_action('content.create') and public.can_access_brand(brand_id));
create policy content_items_update on public.content_items for update
  using (public.has_action('content.update') and public.can_access_brand(brand_id))
  with check (public.has_action('content.update') and public.can_access_brand(brand_id));
```

**External users (portal)**: **no `select` policy on internal tables**. Reads go through `security definer` functions that check `portal.view`, the external link and the shared status, and return only safe columns (never `internal_notes`, internal briefing or drafts):

`portal_list_brands()`, `portal_list_pending()`, `portal_get_approval(p_request)`, `portal_list_calendar(p_brand, p_from, p_to)`, `portal_list_comments(p_variant)`, `portal_add_comment(...)`, `portal_decide_approval(p_request, p_outcome, p_comment)`.

This solves the RLS limitation (per row, not per column): even with their JWT in a manual query, the external user cannot reach the internal columns.

**Anonymous (public site)**: no table grants access to `anon`. The site reads through `security definer` functions that return only the published revision (`site_published_page(p_slug)`, `site_published_settings()`), whose outputs are validated with zod when they reach the server.

### 8.5 Server-side verification

Each server function:

1. Validates the input with zod (`.validator(schema)`).
2. `requireActionServer(Action.Content.Update)` before touching the database; fails with `denied`.
3. Resolves the context (brand, organization) **from the database**, never from client IDs.
4. Runs with the user's Supabase client (RLS active). The service client is used only in: invitation acceptance, scheduled tasks, issuing file URLs after explicit verification, and audit.
5. Returns `Result<T>` with explicit DTOs (never full rows) to the portal.

Review rule: any import of the service client outside an allowed list fails lint (`*.server.ts` pattern).

### 8.6 Test matrix

Each "yes/no" cell of the product document's permission table becomes a pgTAP case (section 22). Acceptance criteria include: a user without the action is refused by the database even when calling the API directly; changing the profile or revoking the link takes effect immediately with the session open.

---

## 9. Data model

The **authoritative schema** (every table, column, constraint, index, trigger and the suggested migration order) is [reference/data-model.md](reference/data-model.md). This document only states the principles; do not duplicate DDL here (GOLD-2).

Principles:

- `uuid` primary keys, `timestamptz` instants (UTC) with an IANA zone where a local time matters, deadlines as `date`, statuses as `text` + `CHECK` with a matching TypeScript constant ([reference/enums.md](reference/enums.md)).
- `organization_id` only on top-level entities; everything below a brand carries `brand_id` and uses **composite foreign keys** so a row can never reference another brand's row.
- RLS on every table, no policy for `anon`, policies combine the role action and the brand link; **external roles have no policy on internal tables** and read only through `portal_*` functions ([reference/functions.md](reference/functions.md)).
- Immutability by trigger for revisions, revision media, approval decisions and audit events; optimistic locking by `version`; transitions only through the transactional functions.
- Statuses, error codes, actions, notification kinds and audit actions are registered in [reference/](reference/README.md) and verified by `npm run check:consistency`.

## 10. State machines and transactional rules

### 10.1 Editorial status of the variant

```
draft ─▶ in_production ─▶ internal_review ─▶ awaiting_approval ─▶ approved
  ▲            ▲                 │                    │
  └────────────┴──── changes_requested ◀──────────────┘
any status ─▶ cancelled
```

| From | To | Who (action) | Conditions |
|---|---|---|---|
| draft | in_production | `content.update` | — |
| in_production | internal_review | `content.update` | Internal review is optional; it can be skipped straight to awaiting_approval according to the organization's configuration |
| in_production / internal_review | awaiting_approval | `content.submit` | Creates a revision, sets the approver, requires at least one active channel |
| awaiting_approval | approved | designated approver (`approvals.decide` and `can_decide`) | The request's revision is the `current_revision_id` |
| awaiting_approval | changes_requested | designated approver | Comment required |
| changes_requested | in_production | `content.update` | — |
| approved | in_production | `content.reopen` | Audited, with reason; clears `approved_revision_id` and keeps the history |
| any | cancelled | `content.cancel` | Does not delete history |

Publication status evolves in parallel: `unplanned → planned → published_manually | cancelled`. `published_manually` only with a non-null `approved_revision_id`. The statuses and transitions live in `shared/editorial` (constants `EditorialStatus`, `PublicationStatus` and the transition map); `check:consistency` compares the constants with the `CHECK` lists.

### 10.2 Transactional SQL functions (RPC)

All `security definer`, with a fixed `search_path`, explicitly checking `has_action`, brand scope and status, and writing to `audit_events`.

| Function | What it does |
|---|---|
| `submit_for_approval(p_variant, p_approver, p_expected_version)` | Locks the variant (`for update`); validates the version; freezes `snapshot` and `content_revision_media`; marks the previous pending request `superseded`; creates `approval_requests`; changes the status; notifies |
| `portal_decide_approval(p_request, p_outcome, p_comment)` | See below |
| `reopen_variant(p_variant, p_reason)` | Reopens `approved` or `awaiting_approval`; supersedes pending requests |
| `reschedule_variant(p_variant, p_planned_at, p_tz, p_expected_version)` | If the status is `awaiting_approval` or `approved`, requires a new revision and returns the code `requires_new_revision` |
| `mark_published(p_variant, p_published_at, p_url, p_evidence_media)` | Only with `approved_revision_id`; does not call social networks |
| `accept_invitation(p_token_hash)` | See section 7.2 |
| `publish_site_page(p_page)` | Freezes `draft_content` into `site_page_revisions` and updates `published_revision_id` |

**`portal_decide_approval` (skeleton)**

```sql
create function public.portal_decide_approval(p_request uuid, p_outcome text, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.approval_requests; v public.content_variants;
begin
  select * into v from public.content_variants
   where id = (select variant_id from public.approval_requests where id = p_request)
   for update;

  select * into r from public.approval_requests where id = p_request;

  if not public.has_action('approvals.decide') then raise exception 'denied'; end if;
  if r.approver_user_id <> (select auth.uid()) then raise exception 'denied'; end if;
  if not public.is_external_brand_member(r.brand_id, true) then raise exception 'denied'; end if;
  if r.status <> 'pending' then raise exception 'request_not_pending'; end if;
  if v.current_revision_id <> r.revision_id then raise exception 'revision_superseded'; end if;
  if p_outcome = 'changes_requested' and length(btrim(coalesce(p_comment,''))) = 0
    then raise exception 'comment_required'; end if;

  insert into public.approval_decisions(request_id, revision_id, decided_by, outcome, comment)
  values (r.id, r.revision_id, (select auth.uid()), p_outcome, p_comment);

  update public.approval_requests set status = p_outcome, decided_at = now() where id = r.id;
  update public.content_variants
     set editorial_status = case p_outcome when 'approved' then 'approved' else 'changes_requested' end,
         approved_revision_id = case p_outcome when 'approved' then r.revision_id else null end,
         version = version + 1
   where id = v.id;

  insert into public.audit_events(organization_id, actor_id, action, entity_type, entity_id, brand_id)
  select b.organization_id, (select auth.uid()), 'approval.decided', 'approval_request', r.id, r.brand_id
    from public.brands b where b.id = r.brand_id;
end $$;
```

**Concurrency**: `for update` on the variant serializes "approve" and "submit a new revision". The second operation sees the already changed status and is refused (`revision_superseded`). The partial index `approval_one_pending_per_variant` is the safety net.

**Error codes**: the functions use `raise exception 'code'` in lowercase with underscores; `errors.ts` translates each code into the pt-BR UI message; `check:consistency` guarantees SQL and TypeScript talk about the same codes.

**Optimistic locking**: draft edits send `version`; `update ... where id = $1 and version = $2` with no affected row is a conflict (`conflict`), and the interface asks to reload.

### 10.3 Notifications

Created in the same transaction as the functions above through `notify_users(...)`, with `dedupe_key`. The complete catalog of kinds, recipients, texts and rules is in [foundations/notifications.md](foundations/notifications.md); the summary below lists the core approval kinds (titles and bodies are pt-BR UI copy):

| Kind | When | Who receives (action) |
|---|---|---|
| `approval.requested` | Request sent | Designated approver (`approvals.decide`) |
| `approval.decided` | Approved or changes requested | Whoever sent it (`approvals.view`) |
| `approval.overdue` | Pending request beyond the approval deadline | Whoever sent it (scheduled, `pg_cron`) |
| `content.due_soon` | Production deadline approaching | Owner (`content.view`, scheduled) |
| `variant.publish_due` | Planned date passed without a recorded publication | Owner (scheduled) |
| `invitation.accepted` | Invitation accepted | Whoever invited (`users.view`) |

An email failure never undoes the request; the alert remains in the portal and in the bell.

---

## 11. Media Library (Cloudflare R2)

### 11.1 Buckets and access

| Bucket | Content | Access |
|---|---|---|
| `R2_BUCKET` (private) | Originals, reduced copies and PDFs | Only through the S3 API with server credentials; read through a short signed URL |
| `R2_PUBLIC_BUCKET` | Derivatives explicitly published for the site | Own media domain (`SITE_MEDIA_BASE_URL`) with Cloudflare cache. **Never** attach a public domain or `r2.dev` to the private bucket |

S3 API token restricted to the two buckets and to "Object Read & Write". CORS on the private bucket: production origins, preview and `localhost` (exact dev port); methods `GET`, `PUT`, `HEAD`; `AllowedHeaders: Content-Type`; `ExposeHeaders: ETag, Content-Length`.

### 11.2 Storage interface

Same approach as Memoria Print: `lib/shared/storage/types.ts` defines `ServerStorage` and `BrowserStorage`; `r2-storage.ts` implements them with `aws4fetch` (SigV4); `server.ts` is the only place that chooses the implementation. Operations: `createUploadTarget`, `upload` (in the browser), `signUrls`, `stat` (`HEAD`), `readRange`, `download`, `remove`. Pages and components do not know the provider.

### 11.3 Keys

Opaque and generated on the server: `<uuid>`, `<uuid>-thumb`, `<uuid>-display`, with no client names or original file names (stored only in the database). The key is not access control.

### 11.4 Upload flow

```
Browser                  Server function                  R2                 Supabase
 │ requestUpload(meta) ─▶ validates session, action media.upload,
 │                        limits, type; creates pending record ───────────────▶ │
 │                        createUploadTarget → PUT URL (~10 min)
 │ ◀── {versionId, targets}
 │ PUT original ───────────────────────────────────────────▶ │
 │ generates reduced copies in the browser and sends them (thumb, display) ─▶ │
 │ confirmUpload(versionId) ▶ stat (HEAD) before reading; refuses if size ≠ declared
 │                        readRange (magic bytes; PDF: start and end)
 │                        measures the copies (2 MiB cap, images only)
 │                        marks available / failed ───────────────────────────▶ │
```

- Configurable initial limits: image up to 25 MiB, video up to 100 MiB in the MVP, PDF up to 50 MiB. Formats: JPEG, PNG, WebP, MP4, PDF.
- A presigned `PUT` does not limit size: all compensation is done on the server (measure before reading, refuse without downloading in full, delete the object if validation fails).
- Video: generate the cover image in the browser (canvas) and send it as the display copy. No FFmpeg on Vercel. Multipart upload for larger videos is for phase 2.
- Never-confirmed sessions and objects: daily cleanup by Vercel Cron (server route protected by `CRON_SECRET`) that deletes `pending` or `failed` records older than 24 hours and their objects; it also reconciles objects with no record using a 48-hour margin.

### 11.5 Reading

- The server function `signMediaUrls` checks the permission **at that moment**: internal with `media.view` and `can_access_brand` (or `site.view` for site media); external with `portal.view`, the link and a shared revision that references that version. Only then does it sign.
- Asking for an arbitrary key by ID returns nothing without permission. Short TTL (internal 5 minutes; external 2 minutes).
- Lists and grids request URLs in batches (up to about 50) and keep them on the client until they expire.
- Public derivatives: the "Publish to the site" action (`media.publish`) copies the display copy to the public bucket and records `public_published_at`. The CMS only references published versions. "Withdraw" deletes from the public bucket and invalidates the Cloudflare cache.

### 11.6 Versions, usages and deletion

- Replacing a file creates a new `media_versions` row and updates `current_version_id`. Revisions already created keep pointing to the old version.
- `media_usages` is filled by the server when creating revisions and publishing pages; the "Where it is used" view reads from it.
- Delete: trash (`trashed_at`, 30-day retention, configurable). Permanent deletion only occurs with no usages; the `restrict` FK guarantees it. Historical approvals and evidence are not deletable through this path.

---

## 12. Public site and CMS

### 12.1 Rendering

- Site routes in the `(site)` group, with a catch-all route (`$.tsx`) that resolves the address against the published pages, as in Memoria Print (`$.tsx`, `robots[.]txt.ts`, `sitemap[.]xml.ts`).
- The server reads through `site_published_page(p_slug)` and validates the output with zod (`parseOutput`) before rendering. Unknown slug: 404 inside the layout.
- Cache: TanStack Start has no per-tag ISR. Respond with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for the Vercel CDN and, when publishing, evaluate invalidation through the Vercel purge API; without it, the short TTL limits the delay to about one minute. **Point to validate in phase 5.**
- Preview: an authenticated route that renders the **draft** (`site_draft_snapshot`) with the same section components; never exposed publicly.
- `shared/content` is the contract: section model, component registry (`schema`, editor, renderer), rich text (Tiptap JSON), published snapshot, sitemap.

### 12.2 Section model

Predefined sections, validated by zod (discriminated union) and stored in `jsonb`. The **registry is the source of the types** (`ComponentContent<"hero">` inferred from the schema), with no `Record<string, unknown>` or `as unknown as`:

```ts
const Section = z.discriminatedUnion("component", [
  z.object({ component: z.literal(SectionKind.Hero), content: HeroContent }),
  z.object({ component: z.literal(SectionKind.ServicesGrid), content: ServicesGridContent }),
  z.object({ component: z.literal(SectionKind.PortfolioGrid), content: PortfolioGridContent }),
  z.object({ component: z.literal(SectionKind.Testimonials), content: TestimonialsContent }),
  z.object({ component: z.literal(SectionKind.RichText), content: RichTextContent }),
  z.object({ component: z.literal(SectionKind.ContactForm), content: ContactFormContent }),
]);
```

`SectionKind` is an `as const` object (no loose text). Unknown section: the block is omitted. Adding a new section = one registry entry + two components + no migration.

### 12.3 SEO

Title, description, social image (public copy), `canonical` and `robots` (noindex on unpublished pages) per page; `sitemap.xml` and `robots.txt` generated from the published pages; JSON-LD (`Organization`, `Service`). Unique slugs per site; 301 redirects when a slug changes are for phase 2.

### 12.4 Contact form

Public server function: zod, honeypot field, Turnstile, per-IP limit, saving to its own table and a notice to the team (internal notification and, when email exists, a message). No sensitive data in the logs.

### 12.5 Portfolio with client work

Requires the explicit "Authorize public use" action per case study, with a date and a note of the client's consent; only files with a published public copy can enter.

### 12.6 No content in the code

Lint rule (`noSiteContentInCode`): the site does not import from `@/assets/site/**`, `@/data/site/**` or text dictionaries. Images, texts and case studies come from the CMS.

---

## 13. Editorial calendar and time zones

### 13.1 Rules

- **Instants** (`planned_at`) in `timestamptz` (UTC) plus `planned_timezone` (IANA) stored with the item; the **brand's** time zone is the default, and the organization's is the brand's default.
- **Deadlines** (`production_due_date`, `approval_due_date`) are local `date` values of the brand, with no time.
- The interface always shows the time zone (for example "10:00 · America/Sao_Paulo"). When editing, the user picks date and time **in the brand's time zone**; conversion happens on the server before saving. Displayed dates and times go through `format.ts`.
- Mandatory test cases: daylight-saving change (for example Europe/Lisbon in March and October), non-existent hour and ambiguous hour, plus a zone without daylight saving (America/Sao_Paulo).

### 13.2 Query

RPC `list_calendar_entries(p_from, p_to, p_brands, p_channels, p_assignee, p_editorial, p_publication)`: range limited to 100 days, paginated, index `(brand_id, planned_at)`; filters by `calendar.view` and `can_access_brand`. On the portal side, `portal_list_calendar` returns only **sent or shared** variants, without internal fields.

### 13.3 Interface

- Components in `shared/calendar`, used by `marketing` and `portal`. Month, week and list views; color per editorial status (single `statusStyles` map, with icon and text beyond color); channel icon; deadlines as all-day items, distinct from publication.
- Side list "No date" with drag onto the calendar.
- Dragging opens a confirmation; if the status is `awaiting_approval` or `approved`, the dialog warns that a new revision will be created and calls `reschedule_variant`.
- Filters in the URL search params (shareable links and position preserved when returning from a detail).
- Accessible list alternative for keyboard navigation.

---

## 14. Client Portal

- `portal` space with its own layout (`routes/portal/_app.tsx`), designed mobile-first, without the back office structure.
- Routes: `/portal` (brand selection), `/portal/brands/$brandId` (pending items and calendar), `/portal/brands/$brandId/approvals/$requestId`.
- All data comes from the `portal_*` functions. No portal component imports reading code from `marketing` (lint prevents it).
- Approval screen: per-channel preview (`shared/preview`), navigable carousel, caption, date and time zone, files through short signed URLs, decision history and external comments, "Approve" ("Aprovar") and "Request changes" ("Pedir alterações") buttons (comment required; button in loading state and no double submit; confirmation before deciding).
- States: superseded request → notice "This version was updated" ("Esta versão foi atualizada") with a link to the new one; no pending item → explanatory empty state; no permission → `forbidden` inside the layout.
- Switching between brands in the header, only the authorized ones.
- Accessibility: managed focus in dialogs, high contrast per the palette, 44 px touch targets.

---

## 15. Application layer (code patterns)

### 15.1 Server functions

`*.functions.ts` files per module in `lib/<space>/<module>/`. Pattern (TanStack Start API names to confirm in the installed version):

```ts
export const submitForApproval = createServerFn({ method: "POST" })
  .validator(submitForApprovalSchema)
  .handler(async ({ data }): Promise<Result<{ requestId: string }>> => {
    await requireActionServer(Action.Content.Submit);
    const supabase = await serverClient();
    const { data: row, error } = await supabase.rpc("submit_for_approval", {
      p_variant: data.variantId,
      p_approver: data.approverId,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(requestIdSchema, row);
  });
```

Rules: input always validated; permission before touching the database; `jsonb` output always validated; an error becomes `fail()` with `code`, a pt-BR `message` and `fields` when there are per-field errors; technical details only in `logError`.

### 15.2 Result and errors

```ts
type ErrorCode = "denied" | "not_found" | "conflict" | "in_use" | "invalid" | "unavailable" | "unknown";
type Failure = { ok: false; code: ErrorCode; message: string; fields?: Record<string, string> };
type Result<T> = ({ ok: true } & T) | Failure;
```

`Result`, `fail` and `parseOutput` live only in `lib/shared/server-utils.ts` (no copies in the modules). The mapping from database codes to `ErrorCode` and to the pt-BR message is in `lib/shared/auth/errors.ts`.

### 15.3 Constants (no loose text)

| What | Where | Example |
|---|---|---|
| Permissions | `lib/shared/auth/actions.ts` | `Action.Content.Update` → `"content.update"` |
| Cache keys | `lib/shared/query-keys.ts` (and per module) | `QueryKey.Content.list(filters)` |
| Statuses and unions | `lib/shared/enums.ts` and `lib/shared/editorial` | `EditorialStatus`, `PublicationStatus`, `Platform`, `SectionKind` |
| Browser storage | `lib/shared/stored-keys.ts` | `StoredKey.CalendarView` with `readStored`/`writeStored` |
| Notification kinds | `lib/shared/notifications/types.ts` | `NotificationKind.ApprovalRequested` |
| zod enum schemas | `z.nativeEnum(EditorialStatus)` | never `z.enum([...])` |

Constant pattern: `const X = {...} as const` and `type X = ValueOf<typeof X>`.

### 15.4 Reads and lists

Lists: `useQuery` with search, filters and page in the key; `keepPreviousData`; search with `useDebouncedValue` (300 ms); `PaginationBar` and `Page<T>`; search, filters and total come from the server. States: skeleton → error with "Try again" ("Tentar novamente") → empty → no results (with "Clear search", "Limpar busca") → list.

### 15.5 Forms

zod on the client (same schema as the server) and again on the server; required fields marked; error next to the field; focus on the first invalid one; button in loading state and no double submit; data preserved on failure; success only after confirmation, with a toast; `useUnsavedChanges` when there are unsaved changes.

### 15.6 Database types

`npm run db:types` generates `src/lib/shared/supabase/database.types.ts` (with the Memoria Print script's adjustments for nullable arguments) and the three clients (server, anonymous, browser) receive the `Database` generic. CI fails if the generated file diverges from the committed one.

### 15.7 Layers

In new features: queries and mutations in module hooks (`hooks/<space>/<module>`), and presentation components receiving data and callbacks. Avoid components that import server functions directly.

---

## 16. Routes, guards and navigation

> The complete URL list with the required action per route is [reference/routes.md](reference/routes.md) (authoritative). The tree and rules below explain the structure.

Routes in `src/routes`, organized by **route groups** (folders in parentheses, which do not change the URL). Folders with `_` are layouts with no URL. The route file only assembles the screen.

```
src/routes/
  __root.tsx
  (site)/                       public site
    $.tsx                       any CMS address
    robots[.]txt.ts  sitemap[.]xml.ts
  admin/
    (shared)/                   login, invite.$token, recover-password, reset-password,
                                callback, confirm-email, pending, access-denied
    _app.tsx                    back office layout (sidebar, header, guard)
    _app/
      (shared)/                 index (home), profile, notifications, users, roles,
                                forbidden, library/, settings/
      (marketing)/              marketing/ (overview), marketing/clients/..., marketing/brands/...,
                                marketing/calendar
      (cms)/                    site/ (pages, services, portfolio, testimonials, navigation, SEO,
                                publishing, preview)
  portal/
    _app.tsx                    portal layout (portal.view guard)
    _app/
      index.tsx                 brands/$brandId, brands/$brandId/approvals/$requestId
  api/                          server routes: cron and downloads
```

| URL | Surface | Required action |
|---|---|---|
| `/` and other CMS addresses | Site | — |
| `/admin/login`, `/admin/invite/$token`, password recovery | Authentication | — |
| `/admin` | Back office home | Approved account |
| `/admin/marketing/...` | Marketing Management | `clients.view`, `brands.view`, `content.view`, `calendar.view` depending on the screen |
| `/admin/site/...` | Site and CMS | `site.view` and other `site.*` |
| `/admin/library` | Library | `media.view` |
| `/admin/settings/...` | Team, profiles, invitations, organization | `users.view`, `roles.manage`, `invitations.create`, `settings.manage` |
| `/portal/...` | Portal | `portal.view` |

- Each protected route uses `beforeLoad: ({ context }) => requireAction(context, Action.X.Y)`; the interface hides, the server and RLS refuse.
- Whoever has only portal actions is redirected from `/admin` to `/portal`; whoever lacks `portal.view` does not enter the portal.
- Menu configured only in `components/shared/admin/nav-config.ts`: each item has `to` (checked by TypeScript against the routes) and `action`; without the action the item does not appear, and a group with no visible items disappears.
- The space selector (Site and CMS / Marketing Management) and the selected brand live **in the URL** (`/admin/marketing/brands/$brandId/...`), never in global state.
- Non-existent pages, errors and missing permission appear inside the layout, with a way to continue.
- Filters and page in the URL search params.

---

## 17. Frontend: interface kit, design system and standards

### 17.1 Starting point (the "template")

Instead of an external template, the starting point is the **Memoria Print skeleton**, copied into the Compasso repository in phase 0:

| Copy and adapt | Note |
|---|---|
| `package.json`, `tsconfig.json`, `.prettierrc`, `eslint.config.js`, `eslint-local/`, `.husky/`, `components.json`, `bunfig.toml` (discard) | Remove the Lovable integration; reset the legacy exception lists; replace the `boundary` blocks with Compasso's spaces |
| `src/start.ts`, `server.ts`, `router.tsx`, `lib/shared/logger.ts`, `server-utils.ts`, `query-keys.ts`, `stored.ts`, `format.ts` | Adjust default time zone and currency |
| `components/shared/ui`, `components/shared/admin` | Complete back office kit |
| `lib/shared/auth`, `hooks/shared` | Profiles, actions, guards, session; remove `username` |
| `lib/shared/storage` (R2) and `lib/shared/media` | Media library; adapt scopes (site and brand) |
| `lib/shared/notifications` and `components/shared/notifications` | New kind catalog |
| `scripts/check-consistency.mjs`, `scripts/db-types.mjs` | Replace the checked tables and constants |
| Documentation of the standards, foundations and spaces | Already adapted to Compasso and written in English under `docs/` (see the document map in section 2.6); nothing else to copy |

**Do not copy**: Memoria Print's ERP, POS, CMS and site-specific modules, colors, fonts, logo and brand texts.

The Memoria Print CMS (pages, publishing, published snapshot) is a good reference for `cms` and `shared/content`; reuse what fits and simplify for Compasso's sections.

### 17.2 Design system

- Tokens (colors, typography, radii, shadows) in `src/styles.css`, as defined in [standards/color-palette.md](standards/color-palette.md) (palette based on the site reference image: peach, pink, lilac, violet, coral and navy, tuned for high contrast, AAA for body text). No pure black or white and no pure greys; the gradient is only a decorative token of the public site. The color lint applies from the first component.
- Typography through `<link>` in `__root.tsx`; never a remote `@import` in the CSS.
- State is never color alone: icon or text beyond color. A single `statusStyles` map for editorial and publication statuses, used in list, board, calendar and portal.
- Base components from `shared/ui`; `SectionCard` for section cards, `FieldGroup` for groups of fields, `IconButton` with an accessible name, `ConfirmDialog` for destructive actions.
- Dialog, list and form patterns as in [standards/admin-layout-and-standards.md](standards/admin-layout-and-standards.md); tokens, states and the component kit in [standards/design-system.md](standards/design-system.md).
- UI texts in Brazilian Portuguese, clear and direct tone.

### 17.3 New Compasso components (in `shared`)

`BrandSwitcher`, `ChannelIcon`, `StatusBadge` (editorial and publication), `DateTimeField` with time zone, `MediaPicker`, `RichTextEditor`, `ChannelPreview` (`shared/preview`), `CalendarView` (`shared/calendar`), `ApprovalTimeline`.

### 17.4 Accessibility and responsiveness

Sidebar becomes a drawer on mobile; no horizontal scrolling; "Skip to content"; visible focus; `aria-current`, `aria-invalid`, `aria-describedby`; keyboard navigation, including the calendar (list alternative); `axe` verification in the main flows; contrast thresholds from the palette document.

---

## 18. Deploying on Vercel

### 18.1 Configuration

- Vercel project linked to Git; production branch `main`; preview per pull request.
- Build: `vite build` with Nitro configured for the Vercel preset. Confirm the preset name and variables in the TanStack Start and Nitro docs for the installed version, and test deployment with an example page in phase 0.
- The server entrypoint `src/server.ts` (error wrapper) follows the Memoria Print pattern.
- **Function region** close to Supabase (for example Supabase project in `sa-east-1` and functions in `gru1`, or the equivalent European pair): latency between app and database dominates dynamic pages.
- Function duration: short by default; longer only on cron routes. Check the plan limits.
- The function request body is limited (about 4.5 MB): that is why no file passes through the server.

### 18.2 Headers and cron

Security headers applied on the server (middleware or Nitro config) and, on Vercel, through `vercel.json` when applicable:

```json
{
  "crons": [
    { "path": "/api/cron/media-cleanup", "schedule": "0 3 * * *" },
    { "path": "/api/cron/email-outbox", "schedule": "0 8 * * *" }
  ],
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
    ]}
  ]
}
```

Cron frequency and count depend on the plan; if every 10 minutes is not possible, process the email queue right after the event and leave the daily cron as a safety net. Cron routes require `Authorization: Bearer ${CRON_SECRET}`.

Scheduled notifications run in the database through `pg_cron` (extension enabled **before** applying the notifications migration), with `notify_scan_<module>()` functions discovered by the daily routine, as in Memoria Print.

### 18.3 Domains

- Apex and `www` for the site; the same application serves `/admin` and `/portal` (one domain simplifies cookies and CORS).
- Media domain (`SITE_MEDIA_BASE_URL`) pointing to the public R2 bucket, with DNS on Cloudflare.
- SPF, DKIM and DMARC records of the email provider on a sending subdomain.
- Session cookies with `Secure`, `HttpOnly`, `SameSite=Lax`.
- Configure in Supabase (Authentication → URL Configuration): Site URL and the redirect URLs of `/admin/callback` for production and preview.

### 18.4 Environments

| Environment | App | Supabase | R2 |
|---|---|---|---|
| Local | `vite dev` | `supabase start` (Docker) | Development bucket |
| Preview | Deployment per pull request | **Staging** project | Staging buckets |
| Production | `main` | **Production** project | Production buckets |

Variables per environment in the Vercel panel; production secrets never visible in previews; Deployment Protection active on previews.

### 18.5 Migration pipeline

1. The pull request changes `supabase/migrations/*`.
2. CI: starts local Supabase, applies the migrations from scratch, runs `supabase test db` (pgTAP), `supabase db lint`, regenerates the types and checks the diff.
3. Merge to `main`: a job applies the migrations to production (`supabase db push`) **before** the deployment.
4. Expand-and-contract migrations (add → migrate the code → remove), because during deployment old and new application versions coexist.

---

## 19. Environments, configuration and secrets

Variables (names aligned with Memoria Print):

| Variable | Where | Description |
|---|---|---|
| `SITE_URL` | Server | Public origin used in e-mail links (invitations, password reset); when empty the request origin is used, so set it in production to avoid Host-header poisoning |
| `VITE_SUPABASE_URL` | Client and server | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client and server | Public key; safe because RLS is on |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Invitation acceptance, tasks, audit; never with the `VITE_` prefix |
| `R2_ACCOUNT_ID`, `R2_ENDPOINT` | Server only | R2 account and S3 endpoint |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Server only | Token restricted to the two buckets |
| `R2_BUCKET`, `R2_PUBLIC_BUCKET` | Server only | Private and public |
| `SITE_MEDIA_BASE_URL` | Server (and public read) | Public bucket domain |
| `RESEND_API_KEY`, `EMAIL_FROM` | Server only | Transactional email |
| `VITE_TURNSTILE_SITE_KEY` (public), `TURNSTILE_SECRET` (server) | Mixed | Contact form |
| `CRON_SECRET` | Server only | Cron authentication |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | Only at seed time | First Owner; never versioned |

Rules: `.env.local` outside git (`*.local` in `.gitignore`); `.env.example` versioned with no values; GitHub secret scanning enabled; document key rotation (create new → update Vercel → redeploy → revoke the old one); validate variables at startup in a single `env.ts` per service.

---

## 20. Security

| Topic | Measure |
|---|---|
| Isolation between brands | RLS with action + scope, `portal_*` functions, composite FKs, pgTAP tests with users of different brands and swapped IDs |
| IDOR | Never trust client IDs to determine context; every read goes through RLS or a function that checks the link |
| Private columns | The external user has no access to base tables (ADR-07) |
| Permissions | Four layers: menu, route, server, RLS; immediate effect when profile or link changes |
| Privilege escalation | `admin_only` actions; nobody changes their own profile; whoever is not an Owner does not assign the Owner profile; last Owner protected |
| XSS | No `dangerouslySetInnerHTML`; rich text stored as JSON and rendered by an own component; restrictive CSP |
| CSRF | `createCsrfMiddleware` in `start.ts` for server functions; mutating server routes require a valid origin |
| CSP | `default-src 'self'`; `img-src` with the media domain and the signed URL host; `connect-src` with Supabase and R2; `frame-ancestors 'none'` |
| Uploads | Allowlist of types, check by leading bytes, size limits, `stat` before reading, opaque keys, original name only in the database, `Content-Disposition: attachment` on downloads |
| Private files | Bucket without public access; short signed URL; issuance always after checking permission |
| Already issued URLs | Risk accepted until they expire (documented); short TTL, especially for externals |
| Invitations | 256-bit token, only the hash in the database, expiry, single use, email equal to the invited one |
| Brute force and abuse | Supabase Auth limits; limit on public routes (contact) with Turnstile; generic login messages |
| Passwords | Minimum 10 characters, leaked-password protection, email confirmation; MFA (TOTP) for Owners in phase 6 |
| Secrets | Outside the repository; R2 token with minimum scope; `service_role` only in allowed modules |
| Logs | `logError` without sensitive data; identify requests for investigation |
| Audit | `audit_events`, `profile_audit`, `role_audit`; writes only by functions; restricted reading |
| Personal data (LGPD) | Processing register, legal basis, retention, export and deletion on request; data processing agreements with Supabase, Vercel, Cloudflare and the email provider; collect only what is necessary |
| Backups | Supabase point-in-time recovery (paid plan) or daily dumps to a separate R2 bucket; quarterly **restore test**; own policy for the R2 objects (replica or lock as needed) |

---

## 21. Observability, audit and notifications

- **Logs**: `logError` as the single output point (no `console`); structured, with request identifier, user and brand, with no PII in free text. The `errorMiddleware` in `start.ts` records and returns the error page. Plug an error service into `logError` when budget exists.
- **Business metrics to watch**: failed uploads, approval requests pending for more than N days, emails in failure, old pending `media_versions`, `portal_decide_approval` errors by code.
- **Minimum audit**: administrative login, invitation created/revoked/accepted, profile and link changes, submission, decision, reopening, date change of an approved item, manual publication, page publish and unpublish, publish/withdraw public copy, permanent file deletion.
- **Notifications**: Memoria Print infrastructure (bell with counter, panel, page, preferences, real time with Supabase Realtime and a periodic fallback poll, 90-day cleanup); kinds from section 10.3.
- **Short runbooks** in `docs/foundations/`: key rotation, database restore, cleanup of R2 orphans, revoking a compromised user (suspend, revoke sessions and invitations).

---

## 22. Tests, quality and automation

| Level | What | Tool |
|---|---|---|
| SQL and RLS | For each profile (Owner, Manager, Collaborator, external approver of brand A, of brand B, commenter, `anon`): read and write each table and call each function; crossed IDs; composite FKs; immediate effect of revocation | pgTAP |
| Critical functions | `submit_for_approval`, `portal_decide_approval` (including concurrency between two sessions), `reopen_variant`, `reschedule_variant`, `mark_published`, `accept_invitation`, `publish_site_page` | pgTAP and integration |
| Consistency | Actions, error codes, notification kinds and `CHECK` lists equal between SQL and TypeScript | `check:consistency` |
| Unit | zod schemas, transition map, time zone utilities (daylight saving), error mapping | Vitest |
| Integration | Upload flow (`requestUpload`, `confirmUpload`) with simulated R2 or a test bucket: divergent size, fake type, oversized copy | Vitest |
| E2E | (1) invitation → external login → approve; (2) content with two variants → send → request changes → new revision → approve; (3) upload → use in the revision; (4) CMS: draft → publish → public site; (5) external user of brand A cannot access brand B by changing the URL | Playwright |
| Accessibility | `axe` in the main flows | `@axe-core/playwright` |
| Performance | Lighthouse on the public site (LCP target below 2.5 s) | Lighthouse CI |

**Automation**

- `pre-commit`: `lint-staged` (Prettier). `pre-push`: `npm run lint`, `npm run typecheck`, `npm run check:consistency`.
- CI (GitHub Actions): lint with `--max-warnings 0`, `tsc --noEmit`, Vitest, pgTAP, `supabase db lint`, type regeneration with diff check, build, and E2E on staging.
- The **acceptance criteria of section 16 of the product document** are mapped one by one to tests, in a traceability table in `docs/standards/test-traceability.md`. CI blocks the merge if any fails.

---

## 23. Implementation plan by phase

> The task-level backlog (IDs, dependencies, documents to read, acceptance checks and status) is [implementation-plan.md](implementation-plan.md); this section keeps the phase summary and estimates.

Rough estimates for one or two people; review after phase 0.

### Phase 0 — Foundations (about 1 week)
- Repository with the Memoria Print skeleton (section 17.1), no Lovable and no legacy exceptions; Compasso `AGENTS.md`.
- Supabase projects (staging and production), Vercel project, R2 buckets, domain; deploy an example page to validate Nitro and Vercel.
- Initial migrations: authentication, profiles, actions, starting profiles, audit; Owner seed script.
- Login, invitation (skeleton), protected layout, `requireAction`; first pgTAP test; CI and husky.
- Compasso palette and tokens in `styles.css` ([standards/color-palette.md](standards/color-palette.md)).
- Review the documents under `docs/standards`, `docs/foundations` and `docs/spaces` against the real code as it is written (they are the specification; update their "Implementation status" with each delivery).

### Phase 1 — Access and commercial structure (about 1.5 weeks)
- Invitations (internal and external), acceptance, email.
- Clients, contacts, brands, channels, links; registration and archiving screens.
- `can_access_brand`, permission test matrix (brand A and B).
- Users and profiles screens.

### Phase 2 — Media Library (about 1.5 weeks)
- R2 storage, `requestUpload` and `confirmUpload`, reduced copies, signed URLs.
- Grid and list, filters, collections, trash, "where it is used" (skeleton).
- Cleanup cron; CORS and limit tests.

### Phase 3 — Content and approval (about 3 weeks), the core of the product
- Items and variants, variant editor with `MediaPicker`, list and board by status.
- Immutable revisions, `submit_for_approval`, internal comments.
- Portal: pending items, approval screen, `portal_decide_approval`, external comments, history.
- Internal notifications and email; reopening; manual publishing.
- Concurrency tests and related acceptance criteria.

### Phase 4 — Calendar (about 1.5 weeks)
- Spike FullCalendar versus porting the Memoria Print calendar; decide.
- `list_calendar_entries`, views, filters, items with no date, drag with the new-revision rule, time zones tested; portal calendar.

### Phase 5 — Public site and CMS (about 2 weeks)
- Section registry, editors, pages, SEO, preview, publishing, `site_published_*` functions, public copies.
- Cache and invalidation strategy validated; contact form with Turnstile and limit.

### Phase 6 — Hardening and launch (about 1 week)
- CSP and headers, security review, Owner MFA, backups with restore test, runbooks, monitoring, Lighthouse and axe, real data.

**Milestones**: M1 = end of phase 1 (team signs in and registers clients); M2 = end of phase 3 (a client approves content in the portal); M3 = end of phase 5 (site published); M4 = phase 6.

### Post-MVP
Automatic publishing (official APIs, persistent queue, idempotency), multiple approvers, multipart upload and video, slug redirects, blog, reports, dark mode, MFA for externals, multi-organization.

---

## 24. Risks and open points

| Risk or decision | Impact | Mitigation |
|---|---|---|
| Nitro and the Vercel preset with TanStack Start (beta versions) | Build or runtime in production | Validate in phase 0 with an example deploy; pin versions as in Memoria Print |
| Site cache without per-tag ISR | Delay between publishing and seeing it | Short TTL and evaluate API purge in phase 5 |
| Complexity of RLS policies combining action and brand | Access bugs | Single central functions; mandatory pgTAP tests; externals only through `portal_*` |
| Vercel plan function and cron limits | Crons and long routes | Check the plan; immediate processing as an alternative |
| Large videos | Time and memory | Limit in the MVP; multipart upload in phase 2 |
| "Approved" is not "published" | Client expectation | Communicate "manual publishing" in the interface; own phase for automation |
| LGPD and retention | Compliance | Define retention, agreements and deletion before launch |
| Time zone and daylight saving | Wrong dates | Mandatory tests (section 13) |
| Dependency on the Memoria Print skeleton | Future divergence between the two projects | Copy once, with no link; record the origin in `docs/history/` |
| Palette defined from an image (estimated hex) | Small differences from the real brand | Check against the original brand material before phase 1 (`standards/color-palette.md`) |

**Product decisions that affect implementation** (section 18 of the product document)

1. Is internal review mandatory? Defines whether `internal_review` is a mandatory step. Proposal: optional, by organization setting.
2. Does the client upload files? If so, new action `media.upload_external`, brand scope, review status and never public (about one more week).
3. Blog? Already provided in the model (`blog_post`).
4. File volume and size: sizes costs and the multipart-upload decision.
5. Email provider: Resend proposed; replace only the adapter.
6. Trash and audit retention: proposal 30 days and 2 years.
7. Default organization time zone: proposal `America/Sao_Paulo`, configurable.

---

## 25. Appendices

### Appendix A — Startup checklist

- [ ] Copy the Memoria Print skeleton and remove Lovable, ERP, POS and brand
- [ ] Reset the ESLint exception lists and adjust the boundary blocks (`marketing`, `cms`, `site`, `portal`, `shared`)
- [ ] Write Compasso's `AGENTS.md`
- [ ] Create Supabase staging and production projects; disable public sign-up; enable email confirmation, minimum password of 10 and leaked-password protection
- [ ] Enable `pg_cron` and Realtime; confirm that `notifications` is in the `supabase_realtime` publication
- [ ] Create the R2 buckets (private and public), restricted token, CORS, media domain
- [ ] Create the Vercel project, set region and per-environment variables, `CRON_SECRET`; test the example deploy
- [ ] Configure transactional email (SPF, DKIM, DMARC) and Supabase Auth SMTP
- [ ] Configure Turnstile
- [ ] Migrations 0001 onward; `npm run db:types`
- [ ] CI and husky (`pre-commit` and `pre-push`)
- [ ] Create the Owner with `scripts/seed-owner.mjs`; create a second Owner
- [ ] Enable Deployment Protection on previews
- [ ] Apply the palette tokens from `standards/color-palette.md`
- [ ] Read `docs/standards/base.md` and `docs/standards/design-system.md` and confirm the palette and fonts with the brand material

### Appendix B — Commands

```bash
# development
npm i
npm run dev

# database
npx supabase start
npx supabase migration new core_schema
npx supabase db reset
npx supabase test db
npm run db:types
npx supabase link --project-ref <ref> && npx supabase db push

# quality (what pre-push runs)
npm run lint
npm run typecheck
npm run check:consistency
npm run format:check
```

### Appendix C — Traceability with the product document

| Product requirement | Where it is resolved |
|---|---|
| Public site and `/admin` | Sections 12 and 16 |
| Back office by spaces | Sections 6 and 16 |
| CMS | Section 12 |
| Clients, brands and channels | [reference/data-model.md](reference/data-model.md) section 4; `marketing` modules |
| Client access for approval | Sections 7, 8.4 and 14 |
| Editorial calendar | Section 13 |
| Cross-cutting media library | Section 11 |
| Supabase and R2 | Sections 4, 9 and 11 |
| Variants and immutable revisions | [reference/data-model.md](reference/data-model.md) section 5; section 10 |
| Approval rules 1 to 8 | Sections 10.1 and 10.2 |
| Profiles and permissions | Section 8 |
| Isolation between brands | Sections 8 and 22 |
| Time zones and daylight saving | Section 13 |
| Manual publishing without external calls | Section 10.2 (`mark_published`) |
| Deploy on Vercel | Section 18 |
| Code and organization rules | Section 2 and `AGENTS.md` |
| Language convention (English everywhere, UI in pt-BR) | Section 1 and ADR-16 |
| Color palette | `standards/color-palette.md` |

### Appendix D — Contradictions resolved in this version

| Topic | Earlier version | v0.3 (prevails) |
|---|---|---|
| Framework | Next.js | TanStack Start |
| Documentation language | Portuguese | **English** (only UI copy in Brazilian Portuguese) |
| Folder and file names | Portuguese (`docs/padroes`, `documentacao-projeto-marketing-v0.1.md`) | English (`docs/standards`, `product-documentation-v0.1.md`) |
| Folder structure | `src/modules/*` | Type → space → module |
| Permissions | Fixed roles with `permissions text[]` | Configurable profiles by actions and `brand_members` |
| Routes | In Portuguese | In English (site addresses come from the CMS) |
| Storage | AWS SDK, thumbnails with `sharp` | `aws4fetch`, reduced copies in the browser |
| Notifications | Own `email_outbox` | Memoria Print infrastructure; email queue only as support |
| Package manager | pnpm | npm |
| Errors and logs | Sentry | `logError` as the single point, pluggable service |
| Colors | Palette to be defined | [standards/color-palette.md](standards/color-palette.md) (high contrast) |

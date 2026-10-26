# Base standards (rules that every change must follow)

> The single rulebook for code, data, security, interface and documentation in Compasso. It is written to be **applied by an AI assistant and by people alike**: every rule has an **ID**, uses **MUST / MUST NOT** wording, says **how to check it** and, when possible, **which tool enforces it**. `AGENTS.md` summarizes the non-negotiables; this document gives the detail. In case of conflict, `AGENTS.md` prevails, then this document, then the module documents. The origin of many rules is the Memoria Print project, where recurring problems (several different ways of doing the same thing, rules that drifted over time) are exactly what this document is meant to prevent. UI copy is Brazilian Portuguese; everything else is English.

## 0. How to use this document

**Before writing anything**

1. Read the module document of what you are changing (`docs/modules/*.md`, `docs/spaces/*.md`, `docs/foundations/*.md`) and the sections of this file listed in the *Rule map* (section 12). If you are taking a planned task, find it in [../implementation-plan.md](../implementation-plan.md).
2. **Look names up in the registries** ([../reference/README.md](../reference/README.md)): tables and columns, functions, routes, statuses/enums, error codes, actions, notification kinds, audit actions, UI terms. Use them exactly. A name that is not there is **not allowed to exist yet** (GOLD-4): add it to the registry first.
3. **Search the repository** for an existing implementation (component, hook, function, constant, SQL function, document). Reuse or extend it. Creating a second way of doing the same thing is a defect (rule **GOLD-2**).
4. Write down (in the plan or the commit message) which rule IDs apply.

**While writing**: follow the canonical patterns (section 2) and templates (section 5). Do not invent names, tables, actions, error codes or routes that are not in the documentation; add them to the documentation in the same change (**DOC-2**).

**After writing**: run the verification commands (section 11) and tick the Definition of Done (section 10). Report honestly what was and was not verified.

**Reading the rules**: *MUST* and *MUST NOT* are mandatory; *SHOULD* needs a written reason to skip; *MAY* is optional. "Enforced by" says what fails automatically; rules marked `review` rely on the assistant and the reviewer.

## 1. Golden rules (meta)

| ID | Rule | Verify |
|---|---|---|
| GOLD-1 | **The documentation is the source of truth.** If the code and a document disagree, one of them is wrong; fix it in the same change. Never leave them diverging | `review` |
| GOLD-2 | **One way to do each thing.** Before creating code, search for the existing canonical implementation (section 2). Extend it; do not create a parallel one with a different name, location or shape | `grep`, `review` |
| GOLD-3 | **No silent deviation.** If a request conflicts with a rule or a document, stop and say so. Either follow the rule, or the rule is changed **first** (section 9) with the document updated in the same change. Never "just do it differently this once" | `review` |
| GOLD-4 | **Do not invent.** Names of tables, columns, actions, routes, error codes, notification kinds, tokens and components come from the documentation or are added to it. If something is unspecified, ask or propose it in the document before coding | `review` |
| GOLD-5 | **Smallest coherent change.** One purpose per change; no drive-by refactors; no unrelated formatting; no new dependency without a reason recorded in the commit message | `review` |
| GOLD-6 | **Prove it.** A feature is done when the Definition of Done (section 10) passes. "Compiles" is not "done". Say what you did **not** test | `review` |
| GOLD-7 | **Security and isolation are never optional.** Permissions, brand scope, validation and secrets rules apply to every change, including prototypes and scripts | `RLS`, tests, `review` |
| GOLD-8 | **History is preserved.** Archive instead of delete; revisions, decisions and audit events are immutable; applied migrations are never edited | triggers, `review` |

## 2. Canonical patterns (the one place for each concern)

Search these locations first. If a row says "forbidden", using that alternative is a defect even if it works.

| Concern | Canonical implementation | Forbidden alternatives |
|---|---|---|
| **Audit of business actions** | SQL function `audit_write(...)` called inside the transactional function of the operation; constants `AuditAction` in `lib/shared/audit/actions.ts`; table `audit_events`; one screen `/admin/settings/audit` ([../modules/audit.md](../modules/audit.md)) | Inserting into `audit_events` directly; a second audit table; audit written from the client; free-text action names; audit logic duplicated per module |
| **Audit of access** | `profile_audit` and `role_audit`, written by the access functions | Mixing access events into `audit_events` or business events into these |
| **Logging** | `logError` (`lib/shared/logger.ts`) | `console.*`, any other logger |
| **Result and errors** | `Result<T>`, `fail`, `parseOutput` in `lib/shared/server-utils.ts`; messages in `lib/shared/auth/errors.ts` | A new `Result` type, `throw` for expected failures, error text compared with `includes` |
| **Permissions (TS)** | `Action.Module.Verb`, `can`, `<Can>`, `requireAction`, `requireActionServer` | String literals like `"content.update"`, role-name checks (`role === "manager"`) |
| **Permissions (SQL)** | `has_action('x')` + `can_access_brand(brand_id)` / `is_external_brand_member(...)` | Role checks, `auth.jwt()` claims, `user_metadata` |
| **Statuses and unions** | `const X = {...} as const` + `type X = ValueOf<typeof X>` in `lib/shared/enums.ts` or the module's `types.ts`; `z.nativeEnum(X)` | Literal strings (`"draft"`), TS `enum`, `z.enum([...])` |
| **Cache keys** | `QueryKey.*` factories in `lib/shared/query-keys.ts` and per module | Inline arrays in `useQuery` / `invalidateQueries` |
| **Browser storage** | `StoredKey` + `readStored` / `writeStored` | Direct `localStorage` / `sessionStorage` |
| **Dates, time zones, numbers** | `lib/shared/format.ts` | `toLocaleString`, `new Date().toISOString()` for display, manual offsets |
| **Server logic** | `createServerFn` in `*.functions.ts`, input `.validator(schema)` | Route handlers for business logic, logic inside components |
| **Database access (client)** | Supabase client typed with `Database` (`lib/shared/supabase`), RPCs for transactions | Untyped clients, raw SQL strings built from input |
| **Service-role client** | `lib/shared/supabase/admin.server.ts`, only in the allowed modules | Importing it elsewhere, in components, or in any `VITE_` context |
| **File storage** | `lib/shared/storage` (`ServerStorage` / `BrowserStorage`) and `lib/shared/media` | Calling R2/S3 directly, storing signed URLs |
| **Notifications** | `notify_users(...)` / `resolve_notifications(...)` in the same transaction; kinds in `NotificationKind` and `notification_kinds` | Inserting into `notifications`, notifications from the client |
| **Email** | `lib/shared/email` adapter + outbox | Calling the email provider elsewhere |
| **Social platforms (Instagram)** | `lib/shared/social` (the only code that calls Meta; responses validated with zod; failures classified into `PublishErrorCode`), jobs in `lib/shared/jobs`, token encrypted with `token-crypto.server.ts` | Calling the Graph API from a component, a route or another module; reading or logging a token; storing a token in clear text |
| **Lists** | `useListState` (URL params) + `DataTable` + `PaginationBar` + `ListSkeleton` + `EmptyState` | Own pagination, client-side filtering of paged data |
| **Forms** | The shared zod schema + `useFormSubmit` (parse on the client, call the server function, field errors, `focusFirstInvalid`) + the field components (`TextField`, `SelectField`, `Field`…) + `useUnsavedChanges`. `react-hook-form` is allowed only for forms with many dynamic fields and needs a written reason | A second submit hook, uncontrolled ad-hoc forms, validation only on the client |
| **Dialogs** | `ConfirmDialog`, `ReasonDialog`, `FormDialog`, `EditorSheet` | New modal components, `window.confirm` |
| **Toasts** | Global `Toaster` (`sonner`) | Custom toasts, `alert()` |
| **Status badges** | `StatusBadge` with a `tone` | Color classes written in modules |
| **Cards / field groups** | `SectionCard`, `FieldGroup` | Raw card classes, raw `<fieldset>` |
| **Colors and styles** | Tokens in `styles.css` ([color-palette.md](color-palette.md)) | Hex, `white`/`black`, Tailwind palette, arbitrary values without a reason |
| **Menu** | `nav-config.ts` | Hard-coded menus |
| **Feature docs** | One document per module in `docs/modules/`; one per area elsewhere | New overlapping documents (including new "audit" or "plan" documents) |
| **Audit documents** | `docs/audits/<topic>.md` using the template in section 8.3, **one file per topic**, updated in place | Several files for the same topic, dated copies, scattered findings |

The **registries** that hold the exact names are in [../reference/](../reference/README.md): `data-model.md` (tables), `functions.md` (SQL/server functions and who writes audit/notifications), `routes.md`, `enums.md` (statuses, keys), `error-codes.md` (codes and pt-BR messages), plus the action catalog ([../foundations/roles-and-actions.md](../foundations/roles-and-actions.md)), the notification kinds ([../foundations/notifications.md](../foundations/notifications.md)), the audit actions ([../modules/audit.md](../modules/audit.md)) and the UI terms ([ui-glossary.md](ui-glossary.md)). Look there before naming anything.

When a row is missing for something you need, propose the row here **first** (section 9).

## 3. Code rules

| ID | Rule | Enforced by |
|---|---|---|
| CODE-1 | **No comments in `src`** (not even JSDoc). The only allowed comments are `eslint-disable … -- reason` and `@ts-expect-error`. Express intent with names, types and small functions | ESLint `local/no-comments` |
| CODE-2 | **No `console`**. Use `logError` | ESLint `no-console` |
| CODE-3 | **Imports in a single block**, no blank lines between them; inline `type` imports (`import { type X, y }`); no duplicate imports; use the `@/` alias; relative paths only inside the same module; **no re-exporting `index.ts`** | ESLint `local/imports-together`, `consistent-type-imports`, `no-duplicate-imports` |
| CODE-4 | **No loose strings where a constant exists** (permissions, statuses, query keys, storage keys, notification kinds, audit actions, section kinds, platforms) | ESLint `local/no-magic-strings`, `local/no-literal-zod-enum`, `check:consistency` |
| CODE-5 | **No `any`, no `!`, no `as unknown as`**. Type the source or validate the value with zod (`parseOutput`) | ESLint, `tsc` |
| CODE-6 | **No nested `if`**: use guard clauses and early returns, or extract a function | ESLint `local/no-nested-if` |
| CODE-7 | **Functions are small and do one thing**; components under 600 lines (warning); extract hooks for data/logic and keep components presentational | ESLint `max-lines`, `review` |
| CODE-8 | **Naming:** see section 4 | `review` |
| CODE-9 | **Strict TypeScript flags stay on** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`). Never loosen a flag to make code compile | `tsc` |
| CODE-10 | **Equality and flow:** `===`, `prefer-const`, no `var`, no `else` after `return`, object shorthand, `exhaustive-deps` as error | ESLint |
| CODE-11 | **No dead code**: remove unused exports, imports, files and commented-out code in the same change | `noUnused*`, `review` |
| CODE-12 | **Dependencies:** adding one needs a reason in the commit message, a check of license/maintenance and a lockfile update; do not add a library for something the kit already does | `review` |
| CODE-13 | **Formatting is Prettier's**: width 100, double quotes, semicolons, trailing commas. Never hand-format; never commit unformatted files | Prettier, husky |
| CODE-14 | **No `lint-disable` to silence a rule** unless there is a documented exception with `-- reason`; the legacy-exception lists start empty and **only shrink** | `review` |
| CODE-15 | **Errors are values on the server:** expected failures return `fail(...)` with a `code`; unexpected errors are logged with `logError` and surface a generic message | `review` |

## 4. Naming and placement

| Thing | Convention | Example |
|---|---|---|
| Files and folders | `kebab-case`, English | `variant-form.tsx`, `approvals/` |
| React components | `PascalCase` exports, one main component per file, file name = kebab-case of it | `VariantForm` in `variant-form.tsx` |
| Hooks | `use-*.ts`, function `useSomething` | `use-list-state.ts` |
| Server functions | `*.functions.ts`, exported `camelCase` verbs | `submitForApproval` in `approvals.functions.ts` |
| Server-only modules | `*.server.ts` | `admin.server.ts` |
| Schemas, types, constants | `schemas.ts`, `types.ts` (or `enums.ts`) in the module; zod schema names end in `Schema` | `submitForApprovalSchema` |
| Constants (as const) | `PascalCase` object + same-name type | `EditorialStatus` |
| Query keys | `QueryKey.<Module>.<name>` | `QueryKey.Content.list(filters)` |
| Actions | `module.verb` in SQL, `Action.Module.Verb` in TS | `content.update`, `Action.Content.Update` |
| Tables and columns | `snake_case`, plural tables, English | `content_channels.planned_at` |
| SQL functions | `snake_case` verbs; portal ones prefixed `portal_` | `submit_for_approval`, `portal_decide_approval` |
| SQL error codes | `lowercase_with_underscores` | `revision_superseded` |
| Migrations | `YYYYMMDDHHMMSS_<module>_<change>.sql` | `20261101120000_content_channels.sql` |
| Tests | Unit `*.test.ts` next to the file; pgTAP `supabase/tests/NN_<area>.test.sql`; E2E `e2e/<flow>.spec.ts` | |
| Routes | English, kebab-case segments, plural collections, `$param` | `/admin/marketing/clients/$clientId` |
| Documents | English, kebab-case `.md`, in the folder of their area | `docs/modules/content.md` |
| Commits | Conventional Commits, scope = module: `feat(content): add variant duplication` | |

**Where does a new file go?** (decision procedure)

1. What type is it? Component → `components/`, server function / schema / types / rule → `lib/`, hook → `hooks/`, static asset → `assets/`, route → `routes/`.
2. Who uses it? One space → that space folder; more than one → `shared`. A space **never** imports from another space.
3. Which module? Reuse the module folder (same name in `components`, `lib`, `hooks`); create one only for a new feature.
4. Does an equivalent exist already? If yes, extend it (GOLD-2).

## 5. Templates (copy the shape)

### 5.1 Server function

```ts
export const submitForApproval = createServerFn({ method: "POST" })
  .validator(submitForApprovalSchema)
  .handler(async ({ data }): Promise<Result<{ requestId: string }>> => {
    const caller = await requireActionServer(Action.Content.Submit);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("submit_for_approval", {
      p_item: data.itemId,
      p_approver: data.approverId,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(requestIdSchema, row);
  });
```

Checklist: input validated · permission checked first · context resolved from the database (never from client ids) · RPC for multi-step writes · output validated · explicit DTO (never a full row for the portal) · errors through `fail` · no secrets, no `console`.

### 5.2 Route file

```tsx
export const Route = createFileRoute("/admin/_app/(marketing)/marketing/clients/")({
  beforeLoad: ({ context }) => requireAction(context, Action.Clients.View),
  validateSearch: clientListSearchSchema,
  component: ClientsPage,
  pendingComponent: ListSkeleton,
  errorComponent: RouteError,
});
```

The route only wires: guard, search params, loader (if any) and the page component imported from `components/<space>/<module>`. No business logic and no JSX beyond the component.

### 5.3 List page

`PageHeader` (primary action) → `ListToolbar` (search with `useDebouncedValue`) → filters → `DataTable` → `PaginationBar`. State from `useListState` (URL). Query key from `QueryKey`, `keepPreviousData`. States in this order: skeleton → error (retry) → empty → no results (clear) → list.

### 5.4 Form

zod schema in the module's `schemas.ts`, used by both the form (`useFormSubmit` parses it before calling) and the server function. Submit button `loading` and disabled; `focusFirstInvalid` on error; `useUnsavedChanges(isDirty)`; success `toast` only after the server confirms; failure keeps the typed data.

### 5.5 Migration (one concern per file)

```sql
begin;

create table public.example (...);
alter table public.example enable row level security;
create policy example_read on public.example for select
  using (has_action('example.view') and can_access_brand(brand_id));

insert into public.actions (key, module, description, requires)
values ('example.view', 'example', 'View examples', '{}')
on conflict do nothing;

commit;
```

Required in every migration that adds a table: RLS enabled, no policy for `anon`, composite foreign keys when it belongs to a brand, indexes for filters and policies, `updated_at` trigger, actions and notification kinds seeded, error codes raised with `raise exception 'code'`. After it: `npm run db:types`, add the codes to `errors.ts`, add pgTAP tests, run `check:consistency`.

### 5.6 pgTAP test

For each new table or function: one test per role (Owner, an internal role with the action, one without, an external user of brand A, an external user of brand B, `anon`) proving allowed and refused access, swapped ids, and immutability triggers.

### 5.7 Audit event

Inside the transactional SQL function: `perform audit_write(v_org, v_brand, 'content.submitted', 'content_item', v_item, jsonb_build_object('revision_no', v_no));` The action name must exist in `AuditAction` (TS) and in the list verified by `check:consistency`. Metadata: ids and field names only.

## 6. Data and database rules

| ID | Rule | Enforced by |
|---|---|---|
| DATA-1 | **RLS on every table**; no policy for `anon` except the explicit public read functions; every policy combines the action and the brand scope | pgTAP, `supabase db lint` |
| DATA-2 | **External users never read internal tables or columns.** They read through `portal_*` `security definer` functions that return safe columns | pgTAP |
| DATA-3 | **Composite foreign keys** `(x_id, brand_id)` so a row cannot reference another brand's row | pgTAP |
| DATA-4 | **Multi-step writes are one SQL function (transaction)**: submit, decide, reopen, publish, accept invitation. Lock with `for update` where concurrency matters | pgTAP |
| DATA-5 | **Optimistic locking** with `version` on editable aggregates; conflict returns `conflict` and the UI keeps the typed text | `review`, tests |
| DATA-6 | **Immutability** by trigger for revisions, revision media, decisions and audit events | pgTAP |
| DATA-7 | **Time:** instants as `timestamptz` (UTC) + IANA zone; deadlines as `date`; never store local time strings | `review` |
| DATA-8 | **Statuses are `text` + `CHECK`** with a matching TS constant; adding one means changing the `CHECK`, the constant and the docs together | `check:consistency` |
| DATA-9 | **Every `raise exception 'code'` has a pt-BR message** in `errors.ts`; every message maps to a code | `check:consistency` |
| DATA-10 | **Every action used in SQL exists in the `actions` table and in `Action`**, and vice versa | `check:consistency` |
| DATA-11 | **Generated types are committed** (`npm run db:types`); never hand-edit them | CI diff |
| DATA-12 | **Never edit an applied migration**; add a new one (expand → migrate code → contract) | `review`, CI |
| DATA-13 | **Seeds use `on conflict do nothing`/upsert**, never contain passwords or real personal data | `review` |
| DATA-14 | **Pagination, search and filters in the database/server**, with indexes for the filters; lists never load "everything" | `review` |
| DATA-15 | **No secrets or signed URLs in the database**; storage keys are opaque. One exception (decided 2026-10-26): access tokens of a connected external account (channel connections, [../modules/instagram-publishing.md](../modules/instagram-publishing.md)), stored **encrypted**, never returned to any client, never logged, deleted on disconnect | `review`, pgTAP |

## 7. Security rules

| ID | Rule | Enforced by |
|---|---|---|
| SEC-1 | **Check authorization in four layers:** menu (`nav-config`), route (`requireAction`), server (`requireActionServer`), database (RLS). Hiding UI is never security | tests |
| SEC-2 | **Effective permission = role action AND brand link.** Never infer scope from the client; resolve the brand from the database | pgTAP |
| SEC-3 | **Never trust identifiers from the client** (brand, client, organization, user ids): load the record with the user's client and let RLS decide | pgTAP |
| SEC-4 | **Secrets only on the server** (`SUPABASE_SERVICE_ROLE_KEY`, R2, email, cron). Never with a `VITE_` prefix, never in logs, never in documents or commits; `.env*` files are not read or edited | lint on imports, secret scanning |
| SEC-5 | **The service-role client is imported only from the allowed server modules** (invitation acceptance, jobs and the readers of stored connection tokens in `lib/shared/jobs`, audit, signing after verification) | ESLint `no-restricted-imports` |
| SEC-6 | **Inputs are validated** with zod on the server for every function and route; external data (webhooks, forms, RPC `jsonb` outputs) is validated at runtime | review, tests |
| SEC-7 | **Uploads:** allowlist of MIME types, verification of real content, size limits, opaque keys, `stat` before reading, private bucket, short signed URLs, authorization checked **before** signing | tests |
| SEC-8 | **No `dangerouslySetInnerHTML`**; rich text is stored as JSON and rendered by an own component; links from users are validated (`https`/internal only, `rel="noopener noreferrer"`) | ESLint, review |
| SEC-9 | **CSRF** middleware stays enabled for server functions; mutating server routes verify the origin | `review` |
| SEC-10 | **Public endpoints** (contact form, invitation acceptance) have rate limits, honeypot/Turnstile and generic error messages | tests |
| SEC-11 | **Generic auth messages** ("E-mail ou senha incorretos"); never reveal whether an email or account exists | review |
| SEC-12 | **Personal data minimal:** collect only what is necessary; no personal data in logs or audit metadata beyond ids | review |
| SEC-13 | **Revocation is immediate** for new operations (role change, brand link revoked, suspension); issued signed URLs expire within minutes | pgTAP |
| SEC-14 | **Never weaken a protection to make something work** (disabling RLS, widening a policy, using the service role "temporarily"). Stop and ask | review |

## 8. Interface and documentation rules

### 8.1 Interface

| ID | Rule |
|---|---|
| UI-1 | **Lists:** every list that can grow is paginated, searched and filtered **on the server**; filters/page/search live in the URL; changing a filter resets to page 1; search is debounced (300 ms); an old response never replaces a newer one |
| UI-2 | **States:** every screen/list implements skeleton → error with retry → empty → no results → data; skeletons keep the layout height; errors keep the layout and offer a way out |
| UI-3 | **Forms:** validation on client **and** server; required fields marked; hints for format/limits; error next to the field; focus on the first invalid field; submit button in loading state and no double submit; typed data is kept on failure; unsaved-changes warning |
| UI-4 | **Feedback:** success toast only **after** the server confirms; errors are useful and never expose internals; destructive actions use `ConfirmDialog` naming the record (or `ReasonDialog` when a reason is required) |
| UI-5 | **Blocking:** while an operation runs, disable the actions that depend on it; keep independent actions (navigate, cancel) available |
| UI-6 | **Consistency:** same component and term for the same behavior; primary action always at the top right of `PageHeader`; filters preserved when returning from a detail |
| UI-7 | **Responsive:** works at 360 px, tablet and desktop; no horizontal overflow; tables adapt; touch targets ≥ 44 px |
| UI-8 | **Accessibility:** labels on fields, visible focus, keyboard access for every action (drag has a button alternative; the calendar has a list alternative), `aria-invalid`/`aria-describedby`, state never by color alone, alternative text on images, `prefers-reduced-motion` respected |
| UI-9 | **Colors and style:** tokens only ([color-palette.md](color-palette.md)); body text keeps AAA contrast on its surfaces; new color pairs are verified before use; no arbitrary values without a reason |
| UI-10 | **Components:** reuse the kit (`shared/ui`, `shared/admin`); a new component is created only when the pattern repeats in two places, with the six states and `aria-*` |
| UI-11 | **Time zones:** every date-time shown carries its zone or the zone is visible on the screen; use `DateTimeField` / `formatInZone` |
| UI-12 | **Copy:** Brazilian Portuguese, clear and direct, no internal codes; messages say what happened and what to do; labels follow the glossary in the module documents ("Aprovar", "Pedir alterações", "Marca", "Canal"…) |
| UI-13 | **Permissions in UI:** items and buttons appear only with the action; a disabled control explains why (`WhyDisabled`) when the reason is not obvious |
| UI-14 | **Dates and money formatting** only through `format.ts`; no manual formatting |

### 8.2 Documentation

| ID | Rule |
|---|---|
| DOC-1 | **Documentation, folders, files, code, routes, tables and SQL are in English; only UI copy is Brazilian Portuguese.** A document names a screen or status in English and gives the pt-BR UI label in quotes |
| DOC-2 | **Docs change with the code.** The table in section 9.2 says which document each kind of change updates; a change is incomplete without it |
| DOC-3 | **One document per area; never create overlapping documents.** Add to the existing one. Module documents keep the same structure (objective, data, screens, rules, data model, permissions, error codes, acceptance criteria, implementation status) |
| DOC-4 | **"Implementation status" is updated by every delivery**: files and migrations, validation actually performed, what was not tested, external pending items. Never claim a test that was not run |
| DOC-5 | **Documents state decisions, not discussions.** Open questions go in the "Open decisions" section with a recommendation; when decided, move the answer into the rule and delete the question |
| DOC-6 | **Links use relative paths**; no link to a file that does not exist; renaming a document updates every link (`grep` before and after) |
| DOC-7 | **Audit documents** follow the template in 8.3 and live in `docs/audits/`, **one file per topic, updated in place** |

### 8.3 Audit document template (`docs/audits/<topic>.md`)

```
# Audit: <topic>
Date of the snapshot · Scope · Method (how the numbers were obtained)
## 1. Summary (table: requirement · status ✅/🟡/❌ · evidence)
## 2. What is right (keep)
## 3. Findings (ID F1…, severity High/Medium/Low, evidence, risk, recommendation)
## 4. Plan (ordered, small steps)
## 5. Status of each finding (updated in place: open / fixed in <commit> / accepted with reason)
## 6. Limits of this audit
```

New findings on an existing topic are **added to that file**. A new file is created only for a new topic, and the index in `docs/README.md` is updated.

## 9. Change management (how rules and docs evolve)

### 9.1 Changing a rule or a decision

Whoever (person or assistant) wants something that contradicts a rule must:

1. **Stop and state the conflict** ("Isto contraria BASE rule SEC-4 / o documento X").
2. Ask for a decision, offering the recommended option and its cost.
3. If the rule changes: update this document or the module document **first**, in the same change, including `AGENTS.md` if it is non-negotiable; then implement.
4. If the rule does not change: implement the compliant alternative.

Never carry out the deviation and "fix the docs later" (GOLD-3).

### 9.2 What each kind of change must update

| Change | Update in the same change |
|---|---|
| New table / column / constraint | [../reference/data-model.md](../reference/data-model.md), module doc (rules), migration, `db:types`, pgTAP test |
| New SQL/server function | [../reference/functions.md](../reference/functions.md) (actions, audit, notifications, errors), module doc, tests |
| New route | [../reference/routes.md](../reference/routes.md), `nav-config`, module doc (screens) |
| New status / enum value / key | [../reference/enums.md](../reference/enums.md), `CHECK`, TS constant, labels, module doc |
| New UI term or message | [ui-glossary.md](ui-glossary.md) and, for errors, [../reference/error-codes.md](../reference/error-codes.md) |
| Task finished | [../implementation-plan.md](../implementation-plan.md) status column |
| New action (permission) | `roles-and-actions.md` catalog and starting roles, SQL `actions` seed, `Action` constant, `nav-config`/guards, pgTAP matrix |
| New status | Module doc (statuses and transitions), `CHECK`, TS constant, `statusStyles`/`StatusBadge` mapping, tests |
| New error code | SQL `raise exception`, `errors.ts` message, module doc error codes |
| New notification kind | `notifications.md` table, `notification_kinds` seed, `NotificationKind` constant, tests |
| New audit action | `audit.md` list, `AuditAction` constant, the SQL function that writes it |
| New route / screen | Module doc (screens), `nav-config` (with the `action`), route guard |
| New component pattern | `design-system.md` (table of components) and, if it is a rule, this file |
| New env variable | `technical-architecture` env table, `.env.example` (no value), the env validation module |
| New dependency | Commit message reason; `technical-architecture` stack table if it is core |
| Changed behavior of a flow | Module doc (rules, flow, acceptance criteria) and its "Implementation status" |
| New color token | `color-palette.md` (with verified contrast), `styles.css`, lint exemptions only if justified |
| Rule change | This document and `AGENTS.md` if non-negotiable (section 9.1) |

### 9.3 Handling requests that change things mid-way

When the person changes direction while work is in progress: (1) restate the new decision in one line, (2) list which documents and already-written code it invalidates, (3) update the documents first, (4) then adapt the code, (5) remove what became dead. Do not keep both versions.

## 10. Definition of Done

A feature is done only when every item is true (or explicitly marked "not applicable" with a reason):

**Specification**
- [ ] The module document describes the behavior; the rule IDs applied are known.
- [ ] No new name was invented outside the documentation (GOLD-4).
- [ ] The documents of section 9.2 were updated; the "Implementation status" is honest.

**Code**
- [ ] Reused the canonical implementations of section 2; no parallel version created (GOLD-2).
- [ ] No comments, no `console`, no `any`/`!`/`as unknown as`, no nested `if`, no loose strings (CODE-1…CODE-6).
- [ ] Files in the right space/module; no forbidden cross-space import.
- [ ] Server functions follow template 5.1.

**Data and security**
- [ ] Migration follows 5.5; RLS on; policies combine action and brand scope; composite FKs.
- [ ] External access only through `portal_*` functions; no new internal read for external roles.
- [ ] Actions, statuses, error codes, notification kinds and audit actions are consistent between SQL and TS (`check:consistency`).
- [ ] Transactions, locking and `version` where concurrency matters; audit events written in the same transaction.
- [ ] No secret, password or signed URL stored or logged.

**Interface**
- [ ] Skeleton, error, empty, no-results and success states; no double submit; unsaved-changes warning; focus on the first error.
- [ ] Permissions in menu, route, server and database.
- [ ] Layout checked at 360 px, tablet and desktop; keyboard works; contrast per the palette.
- [ ] Time zones visible where a date-time appears.

**Verification**
- [ ] `npm run lint`, `npm run typecheck`, `npm run check:consistency` pass; relevant unit, pgTAP and E2E tests were added and pass.
- [ ] The acceptance criteria of the module document were exercised, or the gap is stated.

## 11. Verification commands

| When | Command |
|---|---|
| After editing code | `npm run lint` · `npm run typecheck` · `npm run format:check` |
| After touching SQL or constants | `npm run check:consistency` · `npx supabase db reset` · `npx supabase test db` · `npm run db:types` |
| Without Docker (fallback) | `npm run db:verify`: applies the migrations and runs `supabase/tests/*.test.sql` on an in-process Postgres (PGlite) with a pgTAP-compatible shim and Supabase stubs. It does **not** replace `supabase test db` (no `pg_cron`, no real GoTrue) |
| After touching documents or registries | `npm run check:docs` (`node scripts/check-docs.mjs`): relative links, and that error codes, actions, audit actions and notification kinds used in `reference/functions.md` and `reference/routes.md` exist in their registries |
| After touching flows | `npm run test` (Vitest) · `npm run e2e` (Playwright) |
| Before pushing | the `pre-push` hook runs lint, typecheck and check:consistency |
| Searching for existing code | `grep`/glob in `src/`, `supabase/`, `docs/` for the concern name (section 2) |

If a command cannot be run in the current environment, say so and list what remains unverified.

## 12. Rule map (what to read for each task)

| Task | Read |
|---|---|
| Any change | This file, sections 1–4; the registries in [../reference/README.md](../reference/README.md); the task in [../implementation-plan.md](../implementation-plan.md) |
| New copy or label in the UI | [ui-glossary.md](ui-glossary.md), [../reference/enums.md](../reference/enums.md), [../reference/error-codes.md](../reference/error-codes.md) |
| New route | [../reference/routes.md](../reference/routes.md) |
| New function (SQL or server) | [../reference/functions.md](../reference/functions.md) |
| New or changed screen | Section 8.1, [admin-layout-and-standards.md](admin-layout-and-standards.md), [design-system.md](design-system.md), the module document |
| New or changed server function | Sections 5.1, 7, [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md) |
| New table, policy or SQL function | Sections 5.5, 5.6, 6, [../technical-architecture-v0.1.md](../technical-architecture-v0.1.md) sections 8–10 |
| Files and media | [../spaces/media-library.md](../spaces/media-library.md), [../spaces/r2-storage.md](../spaces/r2-storage.md), SEC-7 |
| Approvals and content | [../modules/content.md](../modules/content.md), [../modules/approvals.md](../modules/approvals.md) |
| Notifications | [../foundations/notifications.md](../foundations/notifications.md) |
| Audit | [../modules/audit.md](../modules/audit.md), section 2 (audit rows) |
| Site and CMS | [../spaces/cms-site.md](../spaces/cms-site.md), [../spaces/cms-dynamic-architecture.md](../spaces/cms-dynamic-architecture.md), [../spaces/public-site-delivery.md](../spaces/public-site-delivery.md) |
| Folders and imports | [project-structure.md](project-structure.md) |
| Colors and contrast | [color-palette.md](color-palette.md) |
| Documentation work | Section 8.2, 8.3 and 9 |

## 13. Anti-patterns (never do these)

| Anti-pattern | Do this instead |
|---|---|
| Creating `audit-2.md`, a second audit table or a new audit helper because the existing one is "inconvenient" | Extend the existing one (GOLD-2) and update its document |
| Checking `role === "manager"` or reading `user_metadata` for access | `has_action` + `can_access_brand`; `Action.*` in TS |
| Using a string like `"awaiting_approval"` in a component | `EditorialStatus.AwaitingApproval` |
| Writing a `useQuery` key inline | `QueryKey.Content.list(filters)` |
| Reading `localStorage` directly | `readStored(StoredKey.X)` |
| Doing client-side search over a paged list | Server-side search through `useListState` |
| Selecting `*` from an internal table for the portal | A `portal_*` function returning explicit columns |
| Writing several rows from the client in sequence | One SQL function (transaction) called through a server function |
| Putting logic in the route file or the component | Hook/function in `hooks/` or `lib/`, component stays presentational |
| Importing across spaces ("just this once") | Move the piece to `shared` |
| "Fixing" a lint error with `eslint-disable` or a cast | Fix the cause (type the source, validate with zod, restructure) |
| Adding a color with hex or `bg-white` | A token from the palette; verify contrast first |
| Showing a date without its time zone | `formatInZone` / `DateTimeField` |
| Showing success before the server confirms | Toast after the confirmed result |
| Silently changing behavior the documents describe | Stop, ask, update the document first (section 9.1) |
| Committing without updating the "Implementation status" | Update it with files, migrations and validation done |
| Reading, printing or editing `.env*` files or secrets | Use `.env.example` and the env validation module |
| Claiming something was tested when it was not | State exactly what was and was not run |

## 14. Review checklist (for the assistant's self-review and for pull requests)

1. Is every new name present in the documentation (or added to it)?
2. Did I search for an existing implementation of each concern (section 2)?
3. Do all rule IDs that apply hold? (Run the commands of section 11.)
4. Is there any path where an external user could read internal data, or an internal user could act on a brand they are not linked to?
5. Did the change touch a status, action, error code, notification kind or audit action, and are SQL and TS in sync?
6. Are the documents of section 9.2 updated and is the "Implementation status" honest?
7. Is the change the smallest coherent one, with no unrelated edits?

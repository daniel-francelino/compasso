# Reference registries

> The **registries** are the single place where each kind of name is defined: tables, functions, routes, statuses, error codes, actions, notification kinds, audit actions, UI terms. They exist so that code is written by **looking names up, not inventing them** (rule GOLD-4 of [../standards/base.md](../standards/base.md)), and so `npm run check:consistency` can compare SQL, TypeScript and documents. When something new is needed, add it to the right registry **first**, then to the code. If code and registry disagree, one of them is wrong (GOLD-1).

## Where each registry lives (one place per kind)

| Kind of name | Registry (authoritative) | Mirrored in code by | Checked by |
|---|---|---|---|
| Tables, columns, constraints, indexes, triggers | [data-model.md](data-model.md) | migrations, `database.types.ts` | `db:types` diff, pgTAP |
| SQL functions, server functions, server routes | [functions.md](functions.md) | `*.functions.ts`, migrations | `check:consistency` (SQL names ↔ rpc calls), review |
| Routes (URLs) | [routes.md](routes.md) | `src/routes`, `nav-config.ts` | `tsc` (typed routes), review |
| Statuses and enums (values, TS constants, `CHECK` lists) | [enums.md](enums.md) | `lib/shared/enums.ts`, module `types.ts`, `CHECK` constraints | `check:consistency` |
| Error codes and pt-BR messages | [error-codes.md](error-codes.md) | `raise exception` in SQL, `lib/shared/auth/errors.ts` | `check:consistency` |
| Actions (permissions), starting roles | [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md) | `Action` in `lib/shared/auth/actions.ts`, `actions` seed, `has_action(...)` | `check:consistency` |
| Notification kinds | [../foundations/notifications.md](../foundations/notifications.md) | `NotificationKind`, `notification_kinds` seed | `check:consistency` |
| Audit actions | [../modules/audit.md](../modules/audit.md) | `AuditAction`, `audit_write` catalog | `check:consistency` |
| Colors and tokens | [../standards/color-palette.md](../standards/color-palette.md) | `styles.css` | ESLint, contrast check |
| UI terms (pt-BR) | [../standards/ui-glossary.md](../standards/ui-glossary.md) | UI texts | review |
| Environment variables | [../technical-architecture-v0.1.md](../technical-architecture-v0.1.md) appendix, `.env.example` | `env.ts` | startup validation |
| Query keys, storage keys | [enums.md](enums.md) (section "Keys") | `QueryKey`, `StoredKey` | ESLint |

## How to use a registry when implementing

1. **Look up** every name you need. Found → use it exactly (spelling, case, plural).
2. **Not found** → decide whether it is really new (search the registry and the code first). If new, add it to the registry in the same change, following the naming rules of base.md section 4.
3. **Implement** the code mirror (migration, TS constant, message) and run the checks.
4. **Never** rename something without updating the registry, every mirror and every document that mentions it (use `grep` for the old name).

## What `check:consistency` compares (specification of the script)

The script (`scripts/check-consistency.mjs`, copied from Memoria Print and adapted) fails the push when any of these differ. It reads the registries' code mirrors, not the Markdown.

| Check | Left side | Right side |
|---|---|---|
| Actions | `ACTION_KEYS` in `actions.ts` | rows inserted into `public.actions` in migrations; every `has_action('x')` in SQL |
| Error codes | every `raise exception 'code'` in migrations | keys of `messages` in `errors.ts` (and the reverse, as a warning) |
| Notification kinds | `NotificationKind` in TS | rows inserted into `notification_kinds` (and each kind's required action exists) |
| Audit actions | `AuditAction` in TS | the catalog inside `audit_write` and every `audit_write(... 'x' ...)` call |
| Statuses | TS constants listed in `enums.md` | the `CHECK (col in (...))` of the mapped table.column (needs the local database) |
| Edge cases | `Platform`, `ContentFormat`, `SectionKind`, `LinkKind`, `Background`, `Accent` | their `CHECK` or zod usage |
| Portal functions | `portal_*` names called from `lib/portal` | `create function public.portal_*` in migrations |

When you add a new kind of registry, extend the script and this table in the same change.

## Rules for editing registries

- Keep **one row per name**; no aliases.
- Values and names are **English, lowercase with underscores** for database values and **PascalCase** for TS constants.
- Every row says which module document owns the behavior.
- Do not copy a registry's content into another document; **link** to it (GOLD-2).

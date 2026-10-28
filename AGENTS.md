# Project decisions

These rules prevail over any document. The detailed, checkable rules (with IDs) are in `docs/standards/base.md`; the technical design is in `docs/technical-architecture-v0.1.md` and the product scope in `docs/product-documentation-v0.1.md`. The project inherits the rules of Memoria Print. Claude Code reads this file and `docs/standards/base.md` through `CLAUDE.md`.

## How to work (applies to people and AI)

- **Read before writing**: `docs/README.md` is the map; read the module document of what you change and the rule IDs that apply (`base.md`).
- **One way per concern** (GOLD-2): search for the existing implementation first (`base.md` section 2) and extend it. Never create a parallel version (a second audit table or helper, a second `Result`, a second status list, a second document on the same topic).
- **Do not invent names** (GOLD-4): tables, columns, actions, routes, error codes, notification kinds, audit actions, tokens and components come from the documentation or are added to it in the same change.
- **No silent deviation** (GOLD-3): if a request conflicts with a rule or a document, stop and say which one. Change the rule and its document **first** (`base.md` section 9.1), then the code. Never "fix the docs later".
- **Docs change with the code** (DOC-2, `base.md` section 9.2). Each delivery updates the module's "Implementation status" with files, migrations, validation actually performed and what was **not** tested.
- **Smallest coherent change** and **prove it** (GOLD-5, GOLD-6): finish with the Definition of Done (`base.md` section 10) and report honestly what was and was not verified.
- Never read, print or edit `.env*` files or secrets; never weaken RLS, policies or validation to make something work.

## Decisions

- Language: **documentation, folder names, file names, code, routes, tables, columns and SQL are in English.** Only the UI copy (what the user reads on screen, emails, notification texts) is in Brazilian Portuguese. Where a doc names a screen or status, the pt-BR UI label goes in quotes.
- Stack: TanStack Start (React 19, Vite, TanStack Router and Query), Supabase (Postgres, Auth, RLS), Cloudflare R2, deployed on Vercel. Sign-up by invitation only.
- Folder structure by space (`marketing`, `cms`, `site`, `portal`, `shared`) inside `components`, `lib` and `hooks`, and route groups in `src/routes`. A space never imports from another; what two spaces use goes to `shared`. Enforced by ESLint.
- Server functions in `*.functions.ts` files, with input validated by zod and `jsonb` output validated by `parseOutput`. Imports always through the `@/` alias, no re-exporting `index.ts`.
- No comments in `src` code (not even JSDoc): only `eslint-disable … -- reason` and `@ts-expect-error`. No `console`: use `logError` from `src/lib/shared/logger.ts`. Imports in a single block. No nested `if`, no `as unknown as`, no `!`, no `any`. All enforced by ESLint and checked on commit (husky and lint-staged).
- No loose text where a constant exists: permissions as `Action.Module.Verb`, cache keys as `QueryKey.X`, statuses as `as const` objects (`EditorialStatus`, `PublicationStatus`…), browser storage through `StoredKey` with `readStored`/`writeStored`, `z.nativeEnum` instead of `z.enum([...])`. SQL and TS must match (`npm run check:consistency`, in `pre-push`).
- Effective permission = profile action (`has_action`) AND brand link (`can_access_brand`). Checked in the menu, the route (`requireAction`), the server (`requireActionServer`) and RLS. External users only read through `portal_*` functions, never straight from the tables.
- Audit: business actions are written by the SQL function `audit_write(...)` inside the transactional function of the operation, with `AuditAction` constants; one table (`audit_events`), one screen; access decisions stay in `profile_audit`/`role_audit`. Audit documents: one file per topic in `docs/audits/`, updated in place.
- Secrets only on the server (never with the `VITE_` prefix). No password in a migration or in the repository. No secret in the database, except the access token of a connected external account (channel connection), stored encrypted and never returned to a client (DATA-15). Login by email only.
- Files: private R2 bucket, opaque keys generated on the server, direct upload by presigned URL, `stat` before reading, no signed URL stored in the database. Public derivatives only in a separate bucket, by explicit action.
- The public site keeps no content in the code: texts, images and case studies come from the CMS. **Temporary exception (decided 2026-10-28):** the home `/` is a landing page for Rayana Vasconcelos with its copy in `src/components/site/landing/`, until it is migrated to CMS sections (see `docs/spaces/cms-site.md` section 18).
- Design system in `src/styles.css` following `docs/standards/color-palette.md`: colors only through tokens, never hex, never pure black/white, never the default Tailwind palette. Body text keeps AAA contrast (7:1) on its intended surfaces. Fonts through `<link>` in `__root.tsx`.
- Every feature meets the checklist in `docs/standards/base.md` (server-side pagination, states, double submit, client and server validation, permissions, responsive layout). Each delivery updates the "Implementation status" of the module document.

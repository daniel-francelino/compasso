# Project decisions

These rules prevail over any document. Details in `docs/technical-architecture-v0.1.md` and `docs/product-documentation-v0.1.md`. The project inherits the rules of Memoria Print.

- Language: **documentation, folder names, file names, code, routes, tables, columns and SQL are in English.** Only the UI copy (what the user reads on screen, emails, notification texts) is in Brazilian Portuguese. Where a doc names a screen or status, the pt-BR UI label goes in quotes.
- Stack: TanStack Start (React 19, Vite, TanStack Router and Query), Supabase (Postgres, Auth, RLS), Cloudflare R2, deployed on Vercel. Sign-up by invitation only.
- Folder structure by space (`marketing`, `cms`, `site`, `portal`, `shared`) inside `components`, `lib` and `hooks`, and route groups in `src/routes`. A space never imports from another; what two spaces use goes to `shared`. Enforced by ESLint.
- Server functions in `*.functions.ts` files, with input validated by zod and `jsonb` output validated by `parseOutput`. Imports always through the `@/` alias, no re-exporting `index.ts`.
- No comments in `src` code (not even JSDoc): only `eslint-disable … -- reason` and `@ts-expect-error`. No `console`: use `logError` from `src/lib/shared/logger.ts`. Imports in a single block. No nested `if`, no `as unknown as`, no `!`, no `any`. All enforced by ESLint and checked on commit (husky and lint-staged).
- No loose text where a constant exists: permissions as `Action.Module.Verb`, cache keys as `QueryKey.X`, statuses as `as const` objects (`EditorialStatus`, `PublicationStatus`…), browser storage through `StoredKey` with `readStored`/`writeStored`, `z.nativeEnum` instead of `z.enum([...])`. SQL and TS must match (`npm run check:consistency`, in `pre-push`).
- Effective permission = profile action (`has_action`) AND brand link (`can_access_brand`). Checked in the menu, the route (`requireAction`), the server (`requireActionServer`) and RLS. External users only read through `portal_*` functions, never straight from the tables.
- Secrets only on the server (never with the `VITE_` prefix). No password in a migration or in the repository. Login by email only.
- Files: private R2 bucket, opaque keys generated on the server, direct upload by presigned URL, `stat` before reading, no signed URL stored in the database. Public derivatives only in a separate bucket, by explicit action.
- The public site keeps no content in the code: texts, images and case studies come from the CMS.
- Design system in `src/styles.css` following `docs/standards/color-palette.md`: colors only through tokens, never hex, never pure black/white, never the default Tailwind palette. Body text keeps AAA contrast (7:1) on its intended surfaces. Fonts through `<link>` in `__root.tsx`.
- Every feature meets the checklist in `docs/standards/base.md` (server-side pagination, states, double submit, client and server validation, permissions, responsive layout). Each delivery updates the "Implementation status" of the module document.

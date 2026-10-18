---
description: Create a database change (migration) with the full checklist
argument-hint: <what changes in the database>
---

Create the database change: $ARGUMENTS

1. Read `docs/standards/base.md` sections 5.5, 5.6 and 6, `docs/foundations/roles-and-actions.md`, the module document and `docs/technical-architecture-v0.1.md` sections 8–10.
2. Search `supabase/migrations/` for existing tables, functions, actions, error codes and statuses you would otherwise duplicate.
3. Create **one new migration file** named `YYYYMMDDHHMMSS_<module>_<change>.sql` (never edit an applied one) containing, as applicable: tables with composite foreign keys for brand-owned data, RLS enabled and policies combining `has_action(...)` and `can_access_brand(...)`, **no policy for `anon`**, indexes for filters and policies, `updated_at` trigger, immutability triggers where required, transactional functions with `for update` and `version` checks, `audit_write(...)` calls, `notify_users(...)` calls, seeds for actions and notification kinds (`on conflict do nothing`), `raise exception 'code'` for expected failures. No passwords or real personal data.
4. Mirror it in TypeScript: `Action.*` constants, status constants, `AuditAction`, `NotificationKind`, error messages in `errors.ts` (pt-BR), zod schemas for inputs and for `jsonb` outputs.
5. Add pgTAP tests (`supabase/tests/NN_<area>.test.sql`): every relevant role (Owner, role with the action, role without, external user of brand A, external user of brand B, `anon`), swapped ids, immutability, concurrency where applicable.
6. Run (if the tooling exists): `npx supabase db reset`, `npx supabase test db`, `npm run db:types`, `npm run check:consistency`. Report results honestly.
7. Update the documents listed in base.md section 9.2 and the module's "Implementation status".

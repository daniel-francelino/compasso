---
description: Implement a feature end to end following the project standards and the Definition of Done
argument-hint: <what to build, and which module>
---

Implement this feature: $ARGUMENTS

Follow this procedure strictly and report each step briefly:

1. **Read.** Open `docs/README.md`, the module document(s) of the feature (`docs/modules/*.md`, plus linked `spaces/` and `foundations/` documents) and the rule map in `docs/standards/base.md` section 12. List the rule IDs that apply.
2. **Search.** For every concern the feature touches (audit, permissions, errors, lists, forms, dialogs, files, notifications, dates…) find the canonical implementation (base.md section 2) in `src/`, `supabase/` and `docs/`. Say what you will reuse. If something needed does not exist, state it.
3. **Check conflicts.** If the request conflicts with a rule or a document, stop and ask (GOLD-3). Do not continue until it is decided; if a rule changes, update the document first.
4. **Plan.** Write a short plan: files to create/change (right space/module), data changes (migration), permissions/actions, error codes, notification kinds, audit actions, screens and states, tests, documents to update (base.md section 9.2). Any **new name** must be added to the documentation.
5. **Implement** in small steps using the templates in base.md section 5. Database first (migration, RLS, functions, seeds), then server functions, then hooks, then components and routes.
6. **Test.** Add the tests required by the Definition of Done (pgTAP for SQL and permissions, Vitest for rules, Playwright for the main flow when the screen exists).
7. **Verify.** Run the commands of base.md section 11 that exist in the repository. Report exactly what passed, failed or could not be run.
8. **Document.** Update the module document and its "Implementation status" (files, migrations, validation performed, not tested, pending).
9. **Self-review** with the checklist of base.md section 14 (or run `/check-standards`). Finish with the Definition of Done ticked item by item, marking "not applicable" with a reason.

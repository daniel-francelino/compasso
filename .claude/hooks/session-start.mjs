import { readStdin } from "./lib.mjs";

await readStdin();

process.stdout.write(`PROJECT STANDARDS (Aura Creative) — apply them on every task.

Source of truth: AGENTS.md (non-negotiables) > docs/standards/base.md (rules with IDs) > docs/modules, docs/spaces, docs/foundations.
Read docs/README.md for the document map. Work from docs/implementation-plan.md (one task at a time, in order) and read the module document of what you change BEFORE coding.
Look every name up in docs/reference/ (data-model, functions, routes, enums, error-codes) and the glossary docs/standards/ui-glossary.md; a name not found there must be added to the registry first.

Core behavior:
1. One way per concern (base.md section 2). Search the repository for an existing implementation first; extend it. Never create a parallel one (e.g. a second audit table/helper/document).
2. Do not invent names (tables, columns, actions, routes, error codes, tokens). They come from the docs or are added to the docs in the same change.
3. If a request conflicts with a rule or document: STOP, name the rule ID, ask. Rules and docs are changed FIRST (base.md section 9.1); never deviate silently.
4. Docs change with code (base.md section 9.2). Update the module's "Implementation status" honestly (what was and was not tested).
5. Language: docs, files, code, routes, SQL in English; only UI copy in Brazilian Portuguese.
6. Security: permission = role action AND brand link; external users only through portal_* functions; secrets never in files; never read or edit .env files.
7. Finish with the Definition of Done (base.md section 10) and the verification commands (section 11). Say what you did not verify.

Hooks active: a guard blocks edits that break mechanical rules (comments in src, console, any, hex colors, cross-space imports, migration naming, secrets); lint/format run after edits; a final check runs lint, typecheck and check:consistency and asks for the docs update.
Slash commands: /feature, /migration, /check-standards, /sync-docs, /change-rule.
`);

# Aura Creative — instructions for Claude Code

These instructions apply to every session. The project rules are in the two files imported below; read them as binding, not as suggestions.

@AGENTS.md
@docs/standards/base.md

## How to work in this repository

1. **Start every task by reading the right document.** `docs/README.md` is the map; the work is organized in `docs/implementation-plan.md` (take one task, in order). For a module, read `docs/modules/<module>.md` (and the `spaces/` or `foundations/` documents it links). Rule IDs (GOLD-1, CODE-1, SEC-2…) are in `docs/standards/base.md`; cite them when you decide something.
1b. **Look names up in `docs/reference/`** (data model, functions, routes, enums, error codes), plus the action catalog, notification kinds, audit actions and `docs/standards/ui-glossary.md`. A name that is not in a registry must be added there **first**; never invent it in code.
2. **Search before you create** (rule GOLD-2). Look in `src/`, `supabase/` and `docs/` for the existing implementation of the concern (see the table in base.md section 2). Extend it. Never add a second audit table, a second `Result`, a second status list, a second document about the same topic.
3. **Do not invent names** (GOLD-4): tables, columns, actions, routes, error codes, notification kinds, audit actions, tokens, components. If it is not in the documentation, add it to the documentation in the same change.
4. **When the request conflicts with a rule or document, stop** (GOLD-3). Say which rule ID or document, propose the compliant option and the cost of changing the rule, and wait. If the person decides to change the rule: restate the new decision in one line, update the documents first (base.md sections 9.1–9.3), then adapt the code, then remove what became dead. Never deviate silently and never "fix the docs later".
5. **Docs change with the code** (DOC-2, base.md section 9.2). Finish by updating the module's "Implementation status": files and migrations touched, validation actually performed, what was **not** tested.
6. **Smallest coherent change** (GOLD-5): one purpose per change, no drive-by refactors, no unrelated formatting.
7. **Prove it** (GOLD-6): run the commands of base.md section 11 when the tooling exists and report exactly what was and was not run. If a command is unavailable, say so.
8. **Language**: documentation, files, folders, code, routes, SQL in English; UI copy only in Brazilian Portuguese. Talk to the user in the language they use.
9. **Security first** (GOLD-7): never read, print or edit `.env*` files or secrets; never weaken RLS, policies or validation to make something work; external users only read through `portal_*` functions.

## Slash commands

| Command | Use |
|---|---|
| `/feature <description>` | Implement a feature end to end following the standards and the Definition of Done |
| `/migration <description>` | Create a database change with the full checklist (RLS, actions, errors, tests, types) |
| `/check-standards [scope]` | Review the current changes against base.md with the `standards-reviewer` agent |
| `/sync-docs` | Bring the documents in line with the current code and fill the "Implementation status" |
| `/change-rule <rule or decision>` | Change a documented rule or decision the right way (docs first) |

## Automatic checks (hooks in `.claude/settings.json`)

- **SessionStart / UserPromptSubmit** remind these rules at the start and on each prompt.
- **PreToolUse (Write/Edit)** blocks mechanical violations before the file is written: comments in `src`, `console`, `any`, `!`, `as unknown as`, loose `z.enum`, hex colors and Tailwind palette, direct storage access, cross-space imports, misnamed or edited migrations, tables without RLS, secrets, non-English or non-kebab document names. It asks for confirmation when a **new document** is created (DOC-3, DOC-7).
- **PostToolUse** formats with Prettier and lints the edited file (when the tooling is installed) and records what changed.
- **Stop** runs `lint`, `typecheck` and `check:consistency` (when they exist) and reminds you to update the documents if code changed without them.

If a hook blocks you, fix the cause. Do not try to bypass it (no `eslint-disable`, no splitting content to dodge a regex, no editing the hooks to silence them). If a hook is wrong, tell the person and propose the fix to the hook in the same change.

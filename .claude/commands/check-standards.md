---
description: Review the current changes against the project standards
argument-hint: [optional scope: path, module or "all changes"]
---

Use the `standards-reviewer` agent to review the current changes (scope: $ARGUMENTS; if empty, everything changed in the working tree) against `docs/standards/base.md`.

The review must: identify the changed files (git diff when available, otherwise the most recently modified files in `src/`, `supabase/`, `docs/`); check each rule group (GOLD, CODE, DATA, SEC, UI, DOC); look for parallel implementations of anything listed in base.md section 2; verify that new names exist in the documentation; verify that the documents of section 9.2 were updated; and report findings with rule IDs, file and line, severity and a concrete fix.

Then fix the findings that are clearly mechanical, ask about the ones that need a decision (especially anything that would change a rule), and re-run the verification commands that exist.

---
description: Change a documented rule or decision the right way (documents first)
argument-hint: <the rule or decision to change, and why>
---

The person wants to change a documented rule or decision: $ARGUMENTS

Follow `docs/standards/base.md` sections 9.1–9.3:

1. **Restate** the new decision in one line and identify the rule IDs and documents it contradicts.
2. **List the impact**: documents to update (section 9.2), existing code, migrations, tests and hooks (`.claude/hooks/guard-write.mjs`, ESLint rules) that enforce or assume the old rule.
3. **Ask for confirmation** if the change is risky (security, isolation, history preservation) or if a better compliant option exists; give a recommendation.
4. **Update the documents first**: the rule in `docs/standards/base.md` and/or the module document, `AGENTS.md` if it is non-negotiable, `CLAUDE.md` if the workflow changes, and the enforcement (hook, lint rule, `check-consistency`) so that automation and text agree.
5. **Then adapt the code**, and **remove what became dead** (no old and new versions side by side).
6. Report the new rule text, what was changed and what remains to be done.

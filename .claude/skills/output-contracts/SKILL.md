---
name: output-contracts
description: "On-demand Caveman-inspired output contracts rules for Claude Code. Load only when relevant to the task."
---

# Command handoff contracts

Store artifacts only when the task spans sessions or user requests documentation. Prefer existing project conventions and paths; recommended `docs/features/<slug>/` (not created automatically).

Every handoff, when applicable, contains:
- `Goal`: observable outcome.
- `Scope`: included and explicitly excluded.
- `Evidence`: verified facts with file paths/line ranges or executed command.
- `Decisions`: decisions and reasons, not full thought process.
- `Acceptance`: testable checks.
- `Risks/unknowns`: open issues and blockers.
- `Next`: one concrete next step or `done`.

Per command:
- discover: observed workflow, entry points, dependencies, open questions; **no implementation**.
- spec: requirements, non-goals, acceptance; **no code**.
- plan: small tasks, dependencies, gates, owner suggestions, approval status.
- build: changed files, acceptance, commands and results, remaining risks.
- test: matrix, executed tests, exact outcomes, evidence paths, uncovered cases.
- review: prioritized actionable findings with file/line and impact; verdict.
- audit: domains assessed, confirmed vs hypotheses vs unassessed, prioritized backlog.
- debug: reproduction, ranked hypotheses, root-cause evidence, optional authorized fix.
- ship: release gates, rollback considerations, GO/NO-GO/CONDITIONAL GO; **no deploy**.

Do not paste prior reports into later prompts when a short reference and a targeted read suffice.

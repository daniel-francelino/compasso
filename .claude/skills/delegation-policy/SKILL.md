---
name: delegation-policy
description: "On-demand Caveman-inspired delegation policy rules for Claude Code. Load only when relevant to the task."
---

# Delegation policy — main session is the orchestrator

- Only main Claude Code session selects and invokes subagents. A `tech-lead` subagent is a specialist adviser, not a nested orchestrator.
- Prefer no subagent for a simple, low-risk, well-understood change. Do not delegate solely to follow a ritual.
- Delegate only if a specialist adds a distinct decision, independent evidence or necessary execution capability. Avoid repeating the same repo scan across specialists.
- Pass a bounded handoff: objective, scope, known facts, file paths, relevant constraints, acceptance criteria, output format, maximum exploration boundaries.
- Ask each specialist for findings and evidence, not copied full logs or entire files.

Routing examples (conditional, not mandatory):
- Requirements: `business-analyst`, `product-owner`; domain risk: `financial-auditor`, `data-integrity-auditor`.
- Architecture: `software-architect`, `tech-lead` (advisory).
- Implementation: `developer`; performance only if measured risk: `performance-engineer`.
- Tests: `test-designer` for nontrivial scenarios; `test-engineer` to execute; `test-reviewer` when independent assertion review adds value.
- Code review: `code-reviewer`; add `security-analyst` for auth/secrets/exposure; add domain auditors for affected invariants.
- Audit: route to requested domains only; `full` means risk-based breadth, not automatically all agents.

If delegation tool unavailable, do not pretend it ran. State the limitation and continue safely in main session.

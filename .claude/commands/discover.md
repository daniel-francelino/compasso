---
description: Discover an existing codebase, feature, bug, or business workflow before deciding what to change.
---

# /discover

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — area, feature, issue, business process, or question to investigate. If empty, ask for the investigation target.

## Workflow
1. Establish the exact discovery question, scope, and what is already known. Ask a focused question only if proceeding would be misleading.
2. Inspect repository structure, relevant docs, entry points, data flow, APIs, state transitions, tests, and existing conventions. Read narrowly, expanding only when evidence requires it.
3. Select specialists by topic:
   - `business-analyst`: workflows, rules, cross-module behavior.
   - `software-architect`: boundaries, components, dependencies, integrations.
   - `product-researcher`: user needs, alternatives, evidence gaps; external research only if authorized/available.
   - `data-integrity-auditor`, `financial-auditor`, `reporting-analyst`: when those domains are actually involved.
   - `security-analyst`, `performance-engineer`: only when material risks are present.
4. Produce an evidence-backed map of the current behavior and its gaps. Cite repository paths and symbols; label hypotheses.
5. Identify unknowns, constraints, risks, existing tests, and candidate next steps. **Do not implement or select a final solution.**

## Exit gate
- Current behavior and affected boundaries are documented, or explicitly marked unknown.
- Important assumptions and missing evidence are visible.
- A next step is recommended (`/spec`, `/audit`, `/debug`, or no change).

## Output
Discovery summary; current-state workflow; affected files/modules; observed rules and dependencies; evidence; unknowns/risks; recommended next command.

## Restrictions
Read-only. Do not edit code, tests, docs, or Git state.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): investigate-first.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

---
description: Plan a verified, dependency-ordered implementation without changing application code.
---

# /plan

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — approved specification, feature, or change request.

## Workflow
1. Inspect the approved spec and existing implementation. If requirements are unclear, return to `/spec`; do not invent them.
2. Main session consults `tech-lead` for execution strategy and `software-architect` for boundaries and tradeoffs; include `business-analyst` for cross-module rules, `test-designer` for test strategy, and domain auditors only when relevant.
3. Build a dependency graph. Split work into small, vertically testable tasks, each with files likely affected, acceptance criteria, verification, risks, and rollback considerations.
4. Identify tasks that can run independently versus those that must be sequential. Never assign simultaneous writes to the same files.
5. Select appropriate quality gates based on repository scripts and existing tests; avoid arbitrary coverage targets.
6. Present the plan and request approval before starting `/build`. Save only on request or into a confirmed project convention; never overwrite incomplete plans.

## Exit gate
Every task has a clear completion check, dependencies, and an identified validation method. Implementation has not started.

## Output
Architecture decisions; task graph; ordered tasks; specialist involvement; quality gates; checkpoints; risks; open questions; approval request; next step `/build`.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

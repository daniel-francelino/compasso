---
description: Assess release readiness with independent gates and a GO/NO-GO recommendation; do not deploy automatically.
---

# /ship

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — release, branch, change set, or deployment target.

## Workflow
1. Establish the exact release scope, environment, version, and rollback capability.
2. Read applicable project constraints and release procedures; verify current Git state and actual CI/test/build evidence.
3. For meaningful production changes, main session can request independent read-only assessments from `code-reviewer`, `security-analyst`, `test-engineer`, and domain auditors (financial/data) when warranted. Parallelize only independent reads.
4. Consolidate blockers and non-blockers. Check migrations, config/secrets, backwards compatibility, observability, documentation, accessibility, performance, and business acceptance only as applicable.
5. Document rollout and rollback plan, monitoring signals, owners, and remaining risks. Missing evidence is not a pass.
6. Return GO / NO-GO / CONDITIONAL GO with explicit conditions. Any deploy, push, tag, or irreversible action requires a separate explicit instruction.

## Exit gate
Release decision is justified by recorded evidence and a rollback plan.

## Output
Release scope; gate results; blockers; accepted risks; rollout/rollback; monitoring; GO/NO-GO decision.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): verify-and-stop.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

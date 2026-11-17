---
description: Implement an approved task incrementally with targeted tests and verification.
---

# /build

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — approved plan and optional task identifier. Default: one next approved task, not the entire plan.

## Workflow
1. Confirm the approved scope, current Git state, and next task. Stop if existing uncommitted work could be overwritten.
2. Main session delegates implementation to `developer` when useful; `tech-lead` advises on tradeoffs, `software-architect` on major interfaces. Apply relevant implementation skills.
3. For changed behavior, establish a regression test or characterization test where practical; implement the smallest coherent vertical slice.
4. Execute focused checks (typecheck, lint, unit/integration tests, build) using the actual repository commands. Do not bypass failures by deleting tests or suppressing diagnostics.
5. Request `test-engineer` or `code-reviewer` only when complexity/risk warrants independent verification.
6. Report changes, evidence, remaining risks, and the next task. Do not silently start another task or commit.

## Modes
- Default: implement **one** task.
- If `$ARGUMENTS` explicitly requests `all`/`auto`: require an approved plan and explicit authorization for autonomous multi-task execution; pause for high-risk/irreversible actions. Approval of implementation does not imply permission to commit, push, or deploy.

## Exit gate
Acceptance criteria for the selected task are satisfied or blockers are documented; executed checks are reported accurately.

## Output
Files changed; behavior; tests/checks and results; unresolved issues; risks; next task; recommendation `/test` or `/review`.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): lean-build, surgical-patch (only for proven defects), verify-and-stop.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

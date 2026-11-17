---
description: Design, execute, and assess focused tests for a change without overstating coverage.
---

# /test

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — change, feature, files, or test scope.

## Workflow
1. Inspect requirements, changed code, test setup, and existing coverage. Determine what must be demonstrated.
2. Use `test-designer` to define meaningful scenarios when needed; `test-engineer` to implement/run tests; `test-reviewer` to independently evaluate assertion quality and gaps.
3. Cover success, failure, boundaries, authorization, concurrency, and business invariants only where applicable.
4. Run the narrowest meaningful test suite first, then broader regression checks if cost and scope justify it.
5. For browser/E2E tests, minimize screenshots/traces and inspect only failed or necessary evidence. Do not flood the model context with artifacts.
6. Clearly distinguish tests added, tests executed, tests skipped, and areas not verified. Do not modify production code unless separately authorized.

## Exit gate
Every stated pass has command output or another direct observation; untested risks remain visible.

## Output
Test matrix; tests created/changed; commands executed; pass/fail/skipped; coverage limitations; regressions; next step `/review` or `/debug`.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): verify-and-stop.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

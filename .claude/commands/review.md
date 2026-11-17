---
description: Perform independent code and behavior review, prioritizing evidence-backed findings.
---

# /review

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — diff, commit, PR, or target module. Default: current working-tree diff.

## Workflow
1. Inspect exact change scope and its requirements. Check Git status without changing it.
2. Prefer `code-reviewer` as primary specialist; include `security-analyst`, `data-integrity-auditor`, `financial-auditor`, `performance-engineer`, `business-analyst`, or `test-reviewer` only for relevant risks.
3. Parallelize independent read-only reviews when valuable. Main session deduplicates findings and reconciles conflicting conclusions.
4. Focus on correctness, regressions, business invariants, security, maintainability, architecture, test adequacy, and performance where relevant.
5. For each actionable finding, provide severity, exact file/line or symbol, evidence, impact, and proposed fix. Avoid invented issues and style-only noise.
6. Summarize checks actually run; report unverified areas.

## Exit gate
Findings are prioritized and grounded. No production changes or commits.

## Output
Blocking findings; non-blocking recommendations; verified checks; open risks; verdict `APPROVED`, `CHANGES REQUIRED`, or `INSUFFICIENT EVIDENCE`.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): verify-and-stop.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

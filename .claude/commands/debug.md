---
description: Investigate and fix a reproducible defect using root-cause analysis and regression checks.
---

# /debug

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — bug symptoms, failing test, logs, or error. Ask for one essential reproduction detail only if needed.

## Workflow
1. Record expected vs actual behavior, reproduction steps, and environment; inspect existing errors and relevant files.
2. Reproduce safely, then isolate the smallest failing path. Use `developer` for technical diagnosis, `business-analyst` for rule mismatches, `data-integrity-auditor` for corrupt states, and `performance-engineer` for latency issues only when relevant.
3. Form and test hypotheses. Do not patch symptoms without identifying a plausible cause.
4. If authorized to fix, add a targeted regression test where practical and apply the smallest correction.
5. Run targeted checks and report actual results. If reproduction requires production data or destructive action, stop and seek authorization.

## Modes
- Default: diagnose and propose a fix; implement only when the request explicitly asks to fix.
- Read-only when the user requests investigation only.

## Exit gate
Root cause is evidenced or uncertainty explicitly reported; any fix has regression verification.

## Output
Reproduction; root-cause evidence; affected code; fix (if authorized); tests and results; residual risks; next step `/review`.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): investigate-first, surgical-patch (when authorized), verify-and-stop.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

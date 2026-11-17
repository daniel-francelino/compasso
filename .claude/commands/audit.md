---
description: Run a risk-based, read-only audit of code, business processes, security, data, finances, reporting, or operations.
---

# /audit

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — audit target and optionally domains (`security`, `financial`, `data`, `business`, `reporting`, `performance`, `seo`, `geo`, `marketing`, `customer-success`, `full`). If no target is supplied, ask for it. `full` means broad scoping, not automatic exhaustive scans.

## Workflow
1. Define audit objective, systems in scope, period/environment (if relevant), risk tolerance, and evidence availability. Identify what is out of scope.
2. Select specialists based on domain:
   - `security-analyst`: authorization, exposure, dependencies, secrets.
   - `financial-auditor`: calculations, balances, reconciliation, payment flows.
   - `data-integrity-auditor`: invariants, relationships, migrations, concurrency.
   - `business-analyst`: process rules, cross-module consistency.
   - `reporting-analyst`: metric definitions, aggregation, reporting accuracy.
   - `performance-engineer`: profiling, budgets, bottlenecks.
   - `seo-specialist` / `geo-specialist`: search and AI-discovery readiness.
   - `marketing-strategist` / `customer-success-specialist`: funnel, retention, experience.
   - `software-architect`: architectural/systemic risks.
3. Create a risk-ranked audit checklist and inspect available evidence. Use safe, read-only commands; no destructive probes, external scans, or production access without explicit authorization.
4. Where useful, run independent read-only specialists in parallel and consolidate findings in the main session.
5. Separate **confirmed findings** from **potential risks** and **not assessed**. For every confirmed finding, provide evidence, severity, affected asset/process, impact, and remediation.
6. Produce prioritized remediation work, validation strategy, and recommended next command (`/spec`, `/plan`, `/test`, or `/review`).

## Exit gate
Scope and evidence limitations are explicit. Audit does not claim certification, full coverage, or regulatory compliance without a valid basis.

## Output
Executive summary; scope/method; risk matrix; confirmed findings with file/line or evidence; hypotheses; unassessed areas; prioritized remediation backlog; verification plan.

## Restrictions
Read-only. No fixes, mutations, commits, migrations, or deployment.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- Skills (load only if needed): investigate-first (only for unresolved findings).
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

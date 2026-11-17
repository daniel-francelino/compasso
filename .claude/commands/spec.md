---
description: Define requirements and acceptance criteria for a feature using evidence from discovery.
---

# /spec

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Delegate only when a specialist adds distinct value; otherwise work directly.
- Discovery: `graphify query/explain/path` first when graphify-out/graph.json exists; then targeted reads to verify.
- Concise output. Never claim a check passed without running it.
- No commit/push/deploy/destructive action or overwriting unrelated work without explicit authorization.
- If an agent/skill is unavailable, say so and use the smallest safe fallback.

## Inputs
`$ARGUMENTS` — feature/request and optional discovery report. Do not treat unverified assumptions as confirmed requirements.

## Workflow
1. Read existing discovery notes, issue details, project rules, and related code. For unfamiliar or ambiguous current behavior, run the `/discover` workflow first (or request it).
2. Use `product-owner` for outcomes, priorities, scope, and acceptance criteria; `business-analyst` for business rules; `product-researcher` only when research is required; `customer-success-specialist` when onboarding/support/adoption is affected.
3. Invite `software-architect` or `security-analyst` only to surface feasibility, constraints, and non-functional requirements, not to prematurely implement.
4. Define goals, users, in-scope/out-of-scope, scenarios, invariants, dependencies, non-functional requirements, risks, and measurable acceptance criteria.
5. Identify unresolved decisions and ask for confirmation when they materially change the specification.
6. Present a proposed spec. Save it to a user-approved path only if asked; never overwrite an existing specification without confirmation.

## Exit gate
Requirements are testable, scope boundaries explicit, and unresolved decisions clearly labeled. No code changes.

## Output
Problem; objective; current-state evidence; user stories/scenarios; functional and non-functional requirements; exclusions; acceptance criteria; dependencies; risks; open questions; next step `/plan`.

## Execution

- Load `delegation-policy` / `output-contracts` skills only when coordinating or writing handoffs.
- No repo-wide scans or redundant delegation; stop when acceptance and required checks pass.

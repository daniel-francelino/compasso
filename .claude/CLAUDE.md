# Project Engineering Instructions

## Mission

Build reliable, secure, maintainable software using the minimum effective context, agents, tools, and changes.

Priorities, in order:

1. Business correctness.
2. Security and data integrity.
3. Functional correctness.
4. Simplicity and maintainability.
5. Risk-appropriate testing.
6. Evidence-based performance.
7. Token and resource efficiency.

Follow existing project architecture, conventions, and business rules. Never assume a specific technology stack.

## 1. Core Principles — Caveman

Apply to all tasks:

- **Investigate First:** Understand the problem and gather evidence before modifying code.
- **Lean Build:** Implement only what is required. Reuse existing patterns; avoid speculative features and unnecessary abstractions.
- **Surgical Patch:** Fix confirmed defects with minimal changes. Preserve unrelated behavior.
- **Safe Refactor:** Preserve contracts and observable behavior unless changes are explicitly requested.
- **Progressive Context:** Search before reading. Load only relevant files, skills, and documentation.
- **Smart Delegation:** Use the fewest specialists necessary. Avoid redundant investigations and excessive handoffs.
- **Efficient Execution:** Prefer focused commands, bounded output, and the cheapest reliable validation.
- **Verify and Stop:** Validate acceptance criteria, report results, and stop without unnecessary additional work.

Correctness, security, and data integrity always take precedence over token savings.

Use the corresponding Caveman skills on demand. Do not preload all skills or duplicate their detailed instructions here.

The Caveman runtime is optional and separate from its skills. Never assume compression, routing, or telemetry controls are active without verification.

## 2. Agent Orchestration

Agents are defined in `.claude/agents/`. The main Claude Code session coordinates execution and delegation. Use only existing, available agents.

- **Leadership:** `product-owner` (requirements, priorities, backlog, roadmap); `product-researcher` (market, competitors, opportunities); `tech-lead` (complex planning, coordination, delivery).
- **Engineering:** `business-analyst` (business rules, workflows); `software-architect` (architecture, significant design decisions); `developer` (implementation, refactoring); `code-reviewer` (independent code review); `test-designer` (scenarios, acceptance criteria); `test-engineer` (test implementation and execution); `test-reviewer` (independent test quality review).
- **Specialists:** `security-analyst`, `financial-auditor`, `data-integrity-auditor`, `reporting-analyst`, `performance-engineer`, `geo-specialist`, `marketing-strategist`, `seo-specialist`, `customer-success-specialist`, `ux-ui-designer` (layout and refactor plans; skill `ui-ux-pro-max`; `/design-plan`), `design-review` (reviews a running screen in a browser; `/design-review`).

Delegation rules:

- **Simple:** Execute directly or use one specialist.
- **Moderate:** Delegate only when expertise adds value.
- **Complex:** Use `tech-lead` when coordination is necessary.
- **Critical:** Require relevant specialist analysis, appropriate validation, and independent review.

Do not invoke every agent automatically. Provide concise handoffs containing objective, scope, constraints, relevant references, and acceptance criteria. Do not simulate agent execution or assume subagents can delegate further.

## 3. Development Workflow

Commands are defined in `.claude/commands/`:

- `/discover`: investigate context and requirements.
- `/spec`: define requirements and acceptance criteria.
- `/plan`: plan implementation.
- `/build`: implement changes.
- `/test`: validate behavior.
- `/review`: review code independently.
- `/audit`: perform specialist audits.
- `/debug`: diagnose and fix defects.
- `/ship`: evaluate delivery readiness.

Use the smallest workflow appropriate to the task. Do not require every phase for simple changes.

Research findings are not automatically approved requirements. Significant product decisions require stakeholder approval.

## 4. Graphify — Codebase Intelligence

Graphify provides a local knowledge graph at `graphify-out/`.

- **Skill:** `.claude/skills/graphify/SKILL.md`. **Command:** `/graphify`. When the user explicitly invokes `/graphify`, follow the installed Graphify skill before performing other work. Do not duplicate its instructions here.

When `graphify-out/graph.json` exists and is current:

- Prefer `graphify query "<question>"` before broad codebase searches.
- Use `graphify explain "<concept>"` for focused component analysis and `graphify path "<A>" "<B>"` for dependencies and relationships.
- Read source files directly to verify implementation details and critical behavior.
- Use `GRAPH_REPORT.md` only for broad architecture reviews.
- Fall back to targeted source searches when the graph is missing, outdated, incomplete, or insufficient.

Agent integration:

- Code-oriented agents should use Graphify when it materially improves discovery or impact analysis.
- The `tech-lead` may use the graph to identify affected modules and coordinate specialists.
- Do not require unrelated agents to query the graph.
- Include Graphify guidance in subagent handoffs only when relevant.
- Reuse existing graph results instead of repeating queries.

Graph maintenance:

- Prefer incremental `graphify update .` after meaningful code changes when fresh graph information is needed. Avoid rebuilding after every file modification.
- Do not generate visualizations or reports unnecessarily. Follow existing Git conventions for generated artifacts.

Source code and verified documentation remain authoritative. Inferred graph relationships are not proof of actual behavior. Graphify complements Caveman's progressive context principles; neither replaces source verification.

## 5. Engineering Standards

**Architecture:**

- Follow existing patterns and conventions.
- Prefer focused, incremental changes.
- Reuse established utilities and components.
- Avoid unnecessary dependencies, abstractions, and unrelated refactoring.
- Preserve existing contracts unless changes are authorized.

**Business and financial integrity:**

- Never invent business rules.
- For critical calculations, verify formulas, rounding, transaction states, reversals, and affected modules.
- Preserve historical correctness and auditability.
- Do not confuse revenue, received cash, and profit.

**Security:**

- Never expose secrets, bypass authorization, or access production data without permission.
- Preserve tenant isolation across queries, APIs, caches, jobs, and reports.
- Require explicit authorization for destructive operations.

**Testing:**

- Use the cheapest reliable test layer: unit, integration, API, then E2E for critical workflows.
- Run focused tests first. Broaden validation according to risk.
- Never weaken assertions or claim tests passed without execution.
- For important changes, separate implementation from independent review.

**Performance:**

- Optimize measured bottlenecks rather than speculative problems.
- Never sacrifice correctness, security, or data integrity for performance.

## 6. Context and Token Efficiency

- Search before reading entire files. Load skills and documentation only when needed.
- Avoid repeated exploration of unchanged code. Prefer scoped Graphify queries when useful.
- Keep tool output concise without hiding errors. Avoid unnecessary screenshots, traces, and verbose logs.
- Reuse existing documentation and findings. Parallelize only independent tasks.
- Avoid repeated agent reviews without relevant changes. Stop researching when sufficient evidence supports a decision.

Store durable findings in project documentation rather than relying exclusively on conversation history. Do not claim automatic session clearing or compaction unless actually performed.

## 7. Documentation

Follow existing documentation conventions. Default directories when no convention exists: product `docs/product/`; business `docs/business/`; architecture `docs/architecture/`; engineering `docs/engineering/`; testing `docs/testing/`; code reviews `docs/reviews/code/`; security `docs/security/`; financial audits `docs/financial/audits/`; data integrity `docs/data-integrity/audits/`; reporting `docs/reporting/audits/`; performance `docs/performance/audits/`.

Create documentation only when necessary or explicitly requested. Do not duplicate existing reports. Preserve finding identifiers and distinguish verified evidence from hypotheses.

## 8. Git and Change Safety

- Inspect relevant existing changes before editing. Preserve unrelated user modifications.
- Limit changes to the requested scope. Never reset unrelated work.
- Never force-push or rewrite shared history without approval.
- Never commit, deploy, or run destructive commands without authorization.

## 9. Completion Contract

Before declaring completion: confirm requirements were addressed; verify relevant behavior and business rules; run appropriate validation; resolve blocking findings; identify remaining risks or limitations.

Final responses briefly report what changed, relevant files, validation actually performed, and remaining blockers or risks. Never invent results, tests, agent executions, or completed work.

---

## Fundamental Principle

**Investigate first. Build lean. Patch surgically. Load context progressively. Delegate selectively. Verify and stop.**

Quality must be proportional to risk. Coordination must reduce work, not create overhead.

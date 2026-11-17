---
description: Plan a screen or component layout refactor (target layout, Nuxt UI components, states, accessibility, preserved gates) before implementing it.
argument-hint: <screen or component path> [goal, e.g. "denser table, mobile cards"]
---

# /design-plan

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Use the `ux-ui-designer` subagent. It plans and specifies; it does not edit application code, tests or configuration.
- Guidelines come from `.claude/skills/ui-ux-pro-max/data/stacks/nuxt-ui.csv` (and `ux-guidelines.csv`), read with Grep/Read. Do not run the skill's Python scripts unless the user authorizes it in this session.
- Product decisions (who sees what, new behavior) are listed as open questions, never invented.

## Task

Target: $1
Goal (optional): $2

1. If no target was given, ask which screen or component to plan.
2. Delegate to `ux-ui-designer` with the target and goal. Ask it to answer in chat; save to `docs/design/<screen>-refactor.md` only if the user asked for the document.
3. When the plan is approved, implementation goes to the `developer` agent in small steps (one screen region per change), then `/design-review` on the running screen. The refactor must keep API calls, business rules and every permission gate unchanged, and every `.vue` that uses `ActionCode.` must import it from `~/constants/action-codes`.

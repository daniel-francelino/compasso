---
description: Review a running screen in a real browser across viewports (responsive, interaction, WCAG AA) and return ranked findings.
argument-hint: <url> [storage-state-file] [focus, e.g. "mobile nav"]
---

# /design-review

## Operating contract

- Runs in the main session; subagents never spawn subagents. Follow CLAUDE.md.
- Use the `design-review` subagent. It does not modify code.
- Needs the app running (`npm run dev`, with the local Supabase stack for logged-in screens) and, for screens behind login, a local Playwright storage-state file (never committed; the audit output lives in `.design-audit/`, which is git-ignored).
- The audit script is `.claude/tools/design-audit.mjs` (project Playwright). Do not install packages or browsers, and do not run third-party scripts other than that one, without the user's authorization.
- Never claim a screen was reviewed if the browser could not open it: say so and report only what was possible.

## Task

Target: $1
Storage state (optional): $2
Focus (optional): $3

1. If no target was given, ask for the dev-server URL and which role the session belongs to.
2. Delegate to `design-review` with the target, the storage state and the focus.
3. Fix nothing yourself. If blockers or high findings exist, summarize them and propose handing the fixes to the `developer` agent, keeping every permission gate (`workshop.can(ActionCode.X)`) and every `ActionCode` import intact.

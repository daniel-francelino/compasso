# Aura Creative documentation

Documentation, folder names and file names are in **English**; only the user interface copy is in Brazilian Portuguese. The rules of the project are in [../AGENTS.md](../AGENTS.md) and prevail over any document.

Start with the [product document](product-documentation-v0.1.md) (what we are building) and the [technical architecture](technical-architecture-v0.1.md) (how). To **build**, follow the [implementation plan](implementation-plan.md) task by task, applying [standards/base.md](standards/base.md) and looking every name up in the [registries](reference/README.md). The documents below detail each area.

**Open items that need a person (accounts, Docker, decisions) and what is still unverified:** [pending-external-setup.md](pending-external-setup.md).

**Reading order for an implementation task:** `implementation-plan.md` (the task) → the module document → `standards/base.md` rules that apply → `reference/*` registries (names) → `standards/ui-glossary.md` (copy).

## Folders

| Folder | What it contains | Documents |
|---|---|---|
| `standards/` | Rules the code and the interface must follow | [Base](standards/base.md) (the rulebook, with rule IDs), [Back office layout](standards/admin-layout-and-standards.md), [Design system](standards/design-system.md), [Color palette](standards/color-palette.md), [Project structure](standards/project-structure.md), [UI glossary (pt-BR)](standards/ui-glossary.md) |
| `reference/` | **Registries**: the exact names of tables, functions, routes, statuses, error codes (look names up here; never invent) | [Index](reference/README.md), [Data model](reference/data-model.md), [Functions](reference/functions.md), [Routes](reference/routes.md), [Enums and keys](reference/enums.md), [Error codes](reference/error-codes.md) |
| `foundations/` | What sits under everything: accounts, permissions and alerts | [Authentication](foundations/authentication.md), [Roles and actions](foundations/roles-and-actions.md), [Notifications](foundations/notifications.md) |
| `spaces/` | The spaces and cross-cutting services | [R2 storage](spaces/r2-storage.md), [Media Library](spaces/media-library.md), [Site and CMS](spaces/cms-site.md), [CMS model](spaces/cms-dynamic-architecture.md), [Public site delivery](spaces/public-site-delivery.md) |
| `modules/` | Functional specifications of each module | [Index](modules/README.md), [Clients](modules/clients.md), [Brands](modules/brands.md), [Channels](modules/channels.md), [Content](modules/content.md), [Instagram publishing](modules/instagram-publishing.md), [Metrics and reports](modules/metrics.md), [Approvals](modules/approvals.md), [Calendar](modules/calendar.md), [Dashboard](modules/dashboard.md), [Client Portal](modules/portal.md), [Organization and settings](modules/organization-settings.md), [Audit](modules/audit.md) |
| `audits/` | Findings and correction plans, with the status of each | [Video upload in the media library](audits/media-video-upload.md), [Landing page performance](audits/landing-performance.md) |
| `history/` | Early planning and old diagnostics; they do not necessarily describe the current state | Created when needed |

## Working with Claude Code

`CLAUDE.md` imports `AGENTS.md` and `standards/base.md`, so the rules are in context on every session. `.claude/settings.json` wires hooks that block mechanical violations before a file is written, format and lint after edits, and check lint, typecheck, consistency and the documentation update before finishing. Slash commands: `/feature`, `/migration`, `/check-standards`, `/sync-docs` and `/change-rule`. If a rule changes, the document and the hook that enforces it change together (`standards/base.md`, section 9).

## How to read the documents

| Type | Meaning |
|---|---|
| Specifications (`modules/`, `spaces/`) | Intended behavior; not proof of implementation. Each states "Implementation status" |
| Foundations (`foundations/`) | The model and its rules; the executable source is the migrations and the code |
| Standards (`standards/`) | Rules the code must follow; the ones ESLint enforces are wired in `eslint.config.js` |
| Audits (`audits/`) | A photograph of a date, with a plan and status of the fixes |

## Current status

The project is in the documentation and design phase; there is no application code yet. Next step: phase 0 of the plan in `technical-architecture-v0.1.md` (section 23).

## Maintenance rule

Each delivery updates the status, lists the files and migrations involved and records the validation performed, distinguishing external pending items. A proposal that changes another module must also update that module's contract and acceptance criteria. New migrations are checked against these rules without automatically treating code differences as accepted business decisions.

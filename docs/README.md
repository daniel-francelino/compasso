# Compasso documentation

Documentation, folder names and file names are in **English**; only the user interface copy is in Brazilian Portuguese. The rules of the project are in [../AGENTS.md](../AGENTS.md) and prevail over any document.

Start with the [product document](product-documentation-v0.1.md) (what we are building) and the [technical architecture](technical-architecture-v0.1.md) (how). The documents below detail each area.

## Folders

| Folder | What it contains | Documents |
|---|---|---|
| `standards/` | Rules the code and the interface must follow | [Base](standards/base.md), [Back office layout](standards/admin-layout-and-standards.md), [Design system](standards/design-system.md), [Color palette](standards/color-palette.md), [Project structure](standards/project-structure.md) |
| `foundations/` | What sits under everything: accounts, permissions and alerts | [Authentication](foundations/authentication.md), [Roles and actions](foundations/roles-and-actions.md), [Notifications](foundations/notifications.md) |
| `spaces/` | The spaces and cross-cutting services | [R2 storage](spaces/r2-storage.md), [Media Library](spaces/media-library.md), [Site and CMS](spaces/cms-site.md), [CMS model](spaces/cms-dynamic-architecture.md), [Public site delivery](spaces/public-site-delivery.md) |
| `modules/` | Functional specifications of each module of Marketing Management and the portal (clients, brands, channels, content, approvals, calendar, dashboard, portal) | To be written as each module is designed |
| `audits/` | Findings and correction plans, with the status of each | Created when there is something to audit |
| `history/` | Early planning and old diagnostics; they do not necessarily describe the current state | Created when needed |

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

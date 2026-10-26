# Compasso — Modules

Functional specification of the modules of Compasso, written before implementation. These documents guide the work; they do not describe features that are already available (each has an "Implementation status" section that is updated with every delivery). The technical foundations are in [../technical-architecture-v0.1.md](../technical-architecture-v0.1.md); the product scope is in [../product-documentation-v0.1.md](../product-documentation-v0.1.md). UI texts are Brazilian Portuguese; everything else is English.

## Modules

| Module | Space | Responsibility | Document |
|---|---|---|---|
| Clients | `marketing` | Commercial clients, contacts, internal owner, history | [clients.md](clients.md) |
| Brands | `marketing` | Brands of a client, identity, time zone, members and access | [brands.md](brands.md) |
| Channels | `marketing` | Profiles/destinations of a brand (Instagram, LinkedIn…) | [channels.md](channels.md) |
| Content | `marketing` | Content (one content for several channels), immutable versions, internal comments, manual publication, ideas and dates that convert into contents | [content.md](content.md) |
| Content publication | `marketing` | Proposal: the `published` state and the storage clean-up that keeps only previews | [content-publication.md](content-publication.md) |
| Instagram publishing | `marketing` + `shared` | Connect an Instagram account in the channel, publish approved contents automatically, collect the account history | [instagram-publishing.md](instagram-publishing.md) |
| Metrics and reports | `marketing` + `portal` (shared components) | Growth charts of a brand's social network and curated reports the manager sends to the client | [metrics.md](metrics.md) |
| Approvals | `marketing` (request) + `portal` (decision) | Approval requests, decisions, history, deadlines | [approvals.md](approvals.md) |
| Calendar | `marketing` + `portal` (shared components) | Editorial calendar, deadlines, rescheduling, time zones | [calendar.md](calendar.md) |
| Dashboard | `marketing` | Work overview: what needs attention, what is coming | [dashboard.md](dashboard.md) |
| Client Portal | `portal` | External experience: pending items, calendar, approval, comments | [portal.md](portal.md) |
| Organization and settings | `shared` | Organization data, defaults, users, roles, invitations | [organization-settings.md](organization-settings.md) |
| Audit | `shared` | Business audit trail and its screen | [audit.md](audit.md) |

Modules documented elsewhere (they are cross-cutting, not owned by one space):

| Module | Document |
|---|---|
| Media Library | [../spaces/media-library.md](../spaces/media-library.md), [../spaces/r2-storage.md](../spaces/r2-storage.md) |
| Site and CMS | [../spaces/cms-site.md](../spaces/cms-site.md), [../spaces/cms-dynamic-architecture.md](../spaces/cms-dynamic-architecture.md), [../spaces/public-site-delivery.md](../spaces/public-site-delivery.md) |
| Accounts and invitations | [../foundations/authentication.md](../foundations/authentication.md) |
| Roles and actions | [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md) |
| Notifications | [../foundations/notifications.md](../foundations/notifications.md) |

## How the modules relate

```
Organization ─▶ Client ─▶ Brand ─▶ Channel
                           │          │
                           ▼          ▼
                    Content ─▶ Channel rows (channel + format + date)
                       │
                  Version (immutable) ◀── Media versions (immutable)
                                       │
                          Approval request ─▶ Decision ─▶ approved / changes requested
                                       │
                          Calendar (planned date, deadlines) · Manual publication record
```

Brand is the isolation boundary: almost everything below the brand carries `brand_id`, and a user only acts on the brands they are linked to (see [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md)).

## Shared conventions

- **Isolation:** effective permission = role action **and** brand link. External users never read internal tables; they use the `portal_*` functions.
- **History is preserved:** archive instead of delete; revisions, decisions and audit events are immutable.
- **Dates:** instants in UTC plus the IANA time zone of the brand; deadlines as local dates; formatting through `src/lib/shared/format.ts`.
- **Lists:** pagination, search and filters on the server, kept in the URL; states skeleton → error → empty → no results → list.
- **Forms:** zod on client and server, optimistic locking by `version`, no double submit, unsaved-changes warning.
- **Errors:** SQL raises `raise exception 'code'`; `errors.ts` maps each code to a pt-BR message; `check:consistency` verifies both sides.
- **Automatic publishing only where a channel is connected:** "planned" is an editorial date; it becomes a promise only for a channel row set to publish automatically on a connected Instagram channel ([instagram-publishing.md](instagram-publishing.md)). Everywhere else, and for every manual record, no social network is called.
- **Language:** routes, code, tables and docs in English; UI texts in Brazilian Portuguese.

## Order of implementation

Follows the phases of the technical architecture (section 23): Organization and settings, Audit base and accounts (phase 0–1); Clients, Brands, Channels (phase 1); Media Library (phase 2); Content, Approvals and Client Portal (phase 3); Calendar (phase 4); Site and CMS (phase 5); Dashboard grows with each phase and is completed in phase 3–4.

## Documentation rule

Each delivery updates the "Implementation status" of the module, lists files and migrations, records the validation performed and separates external pending items. A proposal that changes another module also updates that module's contract and acceptance criteria. New permissions appear in [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md) in the same change.

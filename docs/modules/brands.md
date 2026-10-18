# Module — Brands

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (`/admin/marketing/brands`). The brand is the **isolation boundary** of the system.

## Goal and scope

A brand is the unit of identity and editorial planning ("Café Aurora"). It belongs to one client, has zero or more channels, and owns content, approvals, files and members. Everything below the brand carries `brand_id`; a user only acts on the brands they are linked to.

Included: register, identity and guidelines, time zone, members and external access, archive, brand context navigation. Not included in the MVP: brand-level reports, billing, asset kits with versioned brand books.

## Brand record

| Field | Rule |
|---|---|
| Name | Required; 2–120 characters |
| Client | Required; a brand never changes client in the MVP (moving requires a controlled operation later) |
| Description | Optional; what the brand is |
| Target audience | Optional |
| Tone of voice | Optional; guidance for the team |
| Objectives | Optional |
| References | Optional notes and links |
| Visual identity | Optional structured data: logos (media usages), brand colors (names and hex **as data**, not UI tokens), fonts (names), link to guidelines |
| Time zone | Required IANA zone; default from the organization; used by the calendar, deadlines and scheduling |
| Status | Active or archived |
| Created / updated / by | Audit stamps |

Brand identity logos and guideline files come from the Media Library (`brand_identity` usages). Brand colors stored as data are **not** the Compasso palette tokens: they exist to inform the team and to render previews.

## Members and access

A brand has members (`brand_members`):

| Field | Meaning |
|---|---|
| User | An existing approved account |
| Kind | `internal` (team) or `external` (client user) — must match the user's profile kind |
| `can_decide` | External only: may decide approvals designated to them |
| Status | `active` or `revoked` (history kept) |
| Granted by / at, revoked at | Audit data |

Rules:

- Belonging to the team **does not** give access to every brand: the Owner sees all; everyone else needs an active internal link.
- A brand must keep at least one active internal member who can manage it, or be managed by the Owner.
- Revoking a link takes effect immediately for new operations; signed file URLs already issued expire on their own within minutes.
- The designated approver of a pending request must stay an active external member with `can_decide`; revoking them blocks the pending decision (the request keeps its history and shows "Aprovador sem acesso", requiring a new designation).
- Granting access to an external user happens through **invitations** (see [../foundations/authentication.md](../foundations/authentication.md)) or by linking an existing external account; both need `brands.manage_members`.

## Screens and flows

Routes: `/admin/marketing/brands`, `/admin/marketing/brands/new`, `/admin/marketing/brands/$brandId` with tabs.

- **List:** brand, client, channels, status, pending approvals, next planned post. Filters by client, status and channel platform. Main action "Nova marca" (needs a client; offers to create one).
- **Brand context:** once a brand is open, the header shows the brand and a switcher; the URL carries it (`/brands/$brandId/...`). Tabs: **Visão geral**, **Canais** ([channels.md](channels.md)), **Conteúdos** ([content.md](content.md)), **Calendário** ([calendar.md](calendar.md)), **Aprovações** ([approvals.md](approvals.md)), **Biblioteca** (filtered to the brand), **Membros**, **Identidade**, **Configurações**.
- **Overview:** pending approvals, content by status, next deadlines, recent activity, members count, channels with their status.
- **Members tab:** table of members with kind, `can_decide`, status; actions "Convidar", "Adicionar membro existente", "Alterar permissão de decisão", "Revogar". External members are shown with an "Externo" badge.
- **Identity tab:** form with guideline fields and the logo/asset picker.
- **Settings tab:** name, time zone, archive/reactivate.
- **Archive:** blocks new content and new planning; keeps all history; active channels and pending approvals are listed first and must be resolved or explicitly cancelled. A brand with approved but unpublished variants warns before archiving.

## Rules

1. A brand is unique by name within the same client (case-insensitive).
2. Changing the time zone affects **future** planning conversions only; existing instants keep their stored instant and zone. The interface warns and shows the effect on planned items.
3. A brand with content, revisions or files cannot be deleted; it is archived. A brand with nothing may be deleted by `brands.delete`.
4. All reads and writes check `can_access_brand(brand_id)`; external members never read the brand tables, only `portal_*` functions.
5. Every member change is audited (`brand.member_added/revoked/can_decide_changed`).
6. Optimistic locking by `version`.

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

`brands` and `brand_members` as in [../reference/data-model.md](../reference/data-model.md) section 4 (composite FK `(client_id, organization_id)`; `check (kind = 'external' or not can_decide)`; index `(user_id, brand_id) where status = 'active'`). Subordinate tables carry `brand_id` with composite foreign keys so nothing crosses brands.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `brands.view` | List and open brands the person is linked to | — |
| `brands.create` | Create brands (requires client access) | `brands.view`, `clients.view` |
| `brands.update` | Edit identity, time zone, archive/reactivate | `brands.view` |
| `brands.delete` | Delete an empty brand | `brands.update` |
| `brands.manage_members` | Add, revoke members and change `can_decide` | `brands.update` |

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`brand_name_taken`, `brand_not_empty`, `member_kind_mismatch`, `last_internal_member`, `approver_without_access`, `conflict`, `denied`.

## Acceptance criteria

- A client with two brands keeps content, channels and files separate; a user linked to brand A cannot see brand B (UI, API or direct RLS query, even by swapping IDs).
- An external member of brand A cannot read any table of brand B nor receive a signed URL for its files.
- Revoking a link blocks new operations immediately; the history stays.
- Changing the time zone does not alter stored instants of existing variants.
- Archiving a brand with pending approvals shows them and requires explicit resolution.
- Members with `kind` different from their profile kind are refused by the database.


## Implementation status

Phase 1 (task P1-03/P1-05, 2026-10-18). Same migrations and tests as [clients.md](clients.md); `src/lib/marketing/brands/*`, `src/components/marketing/brands/*`; routes `/admin/marketing/brands`, `/new`, `/$brandId` with tabs overview, channels, members, identity, settings.

Done: list, create, overview, members (add existing, invite, decision right, revoke, last-internal-member rule), identity (guidelines text, colors and fonts as data, guidelines link), settings (name, time zone with warning, archive, delete). Validation performed: SQL assertions (isolation between brands, external users read nothing, time zone change audited). **Not tested**: real Supabase, browser. Also done after the first pass: brand switcher in the header (URL-based, "Todas as marcas"), list filters by client and platform. **Not done**: the "pending approvals" and "next planned post" columns and the archive pre-check of pending approvals (they depend on the content and approvals tables of phase 3; `brand_has_history` and the approver check are placeholders until then).
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
| Logo | Optional image of the brand's own library scope (`brands.logo_media_version_id`); shown as the **avatar** of the brand everywhere (lists, header, selects, sidebar); without one the avatar shows the initials |
| Time zone | Required IANA zone; default from the organization; used by the calendar, deadlines and scheduling |
| Status | Active or archived |
| Created / updated / by | Audit stamps |

Brand identity logos and guideline files come from the Media Library (`brand_identity` usages). Brand colors stored as data are **not** the Aura Creative palette tokens: they exist to inform the team and to render previews.

## Members and access

A brand has members (`brand_members`):

| Field | Meaning |
|---|---|
| User | An existing approved account |
| Kind | `internal` (team) or `external` (client user) — must match the user's profile kind |
| `can_decide` | External only: may decide the approvals of the brand (planning and art). Every member with it is an approver and is asked when something is sent |
| Status | `active` or `revoked` (history kept) |
| Granted by / at, revoked at | Audit data |

Rules:

- Belonging to the team **does not** give access to every brand: the Owner sees all; everyone else needs an active internal link.
- A brand must keep at least one active internal member who can manage it, or be managed by the Owner.
- Revoking a link takes effect immediately for new operations; signed file URLs already issued expire on their own within minutes.
- Revoking `can_decide` or the link of an approver takes effect on their next decision. Pending requests are not orphaned: they stay open for the other approvers, and the team sees a warning when nobody is left ("Ninguém pode aprovar esta marca agora").
- Granting access to an external user happens through **invitations** (see [../foundations/authentication.md](../foundations/authentication.md)) or by linking an existing external account; both need `brands.manage_members`.

## Screens and flows

Routes: `/admin/marketing/brands`, `/admin/marketing/brands/new`, `/admin/marketing/brands/$brandId` with tabs.

Brand detail routes use the full available content width. The content and calendar tabs follow the same full-width layout as their standalone screens. During navigation, the current layout width stays in place until the brand detail route and its brand data are ready.

- **List:** brand, client, channels, status, pending approvals, next planned post. Filters by client, status and channel platform. Each row has a three-dot actions menu for opening the brand, editing its settings, archiving/reactivating and deleting when permitted. Main action "Nova marca" (needs a client; offers to create one).
- **Brand context:** once a brand is open, the header shows the brand and a switcher; the URL carries it (`/brands/$brandId/...`). Tabs: **Visão geral**, **Canais** ([channels.md](channels.md)), **Conteúdos** ([content.md](content.md)), **Calendário** ([calendar.md](calendar.md)), **Aprovações** ([approvals.md](approvals.md)), **Biblioteca** (filtered to the brand), **Membros**, **Identidade**, **Configurações**. In the "Conteúdos" tab, each row has a three-dot actions menu including "Editar conteúdo"; editing opens full screen and saving keeps the person on this tab.
- **Overview:** pending approvals, content by status, next deadlines, recent activity, members count, channels with their status. When the person can update clients, clicking the client name opens the existing client form in a full-screen dialog; saving keeps the brand overview open.
- **Members tab:** table of members with kind, `can_decide`, status; actions "Convidar", "Adicionar membro existente", "Alterar permissão de decisão", "Revogar". External members are shown with an "Externo" badge.
- **Identity tab:** form with guideline fields and the logo field (picks an image of this brand from the library, or removes it; the logo is a `brand_identity` usage of its media version, so the file cannot be deleted while it is the logo).
- **Brand select:** wherever a person chooses a brand (filters, forms, the sidebar) the shared `BrandSelect` is used: avatar plus name in the list and in the closed field. A raw `SelectField` with brand names is not allowed.
- **Settings tab:** name, time zone, archive/reactivate.
- **Archive:** blocks new content and new planning; keeps all history; active channels and pending approvals are listed first and must be resolved or explicitly cancelled. A brand with approved but unpublished contents warns before archiving.

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

`brand_name_taken`, `brand_not_empty`, `member_kind_mismatch`, `last_internal_member`, `conflict`, `denied`.

## Acceptance criteria

- A client with two brands keeps content, channels and files separate; a user linked to brand A cannot see brand B (UI, API or direct RLS query, even by swapping IDs).
- An external member of brand A cannot read any table of brand B nor receive a signed URL for its files.
- Revoking a link blocks new operations immediately; the history stays.
- Changing the time zone does not alter stored instants of existing channel rows.
- Archiving a brand with pending approvals shows them and requires explicit resolution.
- Members with `kind` different from their profile kind are refused by the database.


## Implementation status

Phase 1 (task P1-03/P1-05, 2026-10-18). Same migrations and tests as [clients.md](clients.md); `src/lib/marketing/brands/*`, `src/components/marketing/brands/*`; routes `/admin/marketing/brands`, `/new`, `/$brandId` with tabs overview, channels, members, identity, settings.

2026-10-19: Fixed the Brands client filters and create form sharing `QueryKey.Clients.list` with the Clients page while caching different data shapes. All consumers now cache the canonical paginated `listClients` result and read its `rows` field. Validation performed: pending. **Not tested**: browser behavior and real Supabase.

Done: list, create, overview, members (add existing, invite, decision right, revoke, last-internal-member rule), identity (guidelines text, colors and fonts as data, guidelines link), settings (name, time zone with warning, archive, delete). Validation performed: SQL assertions (isolation between brands, external users read nothing, time zone change audited). **Not tested**: real Supabase, browser. Also done after the first pass: list filters by client and platform. Brand selection is now scoped to filters on the screens that need it; the global sidebar selector was removed. **Not done**: the "pending approvals" and "next planned post" columns and the archive pre-check of pending approvals (they depend on the content and approvals tables of phase 3; `brand_has_history` and the approver check are placeholders until then).

Brand logo and avatar (2026-10-19). Migration `20261019120200_brand_logo.sql` (column `brands.logo_media_version_id`; `brand_set_logo`, which accepts only an available image of that brand, keeps the `brand_identity` usage of the file in step and records `brand.updated`; `brand_logo_keys`, which returns the thumbnail key to people who see the brand), applied to the Supabase project, and the test `supabase/tests/18_brand_logo.test.sql` (13 assertions on PGlite: set, replace, usage released, PDF refused, other brand, role without `brands.update`, remove, audit). Code: `setBrandLogo`, `brandLogoUrls` (signs the thumbnail on the server), `logoUrl` in `listBrands`, `getBrand` and `listBrandOptions`; components `BrandAvatar`, `BrandSelect` (+ `brandSelectOptions`), the hook `useBrandOptions`, `BrandLogoField` in the Identity tab; the avatar in the brands list and in the brand header (`PageHeader` got a `leading` slot); `BrandSelect` replaced the raw selects of the dashboard, content, calendar, approvals, library, new content, case authorization and the sidebar switcher. **Not tested**: choosing and showing a real logo (the project has no brand, no file and no R2 yet), the select with avatars in the browser, and the portal (its brand lists do not show the avatar yet).

2026-10-19: Added contextual icons to the summary metrics and identity fields on the brand overview. Validation performed: targeted ESLint and typecheck. **Not tested**: browser rendering.

2026-10-19: Overview cards align to the top and use their own content height instead of stretching to the tallest card. Validation performed: targeted ESLint and typecheck. **Not tested**: browser rendering.

2026-10-19: Brand detail routes now use the full available admin content width, including the content and calendar tabs. Validation performed: targeted ESLint and typecheck. **Not tested**: browser rendering.

2026-10-19: Added a three-dot row-action menu to the brands list for opening, editing settings, archiving/reactivating and deleting brands. Deletion is disabled for brands with channels; the server still enforces the history rule. Validation performed: targeted ESLint, typecheck, `check:consistency`, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

2026-10-19: The brand's content tab now exposes row actions and opens content editing in a full-screen dialog, preserving the brand context. Validation performed: targeted ESLint, typecheck, `check:consistency`, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

2026-10-19: The client name in the brand overview opens the existing client form in a full-screen dialog for people with `clients.update`; saving preserves the brand context. Validation performed: targeted ESLint, typecheck, `check:consistency`, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

2026-10-19: Brand logo avatars now constrain the image to the fixed avatar width and preserve the full image proportions. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. Typecheck is blocked by missing `idea` and `date` entries in the calendar entry icon and label maps. **Not tested**: browser rendering with real logos.

2026-10-19: Moved brand archive/reactivate and delete actions from the settings section to the shared brand page header, preserving permission checks and confirmation dialogs. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. Full typecheck is blocked by existing errors across approvals, content, calendar and generated database types. **Not tested**: browser behavior.
2026-10-19: Aligned brand settings and identity save actions to the right using the shared form action component. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. Full typecheck remains blocked by existing calendar and brand-logo type errors outside this change. **Not tested**: browser rendering.
2026-10-19: Removed the explanatory copy from the brand logo section to keep the logo controls compact. Validation performed: pending. **Not tested**: browser rendering.

2026-10-19: The shared list-filter trigger now uses an icon with a tooltip and active-count badge. This applies to the brands list. Validation performed: targeted ESLint, Prettier and `git diff --check`. `check:docs` is currently blocked by ten audit-action registry mismatches for `calendar_note.*` and `variant.*` in the audit/functions documents. Full typecheck is blocked by existing `brand-logos.server.ts` type errors. **Not tested**: browser interaction.
2026-10-19: Brand detail navigation now preloads the shared brand query and keeps the current admin content width until the destination route resolves, avoiding an early layout shift before loading. Validation performed: targeted ESLint, `check:docs`, typecheck, Prettier and `git diff --check`. **Not tested**: browser transition.

2026-10-19: Removed the global brand selector from the Marketing sidebar; brand selection stays in each screen's own filters. Validation performed: targeted ESLint, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering.

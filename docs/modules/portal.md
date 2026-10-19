# Module — Client Portal

> Functional specification. Context and conventions in [README.md](README.md). Space: `portal` (`/portal/*`, UI label "Portal do Cliente"). It is the external experience where clients see what was sent to them and **decide**. The portal never imports from `marketing`; it reads only through the `portal_*` functions.

## Goal and scope

Give the client a simple, mobile-first place to: see what is pending, preview each post as it will look on its channel, read the caption and files, comment, **approve** or **request changes**, and consult the history of decisions. Everything is limited to the **brands the person is linked to** and to what was **sent or shared** with them.

Included: brand selection, pending dashboard, calendar, approval screen, external comments, decision history, notifications, profile. Not included in the MVP: client uploads, anonymous approval links, multiple approvers, chat, payments, reports.

## Access

- Login at `/admin/login` (same identity pool); after sign-in, a person who only has portal actions is redirected to `/portal`. The portal layout has its own guard (`requireAction(context, Action.Portal.View)`).
- Accounts are created **only by invitation** with an `external_approver` or `external_commenter` role and **specific brands** ([../foundations/authentication.md](../foundations/authentication.md)). A client contact never gets access to every brand of the client implicitly.
- URLs never replace authorization: every function checks the role action, the active external link and the shared status, and a URL for another brand returns "not found" (without revealing that it exists).
- Revoking a link or suspending the account blocks new reads and decisions immediately; signed file URLs already issued expire within minutes.

## What an external user can and cannot see

| Can see | Cannot see |
|---|---|
| The brands they are linked to | Other brands, other clients, the client list |
| Contents **with a revision sent** to them: the version snapshot (caption, files, order and, per channel, the platform, format, caption adjustment and planned date with zone), request status, approval deadline | Drafts, working copies, internal notes, briefing, owner, internal deadlines |
| External comments of the content and the decision history of those requests | Internal comments, audit events, settings, users |
| Files referenced by the revisions shared with them (short signed URLs) | The rest of the media library |
| Their own notifications and profile | Anything outside `portal_*` functions |

Technically the external role has **no `select` policy** on any internal table; all reads go through `security definer` functions that return safe columns.

## Screens

| Route | Screen |
|---|---|
| `/portal` | Brand selection (only linked brands). With a single brand, it goes straight to it |
| `/portal/brands/$brandId` | **Painel**: a header with the brand logo, name, client, time zone and the registered brand data the person may see (description, target audience, tone of voice, objectives, active channels with their links), then pending approvals first (with deadlines), upcoming planned posts and recent decisions; calendar shortcut |
| `/portal/brands/$brandId/calendar` | Read-only calendar of shared contents (month/week/list; list by default on mobile) |
| `/portal/brands/$brandId/approvals` | List of requests with filters: Pendentes, Aprovadas, Alterações solicitadas, Substituídas |
| `/portal/brands/$brandId/approvals/$requestId` | **Review and decision** |
| `/portal/notifications`, `/portal/profile` | Notifications and own profile (name, password) |

### Review and decision screen

```
┌───────────────────────────────────────────────┐
│ ← Aprovações · Café Aurora                    │
│ Lançamento de outono · Instagram (carrossel)  │
│ Prevista: sex., 18 de out., 10:00 (America/Sao_Paulo) │
│ Prazo para responder: 16 de out.              │
├───────────────────────────────────────────────┤
│  [ pré-visualização por canal, com carrossel ] │
│  Legenda…                                      │
│  Arquivos (3)  ▸ abrir / baixar                │
├───────────────────────────────────────────────┤
│  Histórico e comentários                       │
├───────────────────────────────────────────────┤
│  [ Pedir alterações ]        [ Aprovar ]       │
└───────────────────────────────────────────────┘
```

- **Preview by channel** from `shared/preview`: aspect ratio, caption truncation ("ver mais"), carousel navigation, video player without autoplay; the caption and files are shown in full below.
- **Files** open through short signed URLs (2 minutes) requested on demand.
- **Decision buttons** are at the bottom (sticky on mobile), 44 px targets. "Aprovar" asks for a light confirmation; "Pedir alterações" opens a required comment field (minimum 5 characters). Both are disabled while the request is running and re-enabled with the data preserved if it fails.
- **States:** pending (decision available); decided (read-only, with the decision and its comment); superseded (banner "Esta versão foi atualizada" with a link to the current request); cancelled; approver without `can_decide` (the screen shows the content and comments but no decision buttons, with the message "Você pode comentar, mas a decisão é de {nome}"); no access ("Você não tem acesso a esta marca").
- **External comments:** a thread below the content; the person adds comments (`comments.create_external`); the team sees them with an "Externo" badge.
- **History:** previous revisions of the same content with their decisions (only those shared with the person).

### Brand switcher

The portal header holds a **brand switcher** (popover "Suas marcas"): the current brand with its logo, name and client, and the list of the brands the person is linked to, each with its logo and the count of requests waiting for the person. Choosing one opens that brand's panel. With a single brand the header shows its identity without a menu. There is no "Trocar de marca" button on the pages. The logo is a short signed URL (120 s) of the thumbnail, issued after the database confirms the link.

Brand data the external user reads (function `portal_get_brand`): name, client name, description, target audience, tone of voice, objectives, time zone and the active channels (platform, profile name, public link). **Not exposed**: reference notes, the visual identity record, internal notes, members.

### Dashboard

Shows, by brand: "Aguardando você (N)" with deadline and age, "Próximas publicações" (read-only), "Decisões recentes". Every section has an icon and uses `EmptyState` (icon, title, one-line description), for example "Nada pendente por aqui".

## Rules

1. A request can only be decided by its **designated approver**, with an active external link and `can_decide`. Other external members comment.
2. The decision applies to the **exact revision shown**; if it was superseded meanwhile the decision is refused (`revision_superseded`).
3. Requesting changes requires a comment. A decision cannot be changed by the client; to revise it, the team reopens and a new request is created.
4. Opening a request records `viewed_at` once (informational).
5. The portal is mobile-first: no horizontal scroll at 360 px, readable contrast (AAA for body text), visible focus, keyboard access, `aria-live` for success/error messages.
6. All dates are shown with their time zone; the portal never mixes zones silently.
7. Session expiry returns to the login with the same page as the return destination, preserving a typed (undecided) comment locally.
8. Notifications (in-app and email) never contain private content beyond the title and brand; the link leads to the portal.

## Data and functions

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

All reads and writes go through: `portal_list_brands()`, `portal_get_brand(p_brand)`, `portal_brand_logo_keys(p_brands)`, `portal_list_pending(p_brand)`, `portal_get_approval(p_request)`, `portal_list_calendar(p_brand, p_from, p_to)`, `portal_list_comments(p_item)`, `portal_add_comment(p_item, p_body)`, `portal_decide_approval(p_request, p_outcome, p_comment)`, `portal_record_view(p_request)`. Each checks `has_action('portal.view')` and the active external link; outputs are validated with zod on the server (`parseOutput`) and returned as explicit DTOs (never full rows).

Code layout: `components/portal/{brands,approvals,calendar,comments}`, `lib/portal/{brands,approvals,calendar,comments}` (server functions `*.functions.ts`), `hooks/portal/...`; shared pieces (`shared/preview`, `shared/calendar`, `shared/editorial`, `shared/media` for signed URLs) are imported from `shared`.

## Permissions

| Action | Allows |
|---|---|
| `portal.view` | Enter the portal and read the allowed data |
| `approvals.decide` | Decide the requests designated to the person (needs `portal.view`) |
| `comments.create_external` | Comment on contents of the linked brands (needs `portal.view`) |

Starting roles: `external_approver` (all three) and `external_commenter` (`portal.view` and `comments.create_external`).

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`denied`, `not_found`, `request_not_pending`, `revision_superseded`, `comment_required`, `not_designated_approver`, `approver_without_access`, `conflict`. Messages are friendly pt-BR texts without internal codes.

## Acceptance criteria

- An external member of brand A cannot obtain data, comments or private URLs of brand B, even by changing identifiers in requests.
- The approver sees exactly the revision sent; later edits by the team do not change it.
- A decision on a superseded revision is refused, also with concurrent sessions.
- Only shared contents appear in the portal calendar; drafts and internal deadlines never do.
- A member without `can_decide` can comment but cannot decide.
- The approval flow works completely on a phone (360 px) and with keyboard only.
- Revoking access blocks the next read or decision; the history of past decisions stays.
- Failure of the notification email does not remove the request from the portal.

## Implementation status

Phase 3 (task P3-05, 2026-10-18). Done: migration `20261018100920_portal_functions.sql` (`portal_list_brands`, `portal_list_pending`, `portal_list_approvals`, `portal_get_approval`, `portal_record_view`, `portal_decide_approval`, `portal_list_comments`, `portal_add_comment`, `portal_media_urls`); server functions in `src/lib/portal/approvals/*` (outputs validated with zod, explicit DTOs, signed URLs of 2 minutes issued only after the database confirms the revision is shared); screens `/portal` (brand selection, straight to the brand when there is one), `/portal/brands/$brandId` ("Painel": "Aguardando você", pending with other people, "Próximas publicações", "Decisões recentes"), `/portal/brands/$brandId/approvals` (filters and pagination), `/portal/brands/$brandId/approvals/$requestId` (exact revision, files on demand, history, decision bar that is sticky on mobile, light confirmation for "Aprovar", required comment for "Pedir alterações" kept locally until it is sent, states superseded, decided, cancelled and not designated), external comments, `/portal/notifications`, `/portal/profile`; layout with skip link, notifications counter and sign-out.

Validation performed: pgTAP (brand A versus brand B on every function, designated approver, member without `can_decide`, commenter, internal manager refused, revoked link, no storage key or internal text in the DTO, superseded revision, signing only for files of a shared revision); typecheck, lint, build; the unauthenticated redirects of the portal routes in Playwright. **Not tested**: the portal in a browser at 360 px and with the keyboard (acceptance criterion), the invite → approve flow with real accounts, the signed file URLs against a real bucket. **Not done**: anonymous links (out of scope).

Phase 4 (task P4-03, 2026-10-18). The portal calendar: `portal_list_calendar` (returns the brand zone and one entry per content that has a request that is not cancelled, with date, status and title taken from the snapshot of its latest request; never drafts, owners, internal deadlines or comments), the server function `listPortalCalendar`, the page `/portal/brands/$brandId/calendar` (month, week and list, read-only, a click opens the approval screen) and a "Ver calendário" link on the brand panel. Tested with the SQL assertions of `11_calendar.test.sql` (brand A versus brand B, the team refused, no internal field in the output); **not tested** in a browser (V20).

2026-10-19: Portal layout refresh. Migration `20261019140000_portal_brand_profile.sql` (not yet applied to the linked project): `portal_list_brands` now also returns the client name, new `portal_get_brand` and `portal_brand_logo_keys`. Server: `getPortalBrand`, logos signed in `src/lib/portal/brands/brand-logos.server.ts`, `QueryKey.Portal.brand`. UI: `PortalBrandSwitcher` and `PortalBrandHeader` (`src/components/portal/brands/`), icons on every section of the panel, `EmptyState` on the empty sections, the "Trocar de marca" button removed, logos on the brand selection page, `BrandAvatar` size `xl`. Validation performed: 25 SQL assertions in `18_brand_logo.test.sql` (753 in total, 0 failures; linked external user, external user of another brand, internal manager, anon, unknown brand, no internal field in the output), typecheck, lint. **Not tested**: the portal in a browser (switcher, logos, 360 px), the signed logo URL against the real bucket, the migration against the linked project.

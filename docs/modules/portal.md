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
| `/portal/brands/$brandId` | **Painel**: a header with the brand logo, name, client, time zone and the registered brand data the person may see (description, target audience, tone of voice, objectives, active channels with their links), then pending approvals first (with deadlines), upcoming planned posts and recent decisions (the calendar and the full list are reached through the side menu, with no shortcut buttons on the page) |
| `/portal/brands/$brandId/calendar` | Read-only calendar of shared contents (month/week/list; list by default on mobile); hovering or focusing a content shows its shared revision preview, and selecting it opens the review screen |
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

- **Preview by channel** from `shared/preview`: each tab identifies both the platform and format so separate formats on the same network are distinguishable; it also provides aspect ratio, caption truncation ("ver mais"), carousel navigation and a video player without autoplay; the caption and files are shown in full below.
- **Files** open through short signed URLs (2 minutes) requested on demand.
- **Decision buttons** are at the bottom (sticky on mobile), 44 px targets. "Aprovar" asks for a light confirmation; "Pedir alterações" opens a required comment field (minimum 5 characters). Both are disabled while the request is running and re-enabled with the data preserved if it fails.
- **States:** pending (decision available); decided (read-only, with the decision and its comment); superseded (banner "Esta versão foi atualizada" with a link to the current request); cancelled; approver without `can_decide` (the screen shows the content and comments but no decision buttons, with the message "Você pode comentar, mas a decisão é de {nome}"); no access ("Você não tem acesso a esta marca").
- **External comments:** a thread below the content; the person adds comments (`comments.create_external`); the team sees them with an "Externo" badge.
- **History:** previous revisions of the same content with their decisions (only those shared with the person).

### Approval lists and dashboard previews

- Approval cards in the dashboard and approval list show a preview of the exact shared revision, including the selected channel, format, caption, the linked brand's configured logo as the channel avatar, and signed media thumbnails where available.
- A designated approver with current decision access can use "Aprovar" or "Pedir alterações" directly from a pending card. Approval uses the existing confirmation; requesting changes requires the same comment dialog and minimum length as the review screen. Other members and non-pending requests have no decision actions.
- Each portal section shows a matching skeleton while its data is loading; one section loading does not hide the rest of the dashboard.

### Layout and side menu

The portal uses the same shell as the back office: a **side menu** (collapsible, a drawer on mobile) and a top bar with the menu toggle. The menu has the title "Portal do Cliente", the brand switcher, the group "Marca" (Painel, Aprovações, Calendário, always for the current brand) and the group "Conta" (Avisos with the unread counter, Meu perfil), and "Sair" with the person's name in the footer. On pages that are not tied to a brand (Avisos, Meu perfil) the brand links use the first linked brand.

### Brand switcher

The side menu holds a **brand switcher** (popover "Suas marcas"): the current brand with its logo, name and client, and the list of the brands the person is linked to, each with its logo and the count of requests waiting for the person. Choosing one opens that brand's panel. With a single brand the menu shows its identity without a popover. There is no "Trocar de marca" button on the pages. The logo is a short signed URL (120 s) of the thumbnail, issued after the database confirms the link.

Brand data the external user reads (function `portal_get_brand`): name, client name, description, target audience, tone of voice, objectives, time zone and the active channels (platform, profile name, public link). **Not exposed**: reference notes, the visual identity record, internal notes, members.

### Dashboard

Shows, by brand: "Aguardando você (N)" with deadline and age, "Próximas publicações" (read-only), "Decisões recentes". Every section has an icon and uses `EmptyState` (icon, title, one-line description), for example "Nada pendente por aqui".

Each request is a card that focuses on the **preview**: the title with the status badge and a colored **response deadline badge** on top ("Responder até {data}" in the info tone with a clock, "Responder até hoje" or "amanhã" in the warning tone with an alarm clock, "Prazo vencido há N dias" in the negative tone with a warning triangle; only while the request is pending and has a due date), then a bar with the **publication date** of the channel being previewed ("Publicação: {data e fuso}", or "Publicação sem data definida") above the channel preview, and at the bottom "Ver detalhes" and, for the designated approver, "Pedir alterações" and "Aprovar". Clicking the title, the preview or "Ver detalhes" opens the review screen in a **full-screen dialog** (the same content as `/portal/brands/$brandId/approvals/$requestId`, with the decision bar fixed at the bottom of the dialog), so the person does not navigate away from the list.

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

All reads and writes go through: `portal_list_brands()`, `portal_get_brand(p_brand)`, `portal_brand_logo_keys(p_brands)`, `portal_list_pending(p_brand)`, `portal_get_approval(p_request)`, `portal_list_calendar(p_brand, p_from, p_to)`, `portal_list_comments(p_item)`, `portal_add_comment(p_item, p_body)`, `portal_decide_approval(p_request, p_outcome, p_comment)`, `portal_record_view(p_request)`, and `portal_media_urls(p_revision, p_version_ids)` for authorized media URLs. Each checks `has_action('portal.view')` and the active external link; outputs are validated with zod on the server (`parseOutput`) and returned as explicit DTOs (never full rows).

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
- Approval lists and dashboard cards preview only the revision shared with the client; pending designated approvers can decide from those cards.
- Every portal section presents a skeleton while its data is loading.
- A decision on a superseded revision is refused, also with concurrent sessions.
- Only shared contents appear in the portal calendar; drafts and internal deadlines never do.
- A member without `can_decide` can comment but cannot decide.
- The approval flow works completely on a phone (360 px) and with keyboard only.
- Revoking access blocks the next read or decision; the history of past decisions stays.
- Failure of the notification email does not remove the request from the portal.

## Implementation status

Phase 3 (task P3-05, 2026-10-18). Done: migration `20261018100920_portal_functions.sql` (`portal_list_brands`, `portal_list_pending`, `portal_list_approvals`, `portal_get_approval`, `portal_record_view`, `portal_decide_approval`, `portal_list_comments`, `portal_add_comment`, `portal_media_urls`); server functions in `src/lib/portal/approvals/*` (outputs validated with zod, explicit DTOs, signed URLs of 2 minutes issued only after the database confirms the revision is shared); screens `/portal` (brand selection, straight to the brand when there is one), `/portal/brands/$brandId` ("Painel": "Aguardando você", pending with other people, "Próximas publicações", "Decisões recentes"), `/portal/brands/$brandId/approvals` (filters and pagination), `/portal/brands/$brandId/approvals/$requestId` (exact revision, files on demand, history, decision bar that is sticky on mobile, light confirmation for "Aprovar", required comment for "Pedir alterações" kept locally until it is sent, states superseded, decided, cancelled and not designated), external comments, `/portal/notifications`, `/portal/profile`; layout with skip link, notifications counter and sign-out.

Validation performed: pgTAP (brand A versus brand B on every function, designated approver, member without `can_decide`, commenter, internal manager refused, revoked link, no storage key or internal text in the DTO, superseded revision, signing only for files of a shared revision); typecheck, lint, build; the unauthenticated redirects of the portal routes in Playwright. **Not tested**: the portal in a browser at 360 px and with the keyboard (acceptance criterion), the invite → approve flow with real accounts, the signed file URLs against a real bucket. **Not done**: anonymous links (out of scope).

Phase 4 (task P4-03, 2026-10-18). The portal calendar: `portal_list_calendar` (returns the brand zone and one entry per content that has a request that is not cancelled, with date, status and title taken from the snapshot of its latest request; never drafts, owners, internal deadlines or comments), the server function `listPortalCalendar`, the page `/portal/brands/$brandId/calendar` (month, week and list, read-only, a click opens the approval screen) and, until 2026-10-19, a "Ver calendário" link on the brand panel (removed: the side menu has "Calendário" and "Aprovações"). Tested with the SQL assertions of `11_calendar.test.sql` (brand A versus brand B, the team refused, no internal field in the output); **not tested** in a browser (V20).

2026-10-19: Portal layout refresh. Migration `20261019140000_portal_brand_profile.sql` (applied to the linked project on 2026-10-19 together with `20261019150000_portal_approval_previews.sql`; types regenerated with `npm run db:types -- --linked`): `portal_list_brands` now also returns the client name, new `portal_get_brand` and `portal_brand_logo_keys`. Server: `getPortalBrand`, logos signed in `src/lib/portal/brands/brand-logos.server.ts`, `QueryKey.Portal.brand`. UI: `PortalBrandSwitcher` and `PortalBrandHeader` (`src/components/portal/brands/`), icons on every section of the panel, `EmptyState` on the empty sections, the "Trocar de marca" button removed, logos on the brand selection page, `BrandAvatar` size `xl`. Validation performed: 25 SQL assertions in `18_brand_logo.test.sql` (753 in total, 0 failures; linked external user, external user of another brand, internal manager, anon, unknown brand, no internal field in the output), typecheck, lint. **Not tested**: the portal in a browser (switcher, logos, 360 px), the signed logo URL against the real bucket, the migration against the linked project.
2026-10-19: Approval previews now reuse the linked brand profile query and pass its signed brand logo to the channel avatar. No migration. Validation performed: targeted lint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: portal browser rendering with a configured logo and real signed URL.
2026-10-19: Added portal breadcrumbs for the home, brand panel, calendar, approval list and review routes, plus notifications and profile. The linked brand name comes from the cached portal brand profile. No migration. Validation performed: targeted lint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: breadcrumb navigation in a browser.
2026-10-20: Portal calendar items now load the shared approval revision on hover or keyboard focus and show its channel preview, signed media and caption; selecting an item still opens its review. No migration. Validation performed: targeted lint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: hover/focus preview in a browser.
2026-10-20: Shared channel and revision previews now show a dash when the caption is empty. Validation performed: targeted ESLint, Prettier and `git diff --check`. **Not tested**: browser rendering.
2026-10-20: Revision preview tabs now include the format label alongside the platform so multiple formats on the same network can be distinguished. Validation performed: targeted ESLint, typecheck, Prettier and `git diff --check`. **Not tested**: browser rendering.

2026-10-19: The portal layout now has the back-office shell with a side menu: `PortalShell` (`SidebarProvider`, top bar) and `PortalSidebar` (`src/components/portal/portal-sidebar.tsx`); the old top navigation (Avisos, Meu perfil, Sair) moved into the menu. Validation performed: typecheck, build, lint of the changed files. **Not tested**: the menu in a browser (desktop, tablet, 360 px drawer), keyboard navigation, the active state of each item.

2026-10-19: Portal approval listings now show previews of the submitted revision with signed media thumbnails and per-channel captions, plus direct "Aprovar" and "Pedir alterações" actions for designated approvers. Dashboard sections keep their own skeleton while loading. Migration `20261019150000_portal_approval_previews.sql` adds only safe revision/media metadata and the `can_decide` flag to the portal list DTO; `signPortalPreviewMedia` uses the existing `portal_media_urls` authorization before signing thumbnails. Files: `src/components/portal/approvals/request-card.tsx`, `request-preview.tsx`, `request-decision-actions.tsx`, `portal-approvals-page.tsx`, `portal-brand-page.tsx`, `src/hooks/portal/use-portal-preview-urls.ts`, `src/lib/portal/approvals/{dto.ts,schemas.ts,types.ts,portal.functions.ts}`, `src/lib/shared/query-keys.ts`, `supabase/tests/09_content.test.sql`. Validation performed: 758 pgTAP assertions, TypeScript, targeted ESLint, Prettier, `check:docs`, `check:consistency`, and `git diff --check`. **Build blocked**: Vite could not load `@tailwindcss/oxide-win32-x64-msvc` (`spawn EPERM`). **Not tested**: portal rendering and approval actions in a browser, real signed thumbnail URLs against the production bucket.

2026-10-19: The buttons "Ver calendário" and "Ver todas as aprovações" were removed from the brand panel because the side menu covers them (`portal-brand-page.tsx`). Validation performed: typecheck, lint. **Not tested**: the panel in a browser.

2026-10-20: Request cards redesigned (`request-card.tsx`, `request-preview.tsx`): preview first, publication date inside the preview, `ResponseDeadlineBadge` (rule in `src/lib/portal/approvals/deadline.ts`, replaces `isOverdue`, which was removed), status badge kept, actions at the bottom, and the full-screen `PortalApprovalDialog` that embeds `PortalApprovalPage` (`embedded` prop). The channel and version line was removed from the card. Validation performed: 6 Vitest tests of the deadline rule (overdue, singular, today, tomorrow, later, decided or no due date), lint of the portal files, typecheck of the portal files. **Not tested**: the dialog and the cards in a browser (focus trap, scroll, 360 px), the click on the preview versus the carousel controls, deciding from inside the dialog. The project-wide lint and typecheck currently fail in `portal-calendar-entry-preview.tsx` and `calendar-grid.tsx`, which belong to another change in progress.

2026-10-20: The preview on the request cards is smaller. `ChannelPreview` has a `compact` mode (card at most 16rem wide, 11rem for story and reel, smaller header, caption clamped to two lines and no "ver mais"; the full caption is in the full-screen dialog); only the portal cards use it, the editor, the review screen and the calendar keep the default size. Validation performed: lint and typecheck. **Not tested**: the cards in a browser (sizes by format, 360 px).

# Module — Client Portal

> Functional specification. Context and conventions in [README.md](README.md). Space: `portal` (`/portal/*`, UI label "Portal do Cliente"). It is the external experience where clients see what was sent to them and **decide**. The portal never imports from `marketing`; it reads only through the `portal_*` functions.

## Goal and scope

Give the client a simple, mobile-first place to: see what is pending, preview each post as it will look on its channel, read the caption and files, comment, **approve** or **request changes**, and consult the history of decisions. Everything is limited to the **brands the person is linked to** and to what was **sent or shared** with them.

Included: brand selection, pending dashboard, calendar, approval screen, external comments, decision history, notifications, profile. Not included in the MVP: client uploads, anonymous approval links, multiple approvers, chat, payments, reports (a proposal for result reports is in [metrics.md](metrics.md)).

> Changed on 2026-10-20: any approver of the brand can decide a request (no designated approver), and every request has a stage, planning or art, with a plan version that may carry planning files but never the art. See [approvals.md](approvals.md#approver-pool-decided-2026-10-20) and [content.md](content.md#two-stage-approval-decided-2026-10-20).

> Changed on 2026-10-20: the portal calendar also shows the events the team marks as visible to the client (shoot days, meetings) and the shared dates, read-only, with a detail dialog. See [calendar.md](calendar.md#events-shared-with-the-client-decided-2026-10-20).

> Changed on 2026-11-04: the brand panel is now a **social-network style feed** (Instagram as the reference) that shows what is pending and what was already decided, newest first. "Aprovar" works like a like, comments are inline, and "Solicitar alteração" sends the change request using the typed comment. It replaces the dashboard and the approval list. See [Feed](#feed-decided-2026-11-04).

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
| `/portal/brands/$brandId` | **Feed** ([details](#feed-decided-2026-11-04)): a header with the brand logo, name, client, time zone and the registered brand data the person may see (description, target audience, tone of voice, objectives, active channels with their links), the filters and the posts. URL param `status` |
| `/portal/brands/$brandId/calendar` | Read-only calendar of shared contents (month/week/list; list by default on mobile); hovering or focusing a content shows its shared revision preview, and selecting it opens the review screen |
| `/portal/brands/$brandId/approvals/$requestId` | **Review and decision** |
| `/portal/notifications`, `/portal/profile` | Notifications and own profile (name, password) |

### Feed (decided 2026-11-04)

The brand page is a single-column feed in the style of a social network. It replaced the dashboard sections ("Aguardando você", "Em análise pela marca", "Próximas publicações", "Decisões recentes"), the bento card grid and the approval list screen (`/portal/brands/$brandId/approvals`, removed). The brand header (`PortalBrandHeader`) stays on top. Each post also has a bar with the title (opens the review in the full-screen dialog), the `ResponseDeadlineBadge`, the stage badge for a planning and the status badge.

**What it lists.** Every content with a revision shared with the person, in **any** state: waiting for a decision, approved, changes requested, superseded. Cancelled requests never appear (same as `portal_list_approvals`). One post per content, showing its latest shared request.

**Order.** Newest first. The sort key is the planned publication date of the content (the latest `planned_at` among its channels), descending; contents without a planned date are ordered by the date the request was sent (`requested_at`), descending, and mixed into the same list by that date. Server-side (`portal_list_approvals`), paginated by 20 (UI-1) with "Carregar mais" at the end of the list. A filter bar above the feed offers "Todos" (default), "Pendentes", "Aprovados", "Alterações solicitadas" (URL param `status`, resets the list). A content with several channel rows shows one post with a chip per channel ("Instagram · Carrossel"), the earliest planned date first.

**Post anatomy (top to bottom).**

| Part | Content |
|---|---|
| Header | Brand logo as avatar, brand name, channel and format ("Instagram · Carrossel"), the status badge and, while pending, the `ResponseDeadlineBadge` |
| Date line | "Publicação: {data e fuso}" or "Publicação sem data definida" (same rule as the current cards) |
| Media | The channel preview of the exact shared revision (`RequestPreview` / `ChannelPreview`); one preview per channel row of the revision when there are several formats. Clicking the preview opens the review screen in the full-screen dialog |
| Action bar | Left: heart "Aprovar" and comment bubble. Right: "Solicitar alteração" |
| Caption | The caption of the revision, clamped with "ver mais" |
| Comments | "Ver os N comentários" expands the thread inline (the decision comment appears in it as "Alteração solicitada"); a "Adicione um comentário…" field with "Publicar" is always at the bottom and is the same field used by "Solicitar alteração" |

**Actions (only for an approver of the brand with `can_decide` and a pending request).**

- **Heart ("Aprovar")** is the approve decision (`portal_decide_approval` with outcome `approved`). It keeps the light confirmation of the review screen ("Aprovar esta versão?"), because the decision cannot be undone (rule 3). After approval the heart is filled, cannot be toggled off, and the post shows "Aprovado por {nome}".
- **Comment bubble** focuses the comment field and expands the thread. Comments use `portal_add_comment` / `portal_list_comments` (`comments.create_external`) and are open to every external member, with or without `can_decide`.
- **"Solicitar alteração"** sends the change request **using the text of the comment field as the guidance**, with no second form: it calls `portal_decide_approval` with outcome `changes_requested` and that text as the comment. Minimum 5 characters (`MIN_CHANGE_COMMENT`). If the field is empty or too short, the button does not submit: it opens the thread, moves focus to the field and shows the hint "Escreva o que precisa mudar para solicitar a alteração." The typed text is kept locally while it is not sent (`useDecisionDraft`) and kept if the request fails.
- The text sent with "Solicitar alteração" is the **decision comment**; it appears in the thread as an entry "Alteração solicitada" and is **not** also stored as a separate comment (no duplicate). Commenting with "Publicar" never changes the status.
- Both decision actions are disabled while any decision for that request is running, and are hidden or inert for decided, superseded and cancelled requests.

**States of a post.**

| State | What the person sees |
|---|---|
| Pending, can decide | Heart, comment and "Solicitar alteração" enabled |
| Pending, cannot decide | Comments only, with "Você pode comentar, mas a decisão é de quem aprova a marca." (the person who will decide is not known while pending) |
| Approved | Filled heart, "Aprovado por {nome}", comments still allowed |
| Changes requested | "Alteração solicitada" badge and the guidance comment; the team revises and a new post version replaces it (the feed shows the latest request of the content) |
| Superseded | The feed shows one post per content (its latest request), so a superseded request is not listed; one reached by an old link keeps the banner of the review screen |

**Feed states.** Skeleton with the post layout (stable height) → error with retry → empty ("Nada por aqui ainda", "Quando a equipe enviar um conteúdo, ele aparece aqui.") → no results for the filter (clear filter) → list.

**Accessibility and layout.** One column up to about 32 rem on desktop and full width at 360 px; targets of at least 44 px; the heart is a button with `aria-pressed` and a text label (never only an icon or color); the whole action bar works by keyboard; focus stays on the post after an action; success and error messages in an `aria-live` region; the filled heart state is shown by shape and text as well as color; colors only from the palette tokens.

**Incomplete content.** What a post shows depends on the version sent: caption and files (full post), files only (no caption), caption only (a fallback image) or neither, which is a **planning** version and is drawn as the planning card with the summary, channels, formats and planned dates. The feed follows `request.stage`; rules and the fallback in [portal-feed-previews.md](portal-feed-previews.md#what-is-drawn-when-parts-are-missing-decided-2026-11-04).

**Per-format rendering.** How each Instagram format (image, carousel, video, Reel, Story) is framed and decorated, the caption rules, the component split and the method to measure the reference are in [portal-feed-previews.md](portal-feed-previews.md). This document owns the feed behavior; that one owns the preview drawing.

**Reuse (GOLD-2).** `RequestPreview`, `ChannelPreview`, `ResponseDeadlineBadge`, `portal-comments`, `useDecisionDraft`, `usePortalPreviewUrls`, `decidePortalApproval`, `addPortalComment`, `listPortalComments`. The feed list reads from the existing `portal_list_approvals`, changed in place (one row per content, the sort above, `comment_count`, `decision_comment`); no parallel list function. The "bento" files, the old cards, the list page and `listPortalPending` were removed in the same change (CODE-11). Built files: `components/portal/feed/*`, `hooks/portal/use-feed-decision.ts`, `lib/portal/approvals/feed.ts`.

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

- **Preview by channel** from `shared/preview`: each tab identifies both the platform and format so separate formats on the same network are distinguishable; it also provides the aspect ratio (fixed per platform and format; on **Instagram** feed posts, "Post" and "Carrossel", the frame follows the real ratio of the first file, between 4:5 and 1.91:1, like the network does, and the first file sets the frame of the whole carousel), caption truncation ("ver mais"), carousel navigation and a video player without autoplay; the caption and files are shown in full below.
- **Files** open through short signed URLs (2 minutes) requested on demand.
- **Decision buttons** are at the bottom (sticky on mobile), 44 px targets. "Aprovar" asks for a light confirmation; "Pedir alterações" opens a required comment field (minimum 5 characters). Both are disabled while the request is running and re-enabled with the data preserved if it fails.
- **States:** pending (decision available); decided (read-only, with the decision and its comment); superseded (banner "Esta versão foi atualizada" with a link to the current request); cancelled; approver without `can_decide` (the screen shows the content and comments but no decision buttons, with the message "Você pode comentar, mas a decisão é de {nome}"); no access ("Você não tem acesso a esta marca").
- **External comments:** a thread below the content; the person adds comments (`comments.create_external`); the team sees them with an "Externo" badge.
- **History:** previous revisions of the same content with their decisions (only those shared with the person).

### Layout and side menu

The top bar also shows the shared notification bell at the upper right, with the unread count, latest notifications, read and snooze actions, and a "Ver todos" link to `/portal/notifications`.

The portal uses the same shell as the back office: a **side menu** (collapsible, a drawer on mobile) and a top bar with the menu toggle. The menu has the title "Portal do Cliente", the brand switcher, the group "Marca" (Feed, Calendário and, with `metrics.portal_view`, Resultados, always for the current brand) and the group "Conta" (Avisos with the unread counter, Meu perfil), and "Sair" with the person's name in the footer. On pages that are not tied to a brand (Avisos, Meu perfil) the brand links use the first linked brand.

### Brand switcher

The side menu holds a **brand switcher** (popover "Suas marcas"): the current brand with its logo, name and client, and the list of the brands the person is linked to, each with its logo and the count of requests waiting for the person. Choosing one opens that brand's panel. With a single brand the menu shows its identity without a popover. There is no "Trocar de marca" button on the pages. The logo is a short signed URL (120 s) of the thumbnail, issued after the database confirms the link.

Brand data the external user reads (function `portal_get_brand`): name, client name, description, target audience, tone of voice, objectives, time zone and the active channels (platform, profile name, public link). **Not exposed**: reference notes, the visual identity record, internal notes, members.

## Rules

1. A request can be decided by **any approver of the brand** (an active external link with `can_decide` and the action `approvals.decide`); the first decision wins and the others see who decided. Other external members comment.
2. The decision applies to the **exact revision shown**; if it was superseded meanwhile the decision is refused (`revision_superseded`).
3. Requesting changes requires a comment. A decision cannot be changed by the client; to revise it, the team reopens and a new request is created.
4. Opening a request records `viewed_at` once (informational).
5. The portal is mobile-first: no horizontal scroll at 360 px, readable contrast (AAA for body text), visible focus, keyboard access, `aria-live` for success/error messages.
6. Date and time values are calculated in their configured time zone, without appending a GMT offset to every value. When a screen can contain multiple zones, an adjacent timezone icon exposes the IANA zone in a tooltip; page-level zone context may cover a single-zone view.
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
| `approvals.decide` | Decide the requests of the brands where the person has `can_decide` (needs `portal.view`) |
| `comments.create_external` | Comment on contents of the linked brands (needs `portal.view`) |

Starting roles: `external_approver` (all three) and `external_commenter` (`portal.view` and `comments.create_external`).

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`denied`, `not_found`, `request_not_pending`, `revision_superseded`, `comment_required`, `conflict`. Messages are friendly pt-BR texts without internal codes.

## Acceptance criteria

- An external member of brand A cannot obtain data, comments or private URLs of brand B, even by changing identifiers in requests.
- The approver sees exactly the revision sent; later edits by the team do not change it.
- The feed posts preview only the revision shared with the client; approvers of the brand can decide from them.
- The feed presents a skeleton with the layout of a post while its data is loading.
- A decision on a superseded revision is refused, also with concurrent sessions.
- Only shared contents appear in the portal calendar; drafts and internal deadlines never do.
- A member without `can_decide` can comment but cannot decide.
- The approval flow works completely on a phone (360 px) and with keyboard only.
- Revoking access blocks the next read or decision; the history of past decisions stays.
- Failure of the notification email does not remove the request from the portal.
- The feed lists pending and already decided contents together, newest first, and the order does not change when a decision is made.
- "Solicitar alteração" with typed text sends the change request in one click, using that text as the comment; with an empty or too short field it sends nothing and focuses the field.
- The heart asks for confirmation, records an approval only once and cannot be toggled off.
- A member without `can_decide` sees the feed and can comment, but has no heart and no "Solicitar alteração".
- The feed works at 360 px and by keyboard only, with paginated loading.

## Open decisions

Decided on 2026-11-04 by building the recommendations written in this document: the sort key (planned publication date, else the date sent), the irreversible approval with a light confirmation (rule 3 stands), the feed replacing the panel and the approval list, extending `portal_list_approvals` and the label "Solicitar alteração". Points about previews per format are in [portal-feed-previews.md](portal-feed-previews.md).

1. **Sort by a date that is not yet published.** The order uses the planned date, so a content whose planned date is changed by the team moves in the feed. Revisit after real use.
2. **Notification links.** The in-app and email notification links for the client still point to `/portal/brands/$brandId/approvals/$requestId` (the review screen), which still exists. Pointing them to the feed post is a later improvement.

## Implementation status

2026-11-04: **Feed implemented** on `/portal/brands/$brandId`, following [portal-feed-previews.md](portal-feed-previews.md). Migrations `20261104100000_portal_feed.sql` (`portal_list_approvals`: one row per content, feed order, `comment_count`, `decision_comment`) and `20261104100100_portal_request_caption.sql` (`portal_request_row` carries the base `caption`); neither was applied to the linked project. Code: `src/components/portal/feed/*` (page, post, actions, comments, skeleton), `src/hooks/portal/use-feed-decision.ts`, `src/lib/portal/approvals/feed.ts`, `src/components/shared/preview/instagram/*`, `src/components/shared/preview/media-slide.tsx` (slides moved out of `channel-preview.tsx`), `src/lib/shared/preview/instagram.ts`, `plan-request-summary.tsx` (reference files), the sidebar ("Feed", "Aprovações" removed), the breadcrumbs, `portal-approval-page.tsx` ("Solicitar alteração", back link to the feed), `e2e/auth-guards.spec.ts`, the regenerated `src/routeTree.gen.ts`. Removed: `portal-brand-page.tsx`, `portal-approvals-page.tsx`, `request-card.tsx`, `request-decision-actions.tsx`, `request-preview.tsx`, `use-bento-layout.ts`, `bento.ts` and its test, the `/approvals` list route, `listPortalPending`, `QueryKey.Portal.pending`. Registries updated: routes, functions, enums, glossary, design system.

Validation performed: `npm run db:verify` (1113 assertions, 0 failures; 8 new in `19_simplified_approval.test.sql`: one post per content, latest request, decision comment, filter on the latest request, comment count, caption, another brand refused), Vitest (286 tests, 14 new in `feed.test.ts` and `instagram.test.ts`), `npm run typecheck`, `npm run lint`, `npm run check:consistency`, `npm run check:docs`. `typecheck` first reported an implicit `any` in `src/routes/admin/_app/(marketing)/marketing/brands/$brandId/metrics.tsx(22,34)`, a file this change did not otherwise touch; it was fixed with a one-line parameter type (`previous: typeof search`), outside the scope of the feed and made only so the check passes. It was not confirmed whether the error existed before this change. **Not tested**: the feed in a browser (360 px, keyboard, every format: carousel, Reel, Story, planning card, fallback), real signed media URLs, the two migrations against the linked project, the Playwright flow approve and request changes, deciding from the dialog. **Not built**: the two-column detail layout (`InstagramDetailLayout`) of the dialog.

2026-11-04: **Feed specified, not implemented.** Only this document changed (sections "Feed", "Open decisions", acceptance criteria, note on the dashboard). No code, migration, route or registry changed; [../reference/routes.md](../reference/routes.md), [../reference/functions.md](../reference/functions.md) and the glossary are updated when the open decisions are confirmed and the work starts. Validation: none run beyond reading the existing portal code.

Phase 3 (task P3-05, 2026-10-18). Done: migration `20261018100920_portal_functions.sql` (`portal_list_brands`, `portal_list_pending`, `portal_list_approvals`, `portal_get_approval`, `portal_record_view`, `portal_decide_approval`, `portal_list_comments`, `portal_add_comment`, `portal_media_urls`); server functions in `src/lib/portal/approvals/*` (outputs validated with zod, explicit DTOs, signed URLs of 2 minutes issued only after the database confirms the revision is shared); screens `/portal` (brand selection, straight to the brand when there is one), `/portal/brands/$brandId` ("Painel": "Aguardando você", pending with other people, "Próximas publicações", "Decisões recentes"), `/portal/brands/$brandId/approvals` (filters and pagination), `/portal/brands/$brandId/approvals/$requestId` (exact revision, files on demand, history, decision bar that is sticky on mobile, light confirmation for "Aprovar", required comment for "Pedir alterações" kept locally until it is sent, states superseded, decided, cancelled and not designated), external comments, `/portal/notifications`, `/portal/profile`; layout with skip link, notifications counter and sign-out.

Validation performed: pgTAP (brand A versus brand B on every function, designated approver, member without `can_decide`, commenter, internal manager refused, revoked link, no storage key or internal text in the DTO, superseded revision, signing only for files of a shared revision); typecheck, lint, build; the unauthenticated redirects of the portal routes in Playwright. **Not tested**: the portal in a browser at 360 px and with the keyboard (acceptance criterion), the invite → approve flow with real accounts, the signed file URLs against a real bucket. **Not done**: anonymous links (out of scope).

Phase 4 (task P4-03, 2026-10-18). The portal calendar: `portal_list_calendar` (returns the brand zone and one entry per content that has a request that is not cancelled, with date, status and title taken from the snapshot of its latest request; never drafts, owners, internal deadlines or comments), the server function `listPortalCalendar`, the page `/portal/brands/$brandId/calendar` (month, week and list, read-only, a click opens the approval screen) and, until 2026-10-19, a "Ver calendário" link on the brand panel (removed: the side menu has "Calendário" and "Aprovações"). Tested with the SQL assertions of `11_calendar.test.sql` (brand A versus brand B, the team refused, no internal field in the output); **not tested** in a browser (V20).

2026-10-19: Portal layout refresh. Migration `20261019140000_portal_brand_profile.sql` (applied to the linked project on 2026-10-19 together with `20261019150000_portal_approval_previews.sql`; types regenerated with `npm run db:types -- --linked`): `portal_list_brands` now also returns the client name, new `portal_get_brand` and `portal_brand_logo_keys`. Server: `getPortalBrand`, logos signed in `src/lib/portal/brands/brand-logos.server.ts`, `QueryKey.Portal.brand`. UI: `PortalBrandSwitcher` and `PortalBrandHeader` (`src/components/portal/brands/`), icons on every section of the panel, `EmptyState` on the empty sections, the "Trocar de marca" button removed, logos on the brand selection page, `BrandAvatar` size `xl`. Validation performed: 25 SQL assertions in `18_brand_logo.test.sql` (753 in total, 0 failures; linked external user, external user of another brand, internal manager, anon, unknown brand, no internal field in the output), typecheck, lint. **Not tested**: the portal in a browser (switcher, logos, 360 px), the signed logo URL against the real bucket, the migration against the linked project.
2026-10-19: Approval previews now reuse the linked brand profile query and pass its signed brand logo to the channel avatar. No migration. Validation performed: targeted lint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: portal browser rendering with a configured logo and real signed URL.
2026-10-19: Added portal breadcrumbs for the home, brand panel, calendar, approval list and review routes, plus notifications and profile. The linked brand name comes from the cached portal brand profile. No migration. Validation performed: targeted lint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: breadcrumb navigation in a browser.
2026-10-20: Portal calendar items now load the shared approval revision on hover or keyboard focus and show its channel preview, signed media and caption; selecting an item still opens its review. No migration. Validation performed: targeted lint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: hover/focus preview in a browser.
2026-10-20: Shared channel and revision previews now show a dash when the caption is empty. Validation performed: targeted ESLint, Prettier and `git diff --check`. **Not tested**: browser rendering.
2026-10-20: Revision preview tabs now include the format label alongside the platform so multiple formats on the same network can be distinguished. Validation performed: targeted ESLint, typecheck, Prettier and `git diff --check`. **Not tested**: browser rendering.
2026-10-20: Portal content previews now sign the display derivative instead of preferring the 400 px thumbnail, with the original as the fallback, so clients see the content at better quality. Authorization still runs through `portal_media_urls`. Validation performed: targeted ESLint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser rendering with production media.
2026-10-20: Portal approval cards display each channel format as its own preview instead of tabs, so multiple formats on the same platform are visible together. Validation performed: targeted ESLint, typecheck, `check:docs`, Prettier and `git diff --check`. **Not tested**: responsive card rendering in a browser.
2026-10-20: Date and time displays now omit the trailing GMT abbreviation; the configured IANA zone remains available from a compact tooltip where entries can use different zones. Portal route transitions reuse the authenticated layout for 30 seconds and show the router's default page skeleton when route loading exceeds 150 ms. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. **Not verified**: full TypeScript check (blocked by existing errors in content editor, revision history and approvals), Vitest (could not start because esbuild returned `spawn EPERM`), browser transition timing and timezone tooltips.

2026-10-19: The portal layout now has the back-office shell with a side menu: `PortalShell` (`SidebarProvider`, top bar) and `PortalSidebar` (`src/components/portal/portal-sidebar.tsx`); the old top navigation (Avisos, Meu perfil, Sair) moved into the menu. Validation performed: typecheck, build, lint of the changed files. **Not tested**: the menu in a browser (desktop, tablet, 360 px drawer), keyboard navigation, the active state of each item.

2026-10-19: Portal approval listings now show previews of the submitted revision with signed media thumbnails and per-channel captions, plus direct "Aprovar" and "Pedir alterações" actions for designated approvers. Dashboard sections keep their own skeleton while loading. Migration `20261019150000_portal_approval_previews.sql` adds only safe revision/media metadata and the `can_decide` flag to the portal list DTO; `signPortalPreviewMedia` uses the existing `portal_media_urls` authorization before signing thumbnails. Files: `src/components/portal/approvals/request-card.tsx`, `request-preview.tsx`, `request-decision-actions.tsx`, `portal-approvals-page.tsx`, `portal-brand-page.tsx`, `src/hooks/portal/use-portal-preview-urls.ts`, `src/lib/portal/approvals/{dto.ts,schemas.ts,types.ts,portal.functions.ts}`, `src/lib/shared/query-keys.ts`, `supabase/tests/09_content.test.sql`. Validation performed: 758 pgTAP assertions, TypeScript, targeted ESLint, Prettier, `check:docs`, `check:consistency`, and `git diff --check`. **Build blocked**: Vite could not load `@tailwindcss/oxide-win32-x64-msvc` (`spawn EPERM`). **Not tested**: portal rendering and approval actions in a browser, real signed thumbnail URLs against the production bucket.

2026-10-19: The buttons "Ver calendário" and "Ver todas as aprovações" were removed from the brand panel because the side menu covers them (`portal-brand-page.tsx`). Validation performed: typecheck, lint. **Not tested**: the panel in a browser.

2026-10-20: Request cards redesigned (`request-card.tsx`, `request-preview.tsx`): preview first, publication date inside the preview, `ResponseDeadlineBadge` (rule in `src/lib/portal/approvals/deadline.ts`, replaces `isOverdue`, which was removed), status badge kept, actions at the bottom, and the full-screen `PortalApprovalDialog` that embeds `PortalApprovalPage` (`embedded` prop). The channel and version line was removed from the card. Validation performed: 6 Vitest tests of the deadline rule (overdue, singular, today, tomorrow, later, decided or no due date), lint of the portal files, typecheck of the portal files. **Not tested**: the dialog and the cards in a browser (focus trap, scroll, 360 px), the click on the preview versus the carousel controls, deciding from inside the dialog. The project-wide lint and typecheck currently fail in `portal-calendar-entry-preview.tsx` and `calendar-grid.tsx`, which belong to another change in progress.

2026-10-20: The preview on the request cards is smaller. `ChannelPreview` has a `compact` mode (card at most 16rem wide, 11rem for story and reel, smaller header, caption clamped to two lines and no "ver mais"; the full caption is in the full-screen dialog); only the portal cards use it, the editor, the review screen and the calendar keep the default size. Validation performed: lint and typecheck. **Not tested**: the cards in a browser (sizes by format, 360 px).

2026-10-20: Shared channel previews now show the existing media skeleton while the file URL is loading, keeping the media frame dimensions stable. Files: `src/components/shared/preview/channel-preview.tsx`. Validation performed: targeted ESLint, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering during slow media URL resolution.

2026-10-20: Shared channel previews leave the caption area empty when no caption is provided. Files: `src/components/shared/preview/channel-preview.tsx`. Validation performed: targeted ESLint, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering.

2026-10-20: The portal profile form now places personal data and password side by side on wide screens and labels in-app notification delivery as "No portal". The layout stacks on small screens. Files: `src/components/shared/settings/profile/profile-page.tsx`, `src/components/shared/notifications/preferences-section.tsx`, `src/routes/portal/_app/profile.tsx`. Validation performed: targeted ESLint, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering at mobile and desktop widths.

2026-10-20: The portal's unread notification badge now keeps its contrast on hover and active rows, and the Avisos link reserves space so its label cannot overlap the badge. Files: `src/components/portal/portal-sidebar.tsx`. Validation performed: targeted ESLint, Prettier, `check:docs` and `git diff --check`. **Not tested**: visual hover behavior in a browser.

2026-10-20: Added the shared notification bell to the portal header. Its "Ver todos" link opens the portal notifications route; it reuses the existing notification query and read/snooze actions. Files: `src/components/portal/portal-shell.tsx`, `src/components/shared/notifications/notification-bell.tsx`, `src/lib/shared/routes.ts`. Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: notification dropdown and actions in a browser with an external account.

2026-10-20: Portal previews now use the configured brand logo in approval detail and calendar hover, plus the shared platform-and-format media frames, failed-media fallback and accessible carousel indicators. Files: `src/components/portal/approvals/portal-approval-page.tsx`, `src/components/portal/calendar/portal-calendar-entry-preview.tsx`, `src/components/shared/preview/revision-view.tsx`, shared preview rules in [channels.md](channels.md#platform-rules-preview-and-validation-guidance). Validation performed: targeted ESLint, TypeScript, Prettier, `check:docs` and `git diff --check`. **Not tested**: Vitest could not start because esbuild returned `spawn EPERM`; visual comparison with each live platform app or browser behavior for every media kind.

2026-10-20: The portal calendar shows the shared events and dates (`portal_list_calendar` returns `events`), each with the icon of its type, and opens a read-only dialog (`PortalEventDialog`) with the time and zone, the place (a link when it is `https://`) and the description. The internal notes never reach the portal. Validation performed: the SQL assertions of `20_calendar_events.test.sql`, typecheck, lint. **Not tested**: the calendar in a browser.

2026-10-26: **"Resultados"** menu item (people with `metrics.portal_view`) with the published result reports of the brand and a page that reads one report (frozen numbers, charts, comments of the manager, next steps, "Salvar em PDF" through the browser). Read only through `portal_metrics_report_list` and `portal_metrics_report_get`. Files: `src/components/portal/metrics/*`, `src/lib/portal/metrics/portal-metrics.functions.ts`, routes `/portal/brands/$brandId/metrics` and `…/metrics/$reportId`, `portal-sidebar.tsx`. Validation performed: pgTAP `28_metrics` (external user of the brand reads the report, another brand and `anon` do not), typecheck, lint, build. **Not tested**: the pages in a browser, at 360 px or printed.

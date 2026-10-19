# Routes

> Every URL of Compasso with its space, required action, owner module and the route file that serves it. Routes are English `kebab-case` segments, plural collections, `$param` for ids (the TanStack Router file convention). Route files only wire the guard, the search params and the page component (base.md section 5.2). The menu (`nav-config.ts`) and `requireAction` must use the **action in this table**. Public site addresses are CMS data and are resolved by the catch-all route.

## 1. Public site (`site` space, group `(site)`)

| URL | Route file | Action | Notes |
|---|---|---|---|
| `/` and any published address (`/servicos`, `/casos/cafe-aurora`…) | `routes/(site)/index.tsx` and `routes/(site)/$.tsx` | none | Resolved by `resolvePublicPath` against published pages; 404/503 per [../spaces/public-site-delivery.md](../spaces/public-site-delivery.md) |
| `/sitemap.xml` | `routes/sitemap[.]xml.ts` | none | From published pages |
| `/robots.txt` | `routes/robots[.]txt.ts` | none | `Disallow: /` until something is published |

Reserved first segments (cannot be page slugs): `admin`, `portal`, `api`, `assets`, `sitemap.xml`, `robots.txt`.

## 2. Authentication (shared, no layout guard)

| URL | Route file | Notes |
|---|---|---|
| `/admin/login` | `routes/admin/login.tsx` | Email + password; redirects by role (admin or portal) |
| `/admin/invite/$token` | `routes/admin/invite.$token.tsx` | Accept invitation, set password |
| `/admin/recover-password` | `routes/admin/recover-password.tsx` | |
| `/admin/reset-password` | `routes/admin/reset-password.tsx` | |
| `/admin/callback` | `routes/admin/callback.tsx` | Auth redirect target |
| `/admin/confirm-email` | `routes/admin/confirm-email.tsx` | |
| `/admin/design` | `routes/admin/_app/design.tsx` | Development only (404 in production): tokens and component states |
| `/admin/pending` | `routes/admin/pending.tsx` | Account `pending` |
| `/admin/access-denied` | `routes/admin/access-denied.tsx` | `rejected` / `suspended` |

## 3. Back office (`/admin`, layout `routes/admin/_app.tsx`, requires an approved account with any back office action)

### Shared

| URL | Action | Module |
|---|---|---|
| `/admin` | any approved internal account | dashboard home (redirects to `/admin/marketing` or `/admin/site` by actions) |
| `/admin/profile` | approved | authentication |
| `/admin/notifications` | approved | notifications |
| `/admin/forbidden` | — | guard target |
| `/admin/library` | `media.view` | media-library |
| `/admin/library/$assetId` | `media.view` | media-library |
| `/share/$token` | public (no session): the page of a share link; `noindex` | media-library |
| `/admin/settings` | any settings action | organization-settings |
| `/admin/settings/organization` | `settings.manage` | organization-settings |
| `/admin/settings/users` | `users.view` | authentication |
| `/admin/settings/roles` | `roles.manage` | roles-and-actions |
| `/admin/settings/policies` | `settings.manage` | organization-settings |
| `/admin/settings/notifications` | `notifications.configure` | notifications |
| `/admin/settings/audit` | `audit.view` | audit |

### Marketing Management (group `(marketing)`)

| URL | Action | Module |
|---|---|---|
| `/admin/marketing` | `brands.view` | dashboard |
| `/admin/marketing/clients` | `clients.view` | clients |
| `/admin/marketing/clients/new` | `clients.create` | clients |
| `/admin/marketing/clients/$clientId` | `clients.view` | clients |
| `/admin/marketing/brands` | `brands.view` | brands |
| `/admin/marketing/brands/new` | `brands.create` | brands |
| `/admin/marketing/brands/$brandId` | `brands.view` | brands (overview tab) |
| `/admin/marketing/brands/$brandId/channels` | `channels.view` | channels |
| `/admin/marketing/brands/$brandId/content` | `content.view` | content |
| `/admin/marketing/brands/$brandId/calendar` | `calendar.view` | calendar |
| `/admin/marketing/brands/$brandId/approvals` | `approvals.view` | approvals |
| `/admin/marketing/brands/$brandId/library` | `media.view` | media-library (filtered) |
| `/admin/marketing/brands/$brandId/members` | `brands.view` (edit: `brands.manage_members`) | brands |
| `/admin/marketing/brands/$brandId/identity` | `brands.view` (edit: `brands.update`) | brands |
| `/admin/marketing/brands/$brandId/settings` | `brands.update` | brands |
| `/admin/marketing/content` | `content.view` | content (all authorized brands) |
| `/admin/marketing/content/$itemId` | `content.view` | content |
| `/admin/marketing/content/new` | `content.create` | content (editor for a new content; search `brand`, `note`, `day`) |
| `/admin/marketing/approvals` | `approvals.view` | approvals |
| `/admin/marketing/approvals/$requestId` | `approvals.view` | approvals |
| `/admin/marketing/calendar` | `calendar.view` | calendar |

### Site and CMS (group `(cms)`)

| URL | Action | Module |
|---|---|---|
| `/admin/site` | `site.view` | cms-site (overview) |
| `/admin/site/pages` | `site.view` | cms-site |
| `/admin/site/pages/$pageId` | `site.view` (save: `site.edit`) | cms-site |
| `/admin/site/services` | `site.view` | cms-site (entries) |
| `/admin/site/testimonials` | `site.view` | cms-site (entries) |
| `/admin/site/portfolio` | `site.view` | cms-site (case studies and authorizations) |
| `/admin/site/navigation` | `site.settings` | cms-site |
| `/admin/site/settings` | `site.settings` | cms-site |
| `/admin/site/seo` | `site.settings` | cms-site |
| `/admin/site/redirects` | `site.settings` | cms-site |
| `/admin/site/publications` | `site.publish` | cms-site |
| `/admin/site/messages` | `site.view` | cms-site (contact messages) |
| `/admin/site/preview/$pageId` | `site.view` | cms-site (full screen, `noindex`) |

## 4. Client portal (`/portal`, layout `routes/portal/_app.tsx`, requires `portal.view`)

| URL | Action | Module |
|---|---|---|
| `/portal` | `portal.view` | portal (brand selection) |
| `/portal/brands/$brandId` | `portal.view` | portal (dashboard) |
| `/portal/brands/$brandId/calendar` | `portal.view` | portal / calendar |
| `/portal/brands/$brandId/approvals` | `portal.view` | portal / approvals |
| `/portal/brands/$brandId/approvals/$requestId` | `portal.view` (decide: `approvals.decide`) | portal / approvals |
| `/portal/notifications` | `portal.view` | notifications |
| `/portal/profile` | `portal.view` | authentication |

## 5. Server routes (no UI)

| URL | Purpose | Protection |
|---|---|---|
| `/api/cron/media-cleanup` | Delete expired upload sessions and orphan objects | `Authorization: Bearer ${CRON_SECRET}` |
| `/api/cron/email-outbox` | Send queued emails with retry | same |
| `/api/cron/due-notifications` | Run `generate_due_notifications()` once a day (the scheduled kinds); the alternative to `pg_cron` | same |
| `/api/cron/notifications` | Only if `pg_cron` is unavailable | same |
| `/api/media/download` (optional) | Streaming download with re-validation | session + authorization |

## 6. Redirect rules

- Signed-in internal user opening `/` of the back office: `/admin` → first space they have actions for.
- User with only portal actions opening any `/admin/*`: redirected to `/portal`.
- User without `portal.view` opening `/portal/*`: `/admin/access-denied` (a terminal page outside both layouts, so no redirect loop); login if no session.
- Unauthenticated: `/admin/login?redirect=<current path>`; `redirect` is validated by `safeRedirect` (paths under `/admin` or `/portal` only).
- Brand ids in URLs are validated against access; a brand the person cannot access returns the **not-found** state, never "forbidden".

## 7. Adding a route

1. Add the row here (URL, action, module, file).
2. Create the route file inside the right group with `beforeLoad: requireAction(...)`.
3. Add the menu item in `nav-config.ts` (same `action`).
4. Update the module document (screens) and the e2e flow if it is a main flow.

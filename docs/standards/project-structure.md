# Folder structure by space

> Where files go in Compasso: type → space → module, and which space may import from which. The import graph is enforced by ESLint (`no-restricted-imports`, one block per space). The rules come from the Memoria Print project, applied here to Compasso's spaces.

## 1. Goal

The project has several spaces and the folders must make the **space** visible in any path. Folders never mix the back office, the portal and the public site.

## 2. The spaces

| Folder | Space | Who uses it | URL |
|---|---|---|---|
| `marketing` | Marketing Management ("Gestão de Marketing"): clients, brands, channels, content, internal side of approvals, calendar | Team, in the back office | `/admin/marketing/...` |
| `cms` | **Site and CMS** ("Site e CMS") space of the back office: pages, services, portfolio, testimonials, navigation, SEO, publishing | Team | `/admin/site/...` |
| `site` | **Public site**: what the visitor sees, drawn from the published version | Visitors | `/`, CMS addresses, `/sitemap.xml`, `/robots.txt` |
| `portal` | **Client Portal** ("Portal do Cliente"): pending items, calendar, approval | External users | `/portal/...` |
| `shared` | What is used by **more than one** space | Everyone | — |

> **Mind the name.** In the back office the space is called "Site e CMS"; in the code its folder is `cms`, so it is not confused with `site`, which is the public site. On screens and texts for the team it stays "Site e CMS".

A `crm` space (planned, not in the MVP) would be added with the same structure.

## 3. Main rule: type → space → module

The file types stay at the top (`components`, `lib`, `hooks`, `assets`, `data`). **Inside each one** there are the space folders and, inside each space, one folder per **module**:

```
src/
  components/
    marketing/ <module>/...
    cms/       <module>/...
    site/      <module>/...
    portal/    <module>/...
    shared/    <module>/...
  lib/       (same division)
  hooks/     (same division)
  assets/    shared/  site/
  routes/    (see section 6)
  routeTree.gen.ts · router.tsx · server.ts · start.ts · styles.css   ← stay at the root of src
```

Each folder answers a question: **type** (what the file is), **space** (who uses it), **module** (which feature it belongs to).

Examples:

| File | Destination path |
|---|---|
| Content variant form | `src/components/marketing/content/variant-form.tsx` |
| Server functions of the content | `src/lib/marketing/content/content.functions.ts` |
| Calendar hook of the portal | `src/hooks/portal/calendar/use-portal-calendar.ts` |
| Approval decision screen piece | `src/components/portal/approvals/decision-panel.tsx` |
| Section editor of the CMS | `src/components/cms/editor/section-fields.tsx` |
| "Hero" section of the home page | `src/components/site/render/hero-section.tsx` |
| Data table reused by the lists | `src/components/shared/admin/data-table.tsx` |

## 4. Modules of each space

| Space | Modules |
|---|---|
| `marketing` | `clients`, `brands`, `channels`, `content` (items, variants, revisions, internal comments), `approvals` (request and follow-up), `calendar`, `dashboard` |
| `cms` | `editor`, `pages`, `services`, `portfolio`, `testimonials`, `navigation`, `seo`, `publishing`, `settings`, `media` |
| `site` | `render`, `layout`, `contact`, `public` (in `lib`: reading the published version) |
| `portal` | `brands`, `approvals`, `calendar`, `comments` |
| `shared` | `ui`, `admin`, `auth`, `media`, `storage`, `supabase`, `calendar`, `editorial`, `preview`, `content`, `notifications`, `email`, `icons`; loose utilities in `lib/shared` (formatting, lists, enums, pagination) and generic hooks in `hooks/shared` |

`shared/content` is **the contract between the Site and CMS space and the public site**: content model, component registry, links, rich text, published snapshot, address resolution, sitemap, schemas. `shared/editorial` holds what `marketing` and `portal` both need: editorial statuses, the revision snapshot schema and the allowed transitions.

The site keeps no content in the code: texts, images and case studies come from the CMS (see [../spaces/public-site-delivery.md](../spaces/public-site-delivery.md)).

## 5. Who may import whom

```
            shared
        ↗    ↑    ↖    ↖
  marketing  cms  site  portal
```

| Space | May import from | Never imports from |
|---|---|---|
| `shared` | itself | `marketing`, `cms`, `site`, `portal` |
| `marketing` | `shared` | `cms`, `site`, `portal` |
| `cms` | `shared` | `marketing`, `site`, `portal` |
| `site` | `shared` | `marketing`, `cms`, `portal` |
| `portal` | `shared` | `marketing`, `cms`, `site` |
| `routes` | all (routes assemble the screens) | — |

Consequences:

- **The Site and CMS space and the public site do not know each other.** They talk through `shared/content`: the editor writes to that model, the site reads from it. If both need something, it goes to `shared/content`.
- **Marketing and portal do not know each other.** What they share (statuses, snapshot model, per-channel preview, calendar, comments) goes to `shared`.
- **The CMS reads data from marketing (for example authorized case studies) only through server functions in the `cms` layer itself**, never importing code from `marketing`.
- **If two spaces need the same piece, it moves up to `shared`**, with its own module. It is not copied and no exception is opened.
- Inside a space, modules may import from one another, but the ideal is for the dependency to go "specific module → more general module".

Import: always through the alias (`@/components/marketing/content/variant-form`). A relative path only **inside the same module** (`./variant-card`). No `index.ts` files that re-export.

This rule is enforced by `no-restricted-imports` in `eslint.config.js`, one block per space, so a violation shows up as a lint error and not only in review.

## 6. Routes

Routes stay in `src/routes` (TanStack Router generates `routeTree.gen.ts` from there) and are organized by space with **route groups**: folders in parentheses, such as `(marketing)`. A group is only organization: it **does not change the URL** and does not create a layout.

```
src/routes/
  __root.tsx
  (site)/                     public site
    $.tsx                     any CMS address
    robots[.]txt.ts · sitemap[.]xml.ts
  admin/
    (shared)/                 access screens: login, invite.$token, recover-password, reset-password,
                              callback, confirm-email, pending, access-denied
    _app.tsx                  back office layout (sidebar, header)
    _app/
      (shared)/               index · profile · notifications · users · roles · forbidden · library/ · settings/
      (marketing)/            marketing/ → /admin/marketing/...
      (cms)/                  site/      → /admin/site/...
  portal/
    _app.tsx                  portal layout
    _app/                     brands/$brandId/...
```

Route rules:

- **One folder per module, with `index.tsx`, `new.tsx` and `$id.tsx`** (for example `clients/index.tsx`, `clients/new.tsx`, `clients/$clientId.tsx`).
- **The route file only assembles the screen**: reads parameters, loads data and uses components from `components/<space>/<module>`. Logic and reusable pieces live in `components`, `lib` and `hooks`, never in the route file.
- **The group does not appear in the URL, but it appears in the route identifier.** The `createFileRoute` of each file carries the group, for example `createFileRoute("/admin/_app/(cms)/site/pages/")`. The TanStack plugin rewrites that line by itself when moving the file with the dev server running; links (`<Link to="/admin/site/pages">`) and `navigate` **do not change**, because they use the URL.
- Folders with `_` (such as `_app`) are layouts with no URL; folders with `( )` only organize. Do not mix the two at the same level.

## 7. Where to put a new file

1. **What type is it?** Component → `components/`. Server function, schema, types, business rule → `lib/`. Hook → `hooks/`. Image or static data → `assets/`.
2. **Who uses it?** Only one space → that space's folder. More than one → `shared`.
3. **Which module is it part of?** Look for the module folder; if it does not exist, create it with the feature name (in English, lowercase, with hyphen).
4. **Do two spaces use the same piece?** Move it up to `shared` with its own module, never import from one space into the other.
5. **Is it a route?** In `src/routes`, inside the space's group (section 6).

Conventions that already apply and stay: code, file names, routes and SQL in English; **documentation in English**; only the interface texts in Brazilian Portuguese; a module has the same name in `components`, `lib` and `hooks`; server function files end in `.functions.ts`.

## 8. How to create a new module

Follow section 7 and run `tsc --noEmit`, `vite build` and `eslint`: a forbidden import shows up as a `no-restricted-imports` error. If a future space is added (for example `crm`), add a `boundary(...)` block in `eslint.config.js` and a row in the tables of sections 2 and 5.

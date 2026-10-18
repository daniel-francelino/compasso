# Public site delivery: everything comes from the CMS

> How the public site (`site` space) gets and serves its content, and what it does when there is nothing to show. The rule is simple: **the code contains no site content**. Text, image, video, menu, footer, case studies, SEO and sitemap come **only** from the published version of the CMS; the code keeps only the **components** (how to draw) and the brand logo. The failure behavior (safe failure, "site in preparation", last good version) comes from the lessons of the Memoria Print site, where an old static copy of the content had to be removed. Companion documents: [cms-site.md](cms-site.md), [cms-dynamic-architecture.md](cms-dynamic-architecture.md), [media-library.md](media-library.md). UI texts are Brazilian Portuguese; everything else is English.

## 1. Rules

1. **A single source of truth.** The public site is a function of the published revisions and settings. Nothing else.
2. **No published version → no site.** Addresses answer as described in section 3. Content is never improvised.
3. **No chosen image → no image.** An empty position draws no figure; "the code's image" does not exist.
4. **No authorized case study → no portfolio item.** Empty sections render nothing (or their component's empty state).
5. **Read failure ≠ never published.** A transient error cannot swap the site: serve the **last good version** from memory and record the error.
6. **The code only keeps what is not content:** components, styles, the brand logo, runtime **system** texts (for example "Página não encontrada", "Site em preparação") and the registry contract.
7. **Preview equals production.** Both use the same `renderPage`; missing images look the same in both.

These rules are enforced by lint (`no-restricted-imports`: the `site` space cannot import from `@/assets/site/**`, `@/data/site/**` or any text dictionary) and by tests (section 7).

## 2. How the site reads content

- Server routes in the `(site)` group: a catch-all `$.tsx` resolves the address against the published pages; `robots[.]txt.ts` and `sitemap[.]xml.ts` generate their files from the published pages.
- The server calls the `security definer` functions `site_published_page(p_slug)` and `site_published_settings()` with the **public key** (no session). No `site_*` table has a policy for `anon`.
- The output is **validated with zod** (`parseOutput`) before rendering; a revision with an unknown `format` is an error, never a guess.
- `resolvePublicPath` (pure function in `shared/content`) maps the address to a page, a redirect or "not found"; it also builds the `<head>` (title, description, social image, canonical, `robots`, `hreflang` when there is more than one language).
- Cache: the response carries `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for the Vercel CDN; an in-memory cache per function instance keeps the **last good version**. On publishing, evaluate invalidation through the Vercel purge API; without it, the short TTL limits the delay to about a minute (a point to validate in phase B/C of the CMS).

## 3. Site states

| Situation | Behavior |
|---|---|
| Published version and the page exists | The page, drawn by `renderPage` |
| Published version, the page does not exist | 404 inside the site layout (no improvised content) |
| **Never published** (RPC answered "no version") | Page "Site em preparação": HTTP **503** with `Retry-After`, `noindex`, no navigation or brand content beyond the logo |
| **Read failed, a good version is in memory** | The last good version (stale-while-error); the error is logged |
| **Read failed, nothing in memory** | The same 503 page; the error goes to `logError` |
| Unpublished page | 404 (and removed from `sitemap.xml`) |
| `sitemap.xml` without a version | 404 or a valid empty sitemap; never fixed URLs |
| `robots.txt` without a version | `Disallow: /` until something is published, so an empty site is not indexed |
| A redirect configured for the address | 301/302 to the destination |

A new deploy starts with no memory: it is the only case where a read error shows 503, and it is visible in the logs and monitoring.

### 3.1 Cache and errors

- **Never store the `null` of an error**; store only valid versions.
- **Keep the last good version** and serve it if a new read fails.
- Distinguish `{ kind: "none" }` (the function answered with no version) from `{ kind: "error" }` (failure) for the 503 page and for the log.

## 4. Components and empty states

Each section renderer must render **nothing (`null`) or its own empty state** when its data is missing, without throwing:

| Section | When data is missing |
|---|---|
| `hero`, `image_text`, `gallery` | A position without an image is omitted; the text still renders |
| `services_grid`, `testimonials`, `faq` | Without items the section is hidden |
| `portfolio_grid` | Without authorized, published case studies the section is hidden |
| `contact_form` | Without a configured endpoint or recipient, the section is hidden and the editor flags an error at publishing |
| Buttons (`link`) | Without a destination, no button is drawn (no default destination) |

## 5. What the CMS must guarantee

Since the code no longer "completes" what is missing, the **CMS is responsible for not leaving holes**: the publish checks ([cms-site.md](cms-site.md), section 6.3) block a publication with required fields or images missing, a case study without authorization, a page without SEO, or the first publication with no visible section on Home. Preview and site are identical because both use `renderPage`.

## 6. Setup and launch checklist

Before the first public launch:

- [ ] At least one publication made in production (Home with visible sections, SEO and social image).
- [ ] All images used are in the Media Library with published public derivatives and alternative text.
- [ ] Settings published (contacts, social networks, default SEO, navigation, footer).
- [ ] The public bucket and the media domain are configured ([r2-storage.md](r2-storage.md)).
- [ ] `sitemap.xml` and `robots.txt` return what is expected for the state (empty before publishing; real after).
- [ ] The "Site em preparação" page was seen with nothing published (503, `noindex`).
- [ ] Lighthouse on Home with LCP target below 2.5 s; `axe` without serious violations.

## 7. Regression protection

- **ESLint**: the `site` space cannot import content from the code (`noSiteContentInCode`), and no space imports `@/assets/site/**`, `@/data/site/**` or text dictionaries.
- **Contract tests**: `resolvePublicPath` returns "not found" for an address without a page; the reader with `none`/`error` never returns a page; an unknown `format` is an error.
- **Component tests**: every section of section 4 renders empty without throwing when its data is missing.
- **Behavior tests (E2E)**: with nothing published the site answers 503 and `robots.txt` blocks; after publishing, changing and clearing a field, then republishing, the site shows the new/empty value, never an old one; emptying the case studies removes the portfolio from the page.

## 8. Acceptance criteria

- [ ] `grep -rE "@/assets/site|@/data/site" src` returns nothing; the `site` space has no hard-coded texts or images (except the logo and system texts).
- [ ] A database with no published version: `/` returns the "site em preparação" page (503, `noindex`), `sitemap.xml` lists no URLs, `robots.txt` blocks.
- [ ] A simulated failure of the published read with a version in memory: the site keeps serving the last good version; without memory: 503 and the error appears in the log.
- [ ] Clearing a text field in a section and republishing makes the site show it empty (not an old text).
- [ ] Preview and site are identical for the same content, including empty positions.
- [ ] `npm run lint` and `npm run build` are clean.

## 9. Open decisions

1. **Page "em preparação".** Own short system text without brand copy plus the logo (recommended), or a static file?
2. **`robots.txt` before the first publication.** `Disallow: /` (recommended) or 404?
3. **Cache invalidation on publishing.** Vercel purge API versus a short TTL; decide with a measurement in the CMS phase B/C.
4. **Redirects.** Created automatically when a slug changes (recommended) or only manually?

## 10. Implementation status

Phase 5 (2026-10-19). Done: `routes/(site)/index.tsx` and `$.tsx` call `getPublicSite` (anon `site_published_page` and `site_published_settings`, zod-validated, with the last good version per address kept in memory and a 4-second timeout); states `none` and read failure answer 503 with `Retry-After` and `noindex`, an unknown address answers 404, a redirect answers 301 or 302; the HTTP status is applied by a request middleware (`src/start.ts`) because the router overwrites a status set inside a loader; `robots.txt` blocks everything until a page is published and `sitemap.xml` lists only published, indexable pages and authorized cases; `<head>` (title, description, canonical, Open Graph, `noindex`, `Organization` JSON-LD on the home page) comes from `buildHead`. The lint rule `noSiteContentInCode` stays and `src` has no `@/assets/site` or `@/data/site` import.

Validated: unit tests for the reader (none, last good version only for the same address, error with nothing in memory, unknown format), `buildHead`, robots and sitemap, and every section rendering empty; Playwright: 503 with `noindex` and the "Site em preparação" page, `robots.txt` with `Disallow: /`, an empty sitemap. **Not tested**: a real published site (the loop publish → read → clear a field → republish), the CDN cache headers and invalidation (decision 3 of section 9 is still open: a 60-second TTL is used), 503 behind Vercel, Lighthouse and `axe`. The Playwright server readiness URL is now `/admin/login` because `/` answers 503 by design.

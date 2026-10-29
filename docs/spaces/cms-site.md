# Site and CMS space

> Specification of the **Site and CMS** space of the back office ("Site e CMS", routes `/admin/site/*`, code folder `cms`) and of how it feeds the public site (`site`). It defines what the team can edit without touching code, how publishing works (working copy + immutable snapshots), the screens, permissions, SEO and phases. The component and page model is in [cms-dynamic-architecture.md](cms-dynamic-architecture.md) and the public delivery rules are in [public-site-delivery.md](public-site-delivery.md). The principles (structured blocks, working copy, immutable published versions, safe failure) come from the Memoria Print CMS; the scope is Aura Creative's own: a professional's website with services, portfolio, testimonials and contact. UI texts are Brazilian Portuguese; everything else is English.

## 1. Why and what for

The public site of a marketing professional must be edited by that person, quickly and safely, without code and without a deploy. At the same time, the system already holds data that could feed the site (authorized case studies, testimonials, files of the Media Library), and nothing should reach the site without an explicit decision.

Goals:

1. The team **edits the site without touching code**: texts, images, services, portfolio, testimonials, contacts, SEO, navigation and section order.
2. **Nothing goes live without an explicit action** ("Publicar"), with preview, history and rollback.
3. **Client work only reaches the portfolio with explicit authorization** (consent note and date), and only through public derivatives of the files.
4. The site **keeps no content in the code** and has a defined behavior when nothing is published ([public-site-delivery.md](public-site-delivery.md)). One temporary exception exists: section 18.

Out of scope (see section 14): online store, blog (optional later), newsletter, analytics, free visual layout editor, client accounts on the site.

## 2. Space boundaries

| | **Marketing Management** (`marketing`) | **Site and CMS** (`cms`) | **Public site** (`site`) | **Client portal** (`portal`) |
|---|---|---|---|---|
| Answers | How is the work going? | What does the site show? | What does the visitor see? | What must I approve? |
| Who uses it | Team | Team | Visitors | Clients |
| Data | Clients, brands, content | Pages, sections, services, portfolio, SEO, settings | Reads only the published version | Reads only shared revisions |
| Routes | `/admin/marketing/*` | `/admin/site/*` | `/`, CMS addresses | `/portal/*` |

Boundary rules:

1. **Marketing Management owns the client and brand facts.** The CMS never duplicates or alters them; it references authorized case studies by id and resolves what to show **on the server**, through its own layer (it never imports code from `marketing`).
2. **The CMS owns the presentation**: how, where and in which language something appears on the site.
3. **Publishing is an act of the CMS.** Archiving a client in Marketing Management does not change the site; but a case study whose authorization is withdrawn **leaves the site on the next publication** and appears as "Sai na próxima publicação" until then, with a notification to people with `site.publish`.
4. **CMS and public site do not know each other**: they talk through the `shared/content` contract.
5. **Separate permissions**: having access to Marketing Management does not give access to the CMS, and vice versa (section 9).

## 3. CMS principles

1. **Structured, not free.** Pages are made of **typed sections** with defined fields (title, text, image, call to action). No free HTML or layout editor. It guarantees brand coherence, security and that the site is always drawn by the same React components.
2. **The brand is a barrier, not an option.** Colors, typography and spacing come from named options of the palette ([color-palette.md](../standards/color-palette.md)), never from free pickers. Text fields keep a character counter and may warn about tone of voice.
3. **One published snapshot.** The team edits a **working copy**; "Publish" validates and generates an immutable **published version**. The public site only reads the latest published version.
4. **Preview = the same site.** The preview renders the **same components** with the draft data, in an `iframe` with language and width selectors, behind authentication and `noindex`.
5. **Safe failure.** If reading the published version fails, the site serves the last good version from memory; with none, it answers 503 "site em preparação".
6. **Publish ≠ share ≠ upload.** Uploading a file never makes it public; only approved derivatives are published, never the private original ([media-library.md](media-library.md)).
7. **Minimum anonymous access.** The visitor has access to no table: only to read functions that return the published version.
8. **Portuguese is the UI language and the default content language**; additional content languages (`en`, `es`) are an option decided in the settings and carry a completeness indicator. The default MVP is a single language.

## 4. Data sources of the site

Each thing on the site has exactly **one** origin:

| Data on the site | Origin | Who edits |
|---|---|---|
| Page texts, section content, SEO | **CMS** (working copy → snapshot) | Site editors |
| Services (name, description, icon, order) | **CMS** (`services` section content) | Site editors |
| Testimonials (quote, author, role, photo) | **CMS** | Site editors |
| Portfolio / case studies | **CMS** pages of kind `case_study`; images from the Media Library; **authorization** (consent note + date) recorded by the CMS | Site editors + whoever may authorize |
| Images and videos | **Media Library**, only published derivatives | Library + `media.publish` |
| Contacts, social networks, WhatsApp, site URL | **CMS settings** | `site.settings` |
| Navigation and footer | **CMS settings** | `site.settings`/`site.structure` |
| Contact messages from the form | Database table `contact_messages` | Read by people with `site.view` |

## 5. Pages and sections

### 5.1 Pages (MVP)

| Page | Kind | Typical sections |
|---|---|---|
| Home | `home` | `hero`, `services_grid`, `portfolio_grid`, `testimonials`, `rich_text`, `contact_form` |
| About | `about` | `rich_text`, `image_text`, `testimonials` |
| Services | `services` | `services_grid`, `faq`, `contact_form` |
| Portfolio | `portfolio` | `portfolio_grid` |
| Case study (one per case) | `case_study` | `hero`, `rich_text`, `gallery`, `testimonials` |
| Contact | `contact` | `contact_form`, `rich_text` |
| Blog post (optional) | `blog_post` | `rich_text` |

Addresses (slugs) are CMS data and may be in Portuguese (`/servicos`, `/portfolio`, `/contato`). System pages (`home`) cannot be deleted or change address.

### 5.2 Section catalog (initial)

`T` = translatable text; `M` = media from the Library.

| Section (`component`) | Fields |
|---|---|
| `hero` | eyebrow T, headline T, subheadline T, image M, primary CTA (label T + link), secondary CTA |
| `services_grid` | title T, intro T, items (icon, name T, description T, link) |
| `portfolio_grid` | title T, case study selection (manual order) or "all authorized", limit |
| `testimonials` | title T, items (quote T, author, role, photo M) |
| `rich_text` | body (Tiptap JSON, closed set of marks) |
| `image_text` | image M, side, title T, text T, CTA |
| `gallery` | title T, 1–12 images M with alternative text |
| `faq` | title T, items (question T, answer T) |
| `contact_form` | title T, intro T, recipient email, consent text T, success message T |

Each section has an optional **anchor**, a `visible` flag and an `appearance` that only stores names from the palette (`background`, `spacing`, `accent`). Adding a section = one registry entry + two components (editor and renderer) + no migration.

### 5.3 Editing rules

- Required fields per section; length limits per field (headline ≤ 80, text ≤ 600) with a visible counter.
- **Hidden sections** keep the content but do not enter the published version.
- **Anchors** belong to the section and are unique per page.
- **Unsaved changes:** warning on leaving (`useUnsavedChanges`).
- **Conflicts:** optimistic locking by `version` (`conflict` error); the interface asks to reload.
- Alternative text is mandatory on content images; decorative images are marked as such.

## 6. Publishing

### 6.1 Working copy and versions

Each page has a working copy (`site_pages.draft_content`) and immutable published versions (`site_page_revisions`). `publish_site_page` freezes the draft into a revision and sets `published_revision_id` in one transaction. The published content is read by `site_published_page(p_slug)` and `site_published_settings()` (granted to `anon`, returning only the published revision; no `site_*` table has an `anon` policy).

| Alternative considered | Why not |
|---|---|
| Reading the working tables directly on the site with a `published` flag | Half-done edits would be visible; no rollback; public reads tied to the working schema |
| **Immutable revision per page (chosen)** | Atomic publishing per page, trivial rollback (republish an old revision), fast cacheable reads |

(A site-wide snapshot, as in the Memoria Print CMS, is an option if the team wants "publish everything together"; it is easy to add on top of page revisions.)

### 6.2 The Publish dialog

"Publicar…" opens a **checklist** (it never publishes blindly):

- ✔ / ✖ incomplete items (missing required fields, `alt`, images without a published derivative, links to unpublished pages, empty menus);
- a summary of the **changes since the last revision**;
- an optional "Nota da versão" field;
- confirmation. **Errors block; warnings do not.**

**Rollback** republishes a previous revision as a new revision, never deleting history. Each publication creates a notification (`site.published`) and an audit event.

### 6.3 Checks before publishing

| Check | Type |
|---|---|
| Required field missing in a visible section | **Error** |
| Image without alternative text, or without a published derivative | **Error** |
| Link to an unpublished or deleted page, or to a missing anchor | **Error** |
| Case study with a withdrawn or missing authorization | **Error** |
| Page without SEO title/description | **Error** |
| Duplicate anchor on a page | **Error** |
| First publication: no visible section on Home | **Error** |
| Page without any visible section | Warning |
| Empty menu in the navigation | Warning |
| Words against the tone of voice | Warning |

### 6.4 Scheduling (later)

A publication can be scheduled for a date between 5 minutes and 90 days ahead; the public read returns the most recent revision **already live**, so no process has to run at the scheduled time. Only one scheduled publication at a time; the content is frozen when it is scheduled. Phase 2 of the CMS.

## 7. Media for the site

The CMS reuses the [Media Library](media-library.md); **there are no independent uploads in the CMS**.

1. The image is uploaded to the Library (private, `site` or `brand` scope).
2. The CMS chooses it in a section; the picker shows only files the person may see.
3. **When publishing**, a public derivative is needed for every referenced image: the two web copies created in the browser at upload (WebP, longest side 400 and 1600 px, no EXIF) are copied to the **public bucket** with a content-hash name and an immutable cache header. Publishing refuses (`media_not_published`) a version with images that are not public; the editor offers "Publicar imagem" (`media.publish`).
4. **The original is never exposed.** An image only leaves the public space when neither the draft nor any published revision uses it.

Rules: alternative text per usage; dimensions stored on the version to avoid layout shift; video needs a poster; the logo is a fixed asset outside the CMS.

## 8. SEO

- Each page has an editable title, description, social image and canonical URL, with **defaults** from the settings; the editor shows a search-result preview and a share-card preview.
- `sitemap.xml` and `robots.txt` are generated from the published pages (never from fixed lists); unpublished and `noindex` pages are excluded. `robots.txt` blocks everything while nothing is published.
- Changing a slug creates a **redirect** (phase 2); slugs are unique per site.
- JSON-LD for `Organization`, `Service` and the case studies.
- Languages: with a single content language there is no language in the URL. If a second language is enabled, routes carry the prefix (`/en/...`) with `hreflang`; this is decided before phase 5.

## 9. Permissions

Actions of the `site` module (see [roles-and-actions.md](../foundations/roles-and-actions.md)); writing requires reading, and the Owner has all.

| Action | Allows | Requires |
|---|---|---|
| `site.view` | See the Site and CMS space, the working copy, history and preview | — |
| `site.edit` | Edit pages, sections, texts, services, testimonials and case studies | `site.view` |
| `site.structure` | Create/delete pages, change addresses, reorder navigation, mark pages for publishing | `site.edit` |
| `site.settings` | Contacts, social networks, navigation/footer settings, default SEO, redirects, contact form recipient | `site.view` |
| `site.publish` | Publish, schedule and roll back | `site.view` |
| `media.publish` | Publish and withdraw public derivatives of images | `media.update` |

Rules:

1. **Whoever edits does not publish by default**: `site.publish` is separate so the "prepare → approve" flow is possible.
2. Authorizing a client's work for the portfolio requires `site.edit` **and** read access to the brand (`brands.view` with brand link), because it exposes brand material.
3. Server functions and SQL policies check the actions; hiding buttons is not enough.
4. Suggested role: **"Editor do site"** with `site.view`, `site.edit`, `media.view`, `media.upload`.

## 10. Screens and navigation

| Route | Screen | Minimum action |
|---|---|---|
| `/admin/site` | **Overview**: published on…, changes to publish, incomplete items, "Ver site" link | `site.view` |
| `/admin/site/pages` | List of pages with status ("Fora do site", "Entra na próxima publicação", "No ar", "Sai na próxima publicação") | `site.view` |
| `/admin/site/pages/$pageId` | **Page editor**: sections on the left (drag/buttons, hide), section form in the center, preview on the right | `site.edit` to save |
| `/admin/site/services`, `/testimonials`, `/portfolio` | Lists and editors of the structured content | `site.edit` |
| `/admin/site/navigation` | Menu and footer | `site.settings` |
| `/admin/site/settings` | Contacts, social networks, languages, default SEO, notice strip | `site.settings` |
| `/admin/site/seo` | Global and per-page SEO with previews | `site.settings` |
| `/admin/site/publications` | History of revisions, differences, rollback, scheduled publication | `site.publish` |
| `/admin/site/messages` | Contact messages received | `site.view` |
| `/admin/site/preview/$page` | Full-screen preview (authenticated, `noindex`) | `site.view` |

```
┌ Início ──────────────────────────────────────────────────────────────┐
│ Seções               │ Hero                          │ Pré-visualização │
│ ⠿ Hero         ●     │ Âncora: [topo]  Fundo: [Creme ▾] │ ┌──────────────┐ │
│ ⠿ Serviços           │ Título       [Estratégia e…]  │ │  (site)      │ │
│ ⠿ Portfólio          │ Subtítulo    […]              │ │              │ │
│ ⠿ Depoimentos        │ Imagem       [Escolher]       │ └──────────────┘ │
│ [+ Adicionar seção]  │ ⚠ falta o texto alternativo   │ ◻ 📱 ▭ 🖥        │
│ [Salvar]  [Publicar…] — Alterações por publicar: 2                    │
└──────────────────────────────────────────────────────────────────────┘
```

All screens follow [admin-layout-and-standards.md](../standards/admin-layout-and-standards.md): `PageHeader`, skeletons in every loading state, four-value status badge, fixed save bar, error with "Tentar novamente", unsaved-changes warning (also when publishing), lists with search and pagination. On mobile the page editor shows one column with tabs "Seções / Campos / Pré-visualização".

## 11. Contact form

A public server function: zod validation, hidden honeypot field, Cloudflare Turnstile, per-IP and per-contact rate limit (for example 3 per hour per contact), consent checkbox, saving to `contact_messages` and a notification (`site.contact_message`) to people with `site.view`; optional email to the recipient configured in the section. No sensitive data in the logs. Messages are managed in `/admin/site/messages` (statuses "Nova", "Respondida", "Descartada"; an internal note).

## 12. Portfolio and case studies with client work

A case study may only enter the public site when it has an **authorization record** in `site_case_study_authorizations`: the page, the brand, the person who authorized, the date and a consent note (at most one active authorization per page; withdrawal sets `withdrawn_at`). See [../reference/data-model.md](../reference/data-model.md) section 7 and the functions `site_case_study_authorize` / `site_case_study_withdraw`. Only files with a **published public derivative** can be used; client logos follow the same rule. Withdrawing the authorization (decision D22, stricter than the first draft):

1. **the case study stops being served at once**: the public read hides a case study page that has no active authorization and drops its card from the portfolio, so revoked consent never waits for the next publication;
2. the next publication of that page is blocked (`case_study_not_authorized`) until it is re-authorized, or the page is unpublished;
3. public derivatives are withdrawn on request (`media.publish`) and only when no draft or published revision uses them.

## 13. Delivery phases and acceptance criteria

| Phase | Delivery | Acceptance criteria |
|---|---|---|
| **A — Space and settings** | `sites`, settings, SEO defaults, publish/rollback of settings, public read by `anon` function, space selector | Changing the WhatsApp in the CMS and publishing changes the site without a deploy; rollback restores the previous one; `anon` reads no `site_*` table |
| **B — Pages and sections** | Section registry, editor, preview, `site_pages`/`site_page_revisions`, publish checks | All the text of Home editable; preview identical to the published site; a required field missing blocks publishing |
| **C — Public media** | `media.publish`, derivatives, media domain, picker in sections | The site serves public URLs with content-hash names; the original remains inaccessible; withdrawing revokes the derivative |
| **D — Structured content** | Services, testimonials, portfolio and case studies with authorization | A case study without authorization cannot be published; withdrawal blocks the next publication |
| **E — Contact and SEO** | Contact form, messages inbox, sitemap/robots, redirects, JSON-LD | Changing a slug does not break links; the sitemap lists only what is published |
| **F — Extensions** | Scheduling, second language, blog | Each item with its own decision |

In every phase: `npm run lint` and `npm run build` clean; UI in Brazilian Portuguese; routes, code and SQL in English; manual tests with a role **without** `site.publish` and another **without** `site.view`.

## 14. Out of scope (for now)

- Online store, cart and payment on the site.
- Client accounts or private areas on the public site (the portal covers clients).
- Blog (optional, later), newsletter, generic forms, comments.
- Free visual editor (dragging elements on screen), themes and design changes: the design is in [design-system.md](../standards/design-system.md).
- Analytics, cookie banner and consent: a separate topic to validate with the privacy policy (LGPD).
- Automatic translation (if added, human review stays mandatory).
- Synchronization with social networks.
- Multi-brand or multi-site.

## 15. Open decisions

| # | Question | Provisional recommendation |
|---|---|---|
| 1 | Single content language or more? | Single (pt-BR) in the MVP; decide before phase F |
| 2 | Who edits the site day to day and who publishes? | Two levels: editor without `site.publish`; the Owner or manager publishes |
| 3 | Blog? | Not in the MVP; the model already allows `blog_post` |
| 4 | One publication per page or "publish everything together"? | Per page, with an optional site-wide release later |
| 5 | Cache invalidation on publishing | Short CDN TTL; evaluate the Vercel purge API in phase B |
| 6 | Who may authorize a client's work for the portfolio? | `site.edit` plus brand access, with the client's consent noted |
| 7 | Contact form: email to the team or only the inbox? | Both; email is optional |

## 16. Relationship with other documents

| Document | Relationship |
|---|---|
| [cms-dynamic-architecture.md](cms-dynamic-architecture.md) | Page, section and navigation model, registry contract, data model |
| [public-site-delivery.md](public-site-delivery.md) | How the public site reads and serves the published version, failure states |
| [media-library.md](media-library.md), [r2-storage.md](r2-storage.md) | Files, derivatives and `media.publish` |
| [roles-and-actions.md](../foundations/roles-and-actions.md) | The `site.*` and `media.*` actions |
| [notifications.md](../foundations/notifications.md) | Publication and withdrawal notices |
| [admin-layout-and-standards.md](../standards/admin-layout-and-standards.md), [design-system.md](../standards/design-system.md) | Interface patterns |

## 17. Implementation status

Phase 5 (tasks P5-01 to P5-05, 2026-10-19): phases A to E of section 13 are built in code; phase F (scheduling, second language, blog) is not.

**Decisions** (also in [../pending-external-setup.md](../pending-external-setup.md) D22 to D28):

1. **Publishing takes a resolved page built in TypeScript.** `publish_site_page(p_page, p_note, p_resolved, p_expected_hash)` receives the page with links and images already resolved (`resolveDraftPage`) and the md5 of the draft it was built from; the function refuses (`draft_changed`) if the draft moved, so the revision always equals what the editor checked. The checks of section 6.3 run in TypeScript before the call and block the publication (`publish_checks_failed`); the database re-checks what it can know (case study authorization, public images).
2. **Withdrawing a case study authorization hides it at once** (stricter than the first draft of section 12): revoked consent never waits for the next publication.
3. **Rich text is a small closed syntax**, not Tiptap: a blank line separates paragraphs, "# " starts a heading and "- " a list. No marks and no HTML, so nothing can be injected and no editor dependency was added.
4. **Services and testimonials are frozen into the section when the page is published**; the portfolio reads the cards of the authorized, published case studies when the page is served.
5. **The contact form recipient email is stored in the section but never published or used yet**: messages reach only the inbox (and the `site.contact_message` notification).
6. **Settings are published as a whole** (`publish_site_settings`), without their own history: rollback exists for pages only.
7. **Scheduling** (`live_from`) and the state "Entra na próxima publicação" are not built; a page is "Fora do site", "No ar" (with or without changes) or "Sai na próxima publicação" (a withdrawn case study).
8. **The public site answers 503, 404 and the redirects through a request middleware** (`src/start.ts`) because the router overwrites a status set inside a loader. Every public read has a 4-second timeout and keeps the last good version in memory.
9. **Per-IP rate limit of the contact form is in memory** (best effort on serverless); the per-contact limit (3 per hour) is in the database.

**Files.** Migrations `20261018101100_site_cms.sql` (tables, RLS, guards, role "Editor do site", kinds available), `…101110_site_functions.sql` (page, entry, settings, redirect, authorization, publish, rollback, contact and public read functions; `media_publish_derivative` and `media_withdraw_derivative`) and `…101120_site_overview.sql`; tests `13_site`, `14_site_content`, `15_site_media_contact`, `16_site_overview`. Contract and logic in `src/lib/shared/content/` (registry, schemas, links, resolver, checks, published format, public image names), renderers in `src/components/shared/site/`, public reading and contact in `src/lib/site/` and `src/components/site/`, routes `(site)/index`, `(site)/$`, `robots.txt`, `sitemap.xml`, server functions in `src/lib/cms/`, screens in `src/components/cms/`, routes `/admin/site/*`, public image publishing in `src/lib/shared/media/publish.functions.ts` with "Publicar para o site" in the media detail, and the public bucket methods in the R2 storage.

**Validated.** 120 SQL assertions on PGlite (isolation by action, structure versus edit versus publish, immutable revisions, hash guard, rollback, redirects and cycles, anon reading no table, withdrawn cases, public images, contact consent and rate limit); 38 unit tests (links, rich text, resolver and checks, SEO, robots, sitemap, public reader with last good version and unknown format, every section rendering empty without throwing and without injecting markup); lint, typecheck, build and the Playwright tests (the public site answers 503 and "Site em preparação", `robots.txt` blocks, the sitemap is empty, every `/admin/site/*` route requires a session).

**Not tested.** Every CMS screen in a browser (the editor, pickers, preview iframe, publish dialog); the real R2 copy to the public bucket and the media domain; Turnstile; a real publish → public site → rollback loop; 503/404 status through the Vercel CDN; Lighthouse and `axe`. Listed in [../pending-external-setup.md](../pending-external-setup.md) (V22 to V26, S14, S15).

**Not done.** Scheduled publication, second language, blog, JSON-LD for services and case studies (only `Organization` on the home page), per-page preview width selector, settings rollback, "Entra na próxima publicação", recipient email delivery of contact messages.
2026-10-19: Aligned CMS settings save and contact-note save actions to the right; page-level save actions remain in the shared header. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. Full typecheck remains blocked by existing calendar and brand-logo type errors outside this change. **Not tested**: browser rendering.

## 18. Temporary exception: landing page of Rayana Vasconcelos

**Decision (2026-10-28):** first the site is built in code to see how it looks; afterwards it migrates to be managed by the CMS. Until then the home `/` renders a landing page ("Rayana Vasconcelos · Social Media", focus on social media management) whose copy and sections live in `src/components/site/landing/`, built with the `effects` of `lost-ui`.

- Scope: only the route `(site)/index`. Every other address still goes through `resolvePublicPath` and the CMS.
- The landing does not read the CMS, so the 503 / "Site em preparação" behavior does not apply to `/`.
- The lint rule `noSiteContentInCode` is unchanged (the copy is not in `@/assets/site`, `@/data/site` or `@/lib/site/i18n`).
- Exit criterion: each landing block becomes a section kind in the catalog (section 5.2) and the home is served from a published page again; then the landing folder and this section are removed.

### 18.1 Contact form on the landing (decided 2026-10-29, implemented 2026-10-29; not yet exercised against a real database)

**Goal.** The single conversion goal of the landing is "a visitor sends a message". The form in the contact block (`#contato`) is the primary action; the Instagram and e-mail links stay as secondary options. All the "Vamos conversar" and proposal buttons keep pointing to `#contato`.

**One pipeline, no new table (GOLD-2).** The form reuses what section 11 already specifies and the code already has: the public server function `submitContactMessage` (zod validation, honeypot `website`, Cloudflare Turnstile, per-IP limit, `withinRateLimit`) → SQL function `site_contact_submit` (consent, validation, per-contact limit of 3 per hour, insert into `contact_messages`, notification `site.contact_message`) → inbox `/admin/site/messages` (permission `site.view`; statuses "Nova", "Respondida", "Descartada"; internal note). No new table, column, route, action, error code, notification kind or audit action is needed.

**Fields (UI copy in pt-BR).**

| Field | Label | Rule |
|---|---|---|
| `name` | "Nome" | required, up to 120 characters |
| `email` | "E-mail" | optional if a phone is given; lower case on the server |
| `phone` | "Telefone ou WhatsApp" | optional if an e-mail is given, up to 40 characters |
| `message` | "Mensagem" | required, up to 4000 characters |
| consent | "Concordo que meus dados sejam usados para responder a esta mensagem." | required checkbox (`contact_consent_required` otherwise) |
| `website` | (hidden honeypot) | must stay empty; a filled value is answered with success and discarded |

At least one of e-mail and phone is required. The submit button says "Enviar mensagem", shows a loading state and cannot be double-submitted; after the server confirms, the form is replaced by "Recebi sua mensagem. Vou responder pelo contato que você informou." Errors use the existing codes and messages of [../reference/error-codes.md](../reference/error-codes.md) (`invalid_input`, `contact_consent_required`, `rate_limited`, `captcha_failed`, `contact_unavailable`) and keep what was typed. When the form is unavailable the block shows the message of `contact_unavailable` and keeps the Instagram and e-mail links as the way out.

**Source.** `source_slug` is `home`, so the inbox shows "pela página /home" for messages that came from the landing.

**Turnstile key on a page without a loader.** The landing has no loader (it must stay cacheable, section 18). A new public server function `getContactConfig` (GET, no SQL, reads the environment through `turnstileSiteKey()`) returns `{ turnstileSiteKey: string | null }`; the form reads it with `useQuery` and the key `QueryKey.Site.contactConfig`, so the cached HTML never carries it. With no key the form is unavailable (above). The same Turnstile widget component of the CMS sections (`TurnstileBox`) is reused; the form component itself is new and lives in `src/components/site/landing/` because the shared `ContactFormSection` is driven by CMS section content and a `SiteRenderContext`. The zod schema is shared by the form and the server function (`src/lib/site/contact-schemas.ts`), the form uses `useFormSubmit`, `TextField`, `TextAreaField` and `FieldMessage`. `useUnsavedChanges` is **not** used: it needs the back office `UnsavedChangesProvider`, which the public site does not have, and the form is a short public one.

**Dependencies that need a person.**

1. Cloudflare Turnstile widget and the two variables (S15 in [../pending-external-setup.md](../pending-external-setup.md)); without them every submission is refused on purpose.
2. The site row and the **published site settings** must exist: `submitContactMessage` reads the `site_id` from `site_published_settings`, so someone with `site.publish` must publish the settings once in `/admin/site/settings`.
3. Someone with `site.view` must be able to open `/admin/site/messages` (the Owner has it; check the starting roles of the people who will answer).

**Security (SEC-10, SEC-11, SEC-12).** Honeypot, Turnstile and both rate limits stay on; the form shows the generic messages above, never reveals whether an e-mail was already used, and logs no personal data (`logError` with the code only). The per-IP limit is in memory (open item V25 of the pending list).

**Acceptance criteria.** (1) A valid submission creates one `contact_messages` row with `status = new`, `consent_at` set and `source_slug = home`, and one `site.contact_message` notification. (2) A person with `site.view` sees it in `/admin/site/messages`; a person without it does not. (3) A filled honeypot creates nothing. (4) Without consent, without e-mail and phone, or with an over-long field, nothing is created and the message is shown next to the field. (5) The fourth message from the same contact within an hour is refused with `rate_limited`. (6) Without Turnstile keys the form shows the unavailable state. (7) 360 px, tablet and desktop, keyboard only, focus on the first invalid field.

**Tests.** The pgTAP cases of `supabase/tests/15_site_media_contact.test.sql` already cover the SQL function; `src/lib/site/contact-schemas.test.ts` (7 cases) covers the shared schema. Still to add: a Vitest test for the `getContactConfig` shape and an E2E `e2e/landing-contact.spec.ts` (Cloudflare publishes always-pass test keys, which the E2E may use through environment variables, never committed).

**Open decisions (recommendation in bold).** (a) There is no privacy policy page yet; the consent sentence states the purpose. **Add a short "Privacidade" page through the CMS before going public.** (b) E-mail delivery of the message to Rayana is not part of this change (D25 of the pending list); **keep it for later and rely on the inbox and the bell notification for now.**

**Landing page of Rayana Vasconcelos (2026-10-28, section 18; content and performance pass 2026-10-29).** Files: `src/components/site/landing/*` (all copy in `landing-content.ts`, taken from Rayana's presentation slides: tagline, services, process, "Prazer, sou a Rayana" and contacts). Blocks: header with `ScrollProgress`; hero with `TextAnimate`, `WordRotate`, `ShimmerButton`, ribbons and sparkles (`landing-ornaments.tsx`) and a photo slot (`landing-hero-photo.tsx`, reads `public/landing/rayana.webp` and renders nothing while the file does not exist); `Marquee` of platforms; services on the hero gradient with `MagicCard` and the `card-offset` class; process on a solid `orchid-light` band; "Método" as four step cards (`landing-method.tsx`); about with `HyperText`, `Meteors`, two short paragraphs and the photo (`heroPhoto`), no scroll-linked `TextReveal`; contact with direct Instagram and e-mail links (no form, so no loader and no `getContactConfig`). The case study of the client Marquise was deliberately left out. Route `(site)/index.tsx` sends `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`. Effect tokens in `styles.css` and `color-palette.md`; `card-offset` in `design-system.md`. E2E in `e2e/auth-guards.spec.ts` (home answers 200 with the landing; the 503 case uses `/servicos`). Audit and fixes: [../audits/landing-performance.md](../audits/landing-performance.md). Icon pass (2026-10-29): the platform marquee shows brand logos (`landing-brand-icon.tsx`, paths from the `simple-icons` package, which has no LinkedIn, so that one uses the lucide icon; monochrome through `currentColor` to keep the token-only color rule); lucide icons added to the process steps, the "Sobre" principles and the header and hero links; `html { scroll-behavior: smooth }` in `styles.css` gives smooth scrolling to every in-page anchor (disabled by the existing reduced-motion rule). New dependency `simple-icons` (CC0, brand paths only, tree-shaken to the 7 icons imported). Not verified in a browser at phone width. Background pass: hero, services and contact use `public/landing/bg-sections.webp` (gradient supplied by the client, recompressed from 5.9 MB PNG to 13 KB) through the token `--image-landing`; the hero photo is `public/landing/rayana.webp` (cutout, right side). The wavy ribbon (`public/landing/ribbon.webp`, 17 KB, transparent) replaces the earlier hero blobs and decorates services and contact.

**Validated**: `tsc --noEmit`, ESLint, Prettier, `check:docs`, screenshots at 1280 px in the dev server, frame rate measured in the dev server. **Not tested**: the hero with the real photo (the file is not in the repository yet), production render and the `Cache-Control` header on Vercel, `axe` contrast, tablet and phone width after the ornaments, Safari/Firefox, `prefers-reduced-motion` per effect, Lighthouse.

**Hero card removed (2026-10-29).** Removed the "Fluxo da semana" card from the hero: `landing-hero.tsx`, `heroFeed` in `landing-content.ts`, and the children slot of `landing-hero-photo.tsx` (no migration). Validated: `npm run lint`, `npm run typecheck`, `npm run check:docs`. Not tested: visual check in the browser, unit and E2E tests.

**Conversion pass (2026-10-29, skill `landing-pages`).** One goal: contact. Hero now has a benefit-led text, the CTA "Quero conversar sobre minha marca" and three proof points taken from the existing copy; new sections `landing-audience.tsx` ("Para quem é", problem and solution) and `landing-faq.tsx` (native `details`, answers only restate facts already on the page); `landing-cta-link.tsx` repeats the CTA after services, process and FAQ; header gets "Dúvidas"; copy of services, process and contact rewritten in first person. Anchors `LandingAnchor.Audience` and `LandingAnchor.Faq`. Validated: `npm run lint`, `npm run typecheck`, Prettier. Not tested: browser rendering at 360 px and desktop, `npm run check:docs`, unit and E2E tests. Pending and not invented: real testimonials or case studies (social proof in 3 places), analytics/conversion tracking, an A/B test plan, and Rayana approving the new copy.

**Hero photo fit (2026-10-29).** The cutout is cropped at the waist, so the hero no longer has bottom padding on the photo column: the photo sits flush on the bottom edge of the section (`lg:items-end`), fills the column width (`max-w-xl`) instead of a fixed `max-h`, and the text column stays vertically centered. Validated: `npm run lint`, `npm run typecheck`. Not tested: browser rendering at 360 px, tablet and desktop.

**Audience cards (2026-10-29).** At the client request, "Para quem é" is back to three cards, now with a lucide icon each (`ChartLine`, `Clock`, `Megaphone`, keyed by `audience.pains[].key`) and a `motion-safe:hover:scale-105` hover. Validated: `npm run lint`, `npm run typecheck`. Not tested: browser rendering, hover at tablet width (no hover on touch).

**Radii and ribbons (2026-10-29).** Landing cards now share one radius, `rounded-lg` (the `card-offset` class, audience cards, process rows, FAQ items, about principles, workspace panel and contact card), with `rounded-md` for icon chips and `rounded-full` only for pills. The ribbons were moved so each bleeds off a section edge and its flat end is clipped (hero top-right and bottom-left, services top-right, contact bottom-left). Checked with Playwright screenshots of the dev server at 1440 and 390 px; not checked at tablet width.

**Método and Sobre redone (2026-10-29).** At the client request, "Método" no longer imitates a Notion page (no status or deadline rows, no `/` command chips; the mock invented a "48 horas" validation window): `landing-workspace.tsx` was replaced by `landing-method.tsx` (four numbered step cards with a short text and three deliverables each; `LandingAnchor.Workspace` became `LandingAnchor.Method`, `workspaceSteps` and `slashCommands` became `method`). "Sobre" dropped `TextReveal` (the scroll-linked reveal made the section about 2000 px tall with large empty areas) for two short paragraphs beside the photo, followed by the three principles. Checked with Playwright screenshots at 1440 and 390 px; the principle cards were not captured (fade-in on scroll). Not tested: tablet width.

**Validation of the 2026-10-29 landing passes (final).** Files: `src/components/site/landing/*` (new `landing-method.tsx`, `landing-audience.tsx`, `landing-faq.tsx`, `landing-cta-link.tsx`; removed `landing-workspace.tsx`), `src/styles.css` (`card-offset` radius), `design-system.md` (public radii). No migration, route, action or error code changed. Run: `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run check:docs`, and Playwright screenshots of the dev server at 1440 and 390 px. Not run: `npm run check:consistency`, `npm run test`, `npm run e2e`, tablet width, keyboard and contrast review, A/B and conversion tracking.

**Header (2026-10-29).** `landing-header.tsx` shows the site mark (`/aura-mark.svg`, the favicon) beside the name and an "Entrar" button (`Link` to `/admin/login`, existing route; glossary term "Entrar") before "Vamos conversar". Below `sm` both buttons are icon-only (`sr-only` labels) so the row fits at 390 px. Validated: `npm run lint`, `npm run typecheck`, Playwright screenshots at 1440 and 390 px. Not tested: the redirect after login, tablet width.

**Footer (2026-10-29).** `landing-footer.tsx` is now a dark `ink` footer in three columns: mark, name and tagline; in-page navigation (`navItems`); Instagram and e-mail (`contact`), plus a legal line, with copy in `footer` of `landing-content.ts`. No year is printed (the Date API is restricted to `dates.ts`). Validated: `npm run lint`, `npm run typecheck`, Playwright screenshot at 390 px (the 1440 px capture cut off the bottom bar, so desktop was not fully seen). Not tested: tablet width, contrast of `orchid-light` on `ink` (same pair as the About section).

**Contact form implemented (2026-10-29, section 18.1).** Files: `src/components/site/landing/landing-contact-form.tsx` (new), `landing-contact.tsx` (form first, Instagram and e-mail as "Prefere falar direto?"), `landing-content.ts` (`contactForm`), `src/lib/site/contact-schemas.ts` (new, shared schema), `src/lib/site/contact-schemas.test.ts` (new), `src/lib/site/public.functions.ts` (`getContactConfig`, schema import), `src/lib/shared/query-keys.ts` (`QueryKey.Site.contactConfig`). No migration. Validated: `npm run lint`, `npm run typecheck`, `npm run check:consistency`, Vitest of `src/lib/site` (18 tests), and in the browser with Cloudflare test keys (field errors, widget, request reaching the server, the unavailable message when the settings are not published). **Not tested:** a real save into `contact_messages` and the message showing in `/admin/site/messages` (no database in this environment), the success view, the notification, the rate limits, the E2E, tablet width and keyboard-only use.

**Contact form hardening (2026-10-29).** The form must never take the landing down, with or without configuration. `getContactConfig` and `submitContactMessage` catch unexpected errors (missing Supabase variables, an unreachable database, a missing published settings row), log them with `logError` and answer the existing `contact_unavailable`; the form shows that message when the config query fails or has no Turnstile key; `LandingContactForm` and the lazy group of the landing sit inside `CatchBoundary`, so a render error hides only that block; `TurnstileBox` reuses one script tag (the duplicate-load warning is gone). Validated in the browser with no configuration, with Turnstile keys but no Supabase variables, and with the server functions answering 500, aborted and invalid JSON: the landing stayed up in all of them. Not reproduced: the exact failure seen on the client machine (the page was fine in every scenario tried), so if it breaks again the browser console message is needed.

**Open items before it goes public**: (1) add `public/landing/rayana.webp` (about 640 x 800, under 150 KB); (2) the "Método" pages are illustrative and labeled as examples; (3) the contact form was removed until Turnstile and the published site settings exist; the form is built (section 18.1), but it still needs the Turnstile keys and the published site settings to send.

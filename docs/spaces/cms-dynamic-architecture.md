# CMS model: sections, pages, navigation and registry

> The technical model of the CMS of Compasso: a **component registry** in code, **pages made of sections**, **navigation** as data, and **immutable published revisions**. It supports [cms-site.md](cms-site.md) (the space specification) and [public-site-delivery.md](public-site-delivery.md) (how the public site reads the result). The idea of a single registry that drives the editor, the validation, the preview and the public renderer comes from the Memoria Print CMS; Compasso starts with a **smaller scope** (predefined sections, no shared-block library, one content language) and keeps the door open for the full model (section 11). UI texts are Brazilian Portuguese; everything else is English.

## 1. The problem it solves

The team must decide *what exists* on the site (which sections, in which order, linked to what), not only *what it says*, **without code**. Code is only needed to create a **new kind of section**, never to use an existing one. The preview and the public site must be drawn by **the same function**, so what is previewed is what is published.

## 2. Concepts

| Concept | What it is | Example |
|---|---|---|
| **Component** | A *type* of piece defined in code: editable fields + the React that draws it. Lives in the **registry** | `hero`, `services_grid`, `rich_text` |
| **Section** (block) | An *instance* of a component with its content, placed on a page | "Hero da Home" |
| **Page** | Address + SEO + ordered list of sections + kind | `/`, `/servicos`, `/casos/cafe-aurora` |
| **Navigation** | Header menu and footer links (data, up to 2 levels) | "Serviços → /servicos" |
| **Link** | A typed destination (page, anchor, URL, WhatsApp, email, phone), validated and resolved when publishing | `{ kind: "page", pageId }` |
| **Site settings** | Global data that is not page content: contacts, social networks, default SEO, notice, languages | `contacts`, `seo_defaults` |
| **Revision** | An immutable frozen copy of a page published at a moment | `site_page_revisions` |

**Golden rule:** *content is data; appearance is a component.* The same component with different content gives different sections, and the same section kind appears on several pages without copies.

## 3. Principles

1. **Single registry.** Each component is described **once** (fields, validation, initial values, renderer). Editor, validation (client, server, publishing), preview and public site derive from it.
2. **A single renderer.** The preview and the public site call the **same** `renderPage(page)`.
3. **Brand as a barrier.** Components accept *choices by name* (`background: ivory | cream | peach`, `spacing: s | m | l`, `accent: violet | coral | orchid`), never free colors, gradients or fonts (see [color-palette.md](../standards/color-palette.md)).
4. **References, not copies.** Pages, anchors and case studies are referenced by id; link text and address are resolved **when publishing**. Renaming a page breaks no link.
5. **Nothing goes out without "Publicar".** Working copy + immutable revisions.
6. **Safe failure.** An unknown component is omitted from the page, never breaking it; no published version → 503; read failure → last good version.
7. **Compatible evolution.** Each component has a `schemaVersion`; changing fields requires a content migration function; old published revisions stay readable.
8. **Few, well-named concepts.** No free visual editor, no loose HTML, no per-section CSS.

## 4. Architecture overview

```
              ┌──────────────── COMPONENT REGISTRY (code, shared/content) ───────────────────┐
              │ hero · services_grid · portfolio_grid · testimonials · rich_text · image_text  │
              │ gallery · faq · contact_form                                                   │
              │ each: fields, initial values, zod schema, Editor, Renderer, data sources       │
              └──────────────▲────────────────────────────────────────────▲───────────────────┘
                             │ defines                                    │ draws
 ┌──── CMS (/admin/site) ────┴───────────────┐                ┌───────────┴───────────────┐
 │ Pages ── sections                         │   Publish      │  renderPage(page)         │
 │ Navigation ── links                       │ ─────────────► │   • preview (iframe)      │
 │ Settings (contacts, SEO, languages…)      │  revision      │   • public site           │
 └───────────────────────────────────────────┘  (immutable)   └───────────────────────────┘
```

Three layers: **registry** (what *can* exist, in code) → **content** (what the team built, in the working copy) → **revision** (resolved and frozen content, what the site reads).

## 5. Data model

Conventions: English table and column names; writes only through SQL functions that check `has_action(...)`; reads through RLS; optimistic locking by `version`. The reference DDL for the MVP is in `technical-architecture-v0.1.md`, section 9.4; below is the extended shape.

### 5.1 Sites and pages

```sql
create table sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  settings jsonb not null default '{}'
);

create table site_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id),
  kind text not null check (kind in ('home','about','services','portfolio','case_study','contact','blog_post','generic')),
  slug text not null,
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  draft_content jsonb not null default '{}',
  published_revision_id uuid,
  version int not null default 1,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table site_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references site_pages(id),
  revision_no int not null,
  content jsonb not null,
  published_by uuid references profiles(id),
  published_at timestamptz not null default now(),
  unique (page_id, revision_no)
);
```

`draft_content` and `content` have the shape `{ title, seo: { title, description, ogImage?, noindex? }, sections: Section[] }`, each `Section` being `{ id, component, schemaVersion, content, appearance, anchor?, visible }`. Rules: a system page (`home`) cannot be deleted or change address; the slug is unique and URL-safe; reserved slugs (`admin`, `portal`, `api`, `sitemap.xml`, `robots.txt`) are refused.

### 5.2 Settings

`sites.settings` keeps only what is global and **not** structure: `contacts` (WhatsApp digits with country code, email), `social`, `languages` (`{ default: "pt-BR", active: ["pt-BR"] }`), `seo_defaults`, `navigation` (menu and footer links), `message_templates` and `announcement`. Each group is validated by a zod schema on the server.

### 5.3 Links

A `Link` is a typed, validated value used by buttons, cards, menu entries and footers:

| `kind` | Fields | Resolved when publishing to |
|---|---|---|
| `page` | `pageId` | the page's `/slug` |
| `anchor` | `pageId`, `sectionId` | `/slug#anchor` |
| `case_study` | `pageId` | the case study page |
| `url` | `url` (`https://…` or path `/…`) | as written; `https` only for external addresses, opened with `rel="noopener noreferrer"` |
| `whatsapp` | `message` (accepts `{{page}}`) | `https://wa.me/<number>?text=…` (the number comes from the settings) |
| `email` | `subject?` | `mailto:` of the settings email |
| `phone` | — | `tel:` |

Every link has `newTab` (default: only external `url` and `whatsapp`). Unknown variables or links to unpublished pages **block** publishing.

### 5.4 Published content format

The public site reads, per page, a resolved JSON with final addresses, so it never resolves ids:

```jsonc
{
  "format": 1,
  "page": { "slug": "servicos", "kind": "services", "title": "…", "seo": {…}, "sections": [
    { "id": "…", "component": "services_grid", "content": {…resolved…}, "appearance": {…}, "anchor": "lista" }
  ]},
  "navigation": { "header": [ { "label": "…", "href": "/servicos", "children": [] } ], "footer": […] },
  "settings": { "contacts": {…}, "social": {…} },
  "media": { "<versionId>": { "small": "https://media…/site/<hash>-400.webp", "large": "…-1600.webp", "width": 1600, "height": 900 } }
}
```

Reading validates this output with zod before rendering (`parseOutput`); an unknown `format` is treated as an error. Old revisions keep their own format and stay readable through a converter.

## 6. Component registry

### 6.1 Contract

```ts
type ComponentDef<C = unknown> = {
  type: SectionKind;
  category: "opening" | "text" | "image" | "collection" | "invite";
  label: string;
  description: string;
  icon: LucideIcon;
  schemaVersion: number;
  fields: FieldDef[];
  appearance?: { background?: Background[]; spacing?: boolean; accent?: Accent[] };
  anchor?: boolean;
  singleton?: boolean;
  required?: boolean;
  data?: DataSource[];
  defaults: () => C;
  migrate?: (content: unknown, from: number) => C;
  Render: (props: { content: C; ctx: RenderContext }) => ReactNode;
};
```

`SectionKind` is an `as const` object (no loose strings). `RenderContext` gives the component what it needs without knowing the CMS: image resolver, link resolver, global settings and the server-resolved data (for example the authorized case studies).

### 6.2 Field types

`text`, `long`, `group`, `list`, `items` (repeaters with min/max), `image`, `gallery`, `choice`, `toggle`, `number`, `accent`, plus:

| Field | Purpose | Validation |
|---|---|---|
| `link` / `links` | Buttons, cards, items | A `Link` (5.3) with `newTab` |
| `pageRef`, `caseStudyRefs` | Hand-picked highlights | They exist and are published/authorized |
| `richText` | Paragraphs with **bold**, *italic*, headings, lists and links | Tiptap JSON, a fixed subset of marks, **no HTML** |
| `video` | Library video with poster | Type/size |

### 6.3 Sections with dynamic data

Some components **read** data resolved on the server instead of copying it, declared in `data`:

| Component | Source | Configuration |
|---|---|---|
| `portfolio_grid` | Case study pages that are authorized and published | `source: 'manual' \| 'all'`, `limit`, `order` |
| `testimonials` | The site's testimonial entries | `limit`, `order` |
| `services_grid` | The site's service entries | `limit`, `order` |
| `contact_form` | The contact form endpoint | visible fields, consent text, recipient |

Any randomness is a declared option (`order: 'random'`) and is drawn **only on the client**, so SSR and hydration match.

### 6.4 System texts

Labels that belong to no section ("Fechar" of a lightbox, "Ver mais", form messages) are **fields of the component that uses them** (for example `contact_form.successMessage`), never a loose "labels" group.

## 7. Screens

Structure in [cms-site.md](cms-site.md), section 10. The block editor behavior:

- **Add section:** a picker by category with description and thumbnail of each component.
- **Section actions (⋯):** move up/down (buttons usable by keyboard, plus drag), duplicate, hide, delete.
- **New pages:** from *templates* (blank, text page, landing) that only prefill sections; afterwards everything is the same.
- **Page settings:** title, address, kind, SEO, status, duplicate, delete (with a warning about links that point to it).
- The "Navigation" screen edits the menu as a tree of up to two levels; each entry has a text and a `Link`; a check on publishing detects links to unpublished or deleted pages and empty menus.

## 8. Publishing and checks

See [cms-site.md](cms-site.md), section 6. Change groups shown in the dialog: `settings`, `navigation`, `pages.<id>`. A rollback restores the working copy from an old revision. Images: all site images come from the Media Library and only approved public derivatives are published.

## 9. Permissions

`site.view`, `site.edit`, `site.structure`, `site.settings`, `site.publish`, plus `media.publish` ([roles-and-actions.md](../foundations/roles-and-actions.md)). Editing a section's content is `site.edit`; changing the structure (what exists and where: pages, addresses, navigation) is `site.structure`. SQL functions always check the action; the interface only hides.

## 10. Phases

Aligned with the CMS delivery phases A to F in [cms-site.md](cms-site.md):

| Phase | Model deliverable | Acceptance |
|---|---|---|
| A | `sites`, settings, `Link` type, `parseOutput` for published reads | Settings published and read through the function |
| B | Registry, single `renderPage`, pages and revisions, checks | Preview equals the published site; unknown component omitted; migration function tested |
| C | `image`/`gallery` fields with public derivatives | No image comes from the code |
| D | Dynamic sections (`portfolio_grid`, `services_grid`, `testimonials`) | Unauthorized case studies never appear |
| E | Contact form section, redirects, sitemap | Slug change keeps working links |
| F | Optional: shared sections, layouts as data, scheduling, languages | Decided per item |

## 11. Possible evolution (not in the MVP)

The Memoria Print CMS evolved to a fuller model. Compasso can follow the same path **only if the need appears**:

- **Shared sections** (`scope = 'shared'` with `site_page_blocks`): one section placed on many pages, edited once; "Used on N pages"; "Unlink".
- **Menus and layouts as entities** (`site_menus`, `site_menu_items`, `site_layouts`) with header and footer components chosen per page and a default per region.
- **Per-language addresses and page hierarchy** (`/a/b/c`).
- **Site-wide snapshot** (format 6 in Memoria Print) that contains pages, menus, layouts and settings together, for "publish everything at once".

## 12. Out of scope

Free visual editor, per-section CSS, loose HTML, sections nested to any depth, arbitrary forms (only the contact form), online store, A/B testing, editable themes/colors (the brand is fixed).

## 13. Open decisions

1. Are `items` repeaters and fixed columns enough, or is a "container" section needed? (Recommendation: `items` only.)
2. Does the team need shared sections from the start? (Recommendation: no.)
3. Rich text: is a subset of marks (bold, italic, headings, list, link) enough, or are images inside the text needed?
4. Page templates: which are the first ones (blank, text, landing, "Sobre")? They need sample content.
5. Show a thumbnail/diff per changed page in the Publish dialog? (Recommendation: yes.)

## 14. Implementation status

Not started. Updated with each delivery: files and migrations involved, validation performed and pending external items.

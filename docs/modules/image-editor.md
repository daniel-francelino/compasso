# Module — Image editor

> **Status: approved on 2026-11-16; phases 1, 2 and 3 delivered in code on 2026-11-17, not yet used in a browser, see "Implementation status".** Reverse engineering of Canva, the feasibility analysis and the specification of the design editor inside Aura Creative (menu "Designs"). The names of section 5 that phase 1 uses are in the registries ([../reference/](../reference/README.md)); the names of later phases (marked "later") are still proposals and may not be used in code before they are registered (GOLD-4). The sister document for video is [video-editor.md](video-editor.md), which reuses the presets, fonts, history and draft autosave of this module. UI copy is Brazilian Portuguese; everything else is English.

## 1. Goal and verdict

Let the team create and adapt post images (feed, carousel slide, story, cover) from a template, a brand's logo, colors and fonts, without leaving the platform, and send the exported image into the content flow (media library → content revision → approval → Instagram).

| Question | Answer |
|---|---|
| Can an editor **in the style of Canva** exist in this project? | **Yes, a focused one.** A layer-based editor (text, image, shape, background), templates, brand kit and PNG/JPEG export is feasible on the current stack. The browser does all the work, which is the same principle as ADR-14. |
| Can it be **Canva itself** (millions of templates, real-time collaboration, AI, print, presentations, whiteboard)? | **No.** Those are separate products with dedicated teams. Do not plan for them. |
| Does it fit the rules? | Yes, with **three documented decisions** to change first (section 3, items D1 to D3). Nothing here needs a weaker security rule. |
| Estimated size (one developer, estimate not a measurement) | MVP of section 4.1: about 6 to 9 weeks. Templates and brand kit: 2 to 3 weeks more. |

Recommended path: build the MVP of section 4.1 on a canvas library (Konva), store designs as versioned JSON, export through the existing media pipeline.

## 2. Reverse engineering of Canva

**Method and honesty.** Canva's source is closed. This section combines (a) what the product visibly does (public behavior), (b) what Canva has published (its engineering blog and job posts) and (c) **inferences** about the architecture. Each row says which one it is. Nothing here was verified against Canva's code.

Public sources: the Canva engineering post on [real-time mouse pointers](https://canva.dev/blog/engineering/realtime-mouse-pointers) (the editor uses websockets and Redis to propagate edits between people editing the same design, target of 3 pointer updates per second for up to 50 users on one design); the engineering post on [drawing in present mode](https://www.canva.dev/blog/engineering/draw-in-present-mode/) (the editor and the presenter are separate code domains); Canva job posts that name a dedicated "Lightspeed Renderer" team and an "Editing Foundations" team ([example](https://jobs.blackbird.vc/companies/canva/jobs/72657275-lightspeed-renderer-senior-software-engineer)). No public document describes the document model or the rendering pipeline.

### 2.1 Functional anatomy

| Area | What Canva does (observed) | Evidence | Needed in Aura? |
|---|---|---|---|
| Pages | A design has one or more pages of a fixed size (px, mm or preset: "Instagram Post 1080×1350") | Observed | Yes: one page per slide; presets for Instagram formats |
| Layers | Elements stacked on a page: text, image, video, shape, line, frame, group, chart, table, sticker | Observed | Text, image, shape, group in the MVP |
| Selection and transform | Click, shift-click, marquee, move, resize with handles, rotate, snap guides to edges, center and other elements, equal spacing, multi-select | Observed | Yes (snap guides are what makes it feel like Canva) |
| Panels | Side panel with tabs: Templates, Elements, Uploads, Text, Brand, Layers; contextual toolbar above the selection | Observed | Templates, Uploads (library), Text, Brand, Layers |
| Text | Fonts (large catalog), size, weight, color, alignment, spacing, line height, effects (shadow, outline), text on a curve, auto-fit | Observed | Fonts, size, weight, color, alignment, line height, shadow |
| Images | Crop and "frame" (image masked inside a shape or placeholder), flip, filters, brightness and contrast, background remover (AI), transparency | Observed | Crop to frame, flip, opacity, simple filters |
| Brand kit | Logos, colors, fonts per brand; locked templates for teams | Observed | Yes, **this is the strongest fit**: Aura already has Brand and brand identity |
| Templates | Huge catalog by category, resizable to other formats ("Magic Resize"), page templates | Observed | A small set per brand; manual resize presets |
| Assets | Stock photos, icons, illustrations, audio, video | Observed | No stock catalog (licensing); use the media library |
| Collaboration | Live cursors, comments, share links, roles | Public (blog) | **No** real-time; use `version` locking (DATA-5) |
| Versioning | Version history and restore | Observed | Yes, through immutable versions (GOLD-8) |
| Export | PNG, JPG, PDF, SVG, MP4, GIF; transparent background; page selection; scale | Observed | PNG and JPEG, scale 1x/2x |
| AI ("Magic Studio") | Generate image, edit, remove background, write text | Observed | Out of scope (out of MVP scope in the architecture) |
| Apps SDK | Third parties add panels and elements | Public ([Apps SDK](https://canva.dev/blog/engineering/how-we-built-the-canva-apps-sdk)) | No |

### 2.2 Document model (inferred)

A design is almost certainly a tree: `design → pages → elements (with children for groups)`, each element with a type, a transform (x, y, width, height, rotation), z-order given by array position, and type-specific properties; assets are referenced by id, never embedded. Edits are small operations on that tree, which is what makes undo/redo, version history and real-time sync possible. This is the standard shape of every layer editor and is what section 5.2 proposes. **Inference, not evidence.**

### 2.3 Rendering (inferred)

Canva has a team called "Lightspeed Renderer", which implies a custom renderer tuned for speed rather than plain DOM. The practical lessons, whatever Canva uses inside: (1) the editing surface needs hardware-accelerated drawing for many layers; (2) text layout must be identical on screen and in export, so text is laid out by the app and not left to the browser's box model alone; (3) export must be deterministic: the same document gives the same pixels. Aura does not need to match Canva's performance: a page has tens of layers, not thousands.

### 2.4 Text

The hardest part of any design editor, and the first thing that breaks a naive build. Needs: font loading before measuring, wrapping at a box width, per-run styles (a bold word inside a sentence), alignment, line height, auto-grow of the box, and **the same result on export**. Canvas libraries draw text but have limited rich text. Proposal: one style per text element in the MVP (no mixed styles inside a box); mixed styles come later.

### 2.5 Export

Render the page at the target size and scale, encode PNG or JPEG. Done on the client in Canva's editor for simple cases and by servers for heavy cases (inference). For Aura the client export fits ADR-14 and avoids server CPU on Vercel.

### 2.6 What Canva has that Aura should **not** copy

Real-time collaboration, a stock catalog (licensing and cost), AI features, print workflows, presentations, whiteboards, an apps marketplace, a template marketplace. Each is a product by itself.

## 3. Fit with this project

| ID | Rule or decision | Effect on this proposal | Resolution |
|---|---|---|---|
| D1 | [../spaces/media-library.md](../spaces/media-library.md) section 1: "Not included in the MVP: advanced image/video editing" | The editor is exactly that | **GOLD-3: change the document first** (base.md 9.1). Proposed wording: the library stays storage; editing lives in its own module that reads and writes through the library |
| D2 | Media library section 7: "SVG, HTML, … and **editable design files are not accepted**" | A design (the editable source) must be stored | Store the design as **JSON in the database** (a document, not an uploaded file); only the **exported PNG/JPEG** enters the library. The rule stays true |
| D3 | Media library: images JPEG/PNG/WebP, 25 MiB, 40 MP; derivatives generated in the browser | Fits | Export goes through the same `requestUpload` / `confirmUpload` path; no new upload path (GOLD-2) |
| — | ADR-14, "no server image processing" | Fits | All rendering in the browser |
| — | GOLD-8, immutable versions | Fits | Each save creates an immutable design version; exports are immutable media versions |
| — | SEC-8, no `dangerouslySetInnerHTML`; SVG not accepted | Fits | The editor never renders user HTML or SVG; text is drawn on the canvas |
| — | UI-9, tokens only, no hex | Applies to the **application UI** (toolbar, panels). **Colors inside a design are user data** (a brand's hex values live in the brand kit) | Brand colors are stored as data, the lint rule is about source code. Confirm with a one-line note in `color-palette.md` when approved |
| — | CODE-1, CODE-7, CODE-13 | No comments, components under 600 lines | An editor tends to produce large files: split by tool and by hook from the first commit |
| — | Spaces: `shared` is the only place two spaces can meet | The editor serves `marketing` (content) and maybe `cms` (site images) | Module in `shared` (`shared/design`), like `shared/media` |
| — | CLAUDE.md item 10, shared UI comes from `lost-ui` | `lost-ui` has no canvas editor | The panels and forms use `lost-ui`. The canvas itself is app-specific; **ask the library owner** whether a canvas kit belongs there ([../lost-ui-requests.md](../lost-ui-requests.md)). Default: it stays in the app |
| — | UI-8 accessibility | Canvas content is invisible to screen readers | Keyboard move/resize (arrow keys), a layers list as the accessible alternative, alternative text per image element |
| — | UI-7 responsive, 360 px | A precise editor is a desktop tool | Declare it **desktop and tablet only**; on a phone show a read-only preview and a message. Needs a recorded decision |
| — | Fonts | The design system loads fonts with `<link>` in `__root.tsx` | The editor needs a **curated font list** (self-hosted or one provider) loaded on demand; licenses checked (section 6) |

## 4. Scope

### 4.1 MVP (phases 1 and 2)

- Pages from presets (feed 1:1, 4:5, story/reel cover 9:16); a design has 1 to 10 pages, so one design is a whole carousel.
- Elements: text, image (from the media library through `MediaPicker`), rectangle, ellipse, line, group.
- Move, resize, rotate, snap guides, multi-select, layer order, lock, duplicate, delete, undo/redo.
- Text: curated fonts, size, weight, color, alignment, line height, one shadow.
- Image: crop inside a frame, flip, opacity, brightness and contrast, alternative text.
- Brand kit: the brand's logo, colors and fonts (from the brand's visual identity), chosen from a panel.
- Save as an immutable design version; restore a saved version into the draft; "Exportar" creates one PNG or JPEG media version per page and tells where to attach it to a content item.
- Autosave of the draft with optimistic locking (`version`).

### 4.2 Phase 3

Templates per brand ("Modelos"), "resize to another format" (a copy of the design in another preset). Still later, not planned: mixed text styles, filters beyond brightness and contrast, image background removal (needs a model, see section 6), comments on a design.

### 4.3 Out

Real-time collaboration, stock catalog, AI generation, print/PDF, presentations, animation (video belongs to [video-editor.md](video-editor.md)).

## 5. Technical design

### 5.1 Rendering library

| Option | Verdict |
|---|---|
| **Konva** (2D canvas scene graph, MIT) with `react-konva` | **Chosen.** Layers, transformer handles, hit testing, export to image and event model are built in; fits a layer editor and React 19 |
| Fabric.js (MIT) | Comparable; fewer React bindings; object model is mutable and imperative, which is harder to keep consistent with a versioned JSON |
| PixiJS (WebGL) | Faster for many sprites; heavier for text and editing handles; choose only if profiling shows Konva is too slow |
| Own renderer on `<canvas>` | Rejected: re-implements hit testing, transforms and text (CODE-12: do not add or build what a library already does) |

Versions in use: `konva` 10.9.1 and `react-konva` 19.3.2 (MIT). The canvas is loaded with `lazy()` in the browser only.

### 5.2 Document model

The design JSON is the source of truth, validated by zod on the server (SEC-6, `designDocumentSchema` in `lib/shared/design/schemas.ts`), with a closed set of element kinds (`DesignElementKind`, never loose strings). The canvas is a **projection** of the JSON: the editor state holds the document, Konva nodes are derived from it and every user action produces a new document. Undo/redo is a stack of whole documents (up to 100 steps); consecutive changes of the same field (typing, a slider, a drag of several elements) merge into one step. Assets are referenced by media version id, never by signed URL (DATA-15); the editor asks the server for fresh signed URLs (`useSignedUrls`, display copy for editing, original for the export).

Shape (version 2, decided 2026-11-17): `{ version: 2, pages: [{ id, background, elements[] }] }` with 1 to 10 pages. Version 1 (`{ version: 1, background, elements[] }`, one page, written on 2026-11-17 before this change) is still read: the reader turns it into a version 2 document with one page and the defaults below, the migration converts the drafts, and saved versions stay as they were (they are immutable). Only version 2 is written.

`background` is `#rrggbb` or `null` (a transparent page, shown on a checkerboard). Every element has `id`, `kind`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `locked` and `groupId` (`null`, or the same id on every member of a group); `x` and `y` are the top-left corner of the unrotated box and the rotation turns around the center of the box; the array order is the layer order (last on top). A **group** is the set of elements of one page that share a `groupId`: selecting one selects all, they move and resize together, and "Desagrupar" clears the id (the document stays a flat list, so every other operation is unchanged). By kind:

| Kind (`DesignElementKind`) | Own fields |
|---|---|
| `text` | `text` (up to 2000 characters), `font` (`DesignFont`), `fontSize` (8 to 400), `bold`, `italic`, `color`, `align` (`DesignTextAlign`), `lineHeight` (0.8 to 3), `shadow` (`null` or `{ color, blur 0 to 100, offsetX, offsetY -200 to 200 }`). One style per element. The height is not set by hand: the text wraps at `width` and the canvas writes back the measured height (without an undo step) |
| `image` | `mediaVersionId` (an image of the same brand), `flipX`, `flipY`, `zoom` (1 to 5), `focusX` and `focusY` (0 to 1), `brightness` (-0.5 to 0.5), `contrast` (-50 to 50), `alt` (up to 300 characters). The image always **covers** its frame: the frame is the crop, `zoom` enlarges the image inside it and the focus says which part stays visible |
| `rect` | `fill`, `cornerRadius` |
| `ellipse` | `fill` |
| `line` | `stroke`, `strokeWidth` (1 to 100), `dashed`. A straight line across the box at mid-height; rotate it for other angles |

Defaults when a field is missing (version 1 documents): `groupId` `null`, `shadow` `null`, `zoom` 1, focus 0.5, `brightness` and `contrast` 0, `alt` empty.

Colors inside a document are **user data** in the form `#rrggbb` (UI-9 is about the application's own interface); the defaults of a new element are read from the palette tokens at run time (`--ink`, `--surface`, `--violet`), and the brand kit offers the brand's own colors, so no color is written in the code. Limits: 10 pages, 100 elements in the whole document and 256 KiB (`design_too_large`). The page size is not in the document: it comes from the preset (`DesignPreset`): `feed_square` 1080×1080, `feed_portrait` 1080×1350, `story` 1080×1920.

Fonts (`DesignFont`), self-hosted from the `@fontsource` packages (SIL Open Font License 1.1, version 5.3.0, Latin subset, weights 400 and 700, normal and italic; Bebas Neue has only 400 normal), loaded on demand with the `FontFace` API under the family names "Design <name>", so the editor never depends on the `<link>` of the application: `dm_sans` "DM Sans", `cormorant` "Cormorant Garamond", `montserrat` "Montserrat", `playfair_display` "Playfair Display", `poppins` "Poppins", `lora` "Lora", `bebas_neue` "Bebas Neue", `inter` "Inter". Text is drawn after its font loads, on screen and in the export.

### 5.3 Data

| Name | Purpose | Phase |
|---|---|---|
| `designs` | One row per design: `brand_id`, `name` (1 to 120), `preset` (`DesignPreset`), `draft_document` (jsonb, the working copy saved by autosave), `current_version_no` (number of the last saved version, 0 when none), `is_template` (phase 3), `version` (optimistic locking, DATA-5), `trashed_at`, `created_by`. `unique (id, brand_id)` | 1, 3 |
| `design_versions` | **Immutable** saved states: `design_id` + `brand_id` (composite foreign key to `designs`, DATA-3), `version_no`, `document`, `created_by`. A trigger refuses update and delete (`design_version_immutable`, DATA-6) | 1 |
| `design_exports` | One row per exported page: `design_id` + `brand_id` (composite foreign key), `version_no` (the saved version that was exported), `page_no` (1 to 10), `format` (`DesignExportFormat`), `scale` (1 or 2), `media_asset_id`, `media_version_id` (unique), `created_by`, `created_at`. Written only by `design_record_export`; no update or delete | 2 |
| `media_usages` | New usage type `design_version` (`usage_ref_id` = the `design_versions.id`): every image a saved version references, so the library counts it as used and refuses to delete it | 2 |
| Actions | `design.view` (requires `brands.view`), `design.create`, `design.update`, `design.delete` (each requires `design.view`). Choosing an image also needs `media.view`; exporting also needs `media.upload` (the upload checks it). Starting roles: `manager` has the four; `collaborator` has view, create and update | 1 |
| Audit | `design.created`, `design.version_saved`, `design.trashed`, `design.restored` (phase 1); `design.exported` (metadata: version number, page number, format), `design.version_restored` (metadata: version number), `design.template_changed` (metadata: the new flag) (phases 2 and 3), all through `audit_write` (entity `design`). Autosave of the draft is not audited | 1, 2, 3 |
| Error codes | `design_too_large`, `design_trashed`, `design_version_immutable`; a stale `version` answers the shared `conflict`; a document with a bad shape, an image of another brand, a template of another brand or an export file that does not match answers `invalid_input`; an unknown version answers `not_found` | 1 |
| SQL functions | `design_create(p_brand, p_name, p_preset, p_document)` (`p_document` optional, phase 3: a template copy or a resized copy), `design_save_draft`, `design_rename`, `design_save_version` (also writes the `design_version` usages), `design_set_trashed`, `design_restore_version`, `design_set_template`, `design_record_export`; internal `design_assert_document`, `design_lock`, `design_upgrade_document`; trigger `design_versions_immutable` | 1, 2, 3 |
| Server functions | `listDesigns`, `getDesign`, `createDesign`, `saveDesignDraft`, `renameDesign`, `saveDesignVersion`, `setDesignTrashed` (phase 1); `listDesignVersions`, `restoreDesignVersion`, `listDesignExports`, `recordDesignExport`, `getDesignBrandKit` (phase 2); `setDesignTemplate` (phase 3); all in `lib/shared/design/design.functions.ts` | 1, 2, 3 |

The tables follow the migration checklist (base.md 5.5): RLS with `design.view` and `can_access_brand`, writes only through the functions, no policy for external users, and no `portal_*` function exposes a design (the portal will only see the exported media of a revision).

Archive instead of delete (GOLD-8): "Mover para a lixeira" sets `trashed_at` and needs `design.delete`; a trashed design cannot be edited (`design_trashed`) until it is restored. Permanent deletion is not offered.

### 5.4 Flow

1. Create from a preset, from a template of the brand ("Modelo", phase 3) or as a copy of another design in another format ("Redimensionar", phase 3). The brand kit loads (logo, colors and fonts of the brand's visual identity).
2. Edit in the browser; draft autosave about 2 seconds after the last change with `version`; a conflict keeps the typed work and asks to reload.
3. **Export** ("Exportar": PNG or JPEG, 1x or 2x): the editor saves a version first, renders every page from the **original** files on an offscreen stage after the fonts load, encodes it, sends it through `sendUpload` (`requestUpload` → PUT → `confirmUpload`, exactly like any file; the server verifies content, size, quota) and records the link with `design_record_export`. A page exported again becomes a **new version of the same media asset** when the person has `media.update`; otherwise it becomes a new file. JPEG needs a background color on every page (a JPEG has no transparency). Images are read with `crossOrigin = "anonymous"`, so the private bucket needs the CORS `GET` rule of [../spaces/r2-storage.md](../spaces/r2-storage.md) section 6 (the same rule the upload already needs).
4. The exported media version is attached to a content item through the existing picker of the content editor. A content revision freezes the **media version**, not the design: later design edits never change an approved revision (GOLD-8).
5. "Versões" lists the saved versions; "Restaurar no rascunho" copies one into the draft (the draft changes, the saved versions never do).

### 5.5 Placement and screens

`components/shared/design/`, `lib/shared/design/` (schemas, server functions, document operations, presets and fonts) and `hooks/shared/design/`. Routes (in the Marketing group, because `/admin/design` is already the development page of the design system): `/admin/marketing/designs` (list) and `/admin/marketing/designs/$designId` (editor), both guarded by `design.view`. Menu entry "Designs" in the "Produção" group of `nav-config.ts`.

- **List ("Designs"):** a card gallery in the layout of section 5.6 (decided 2026-11-17, replaces the table): search by name, tabs "Ativos", "Modelos" and "Lixeira", infinite scroll over server pages; creation is instant from the format circles (no dialog, decided 2026-11-17, section 5.6). Card actions: open, "Usar modelo" (templates), "Redimensionar" (a copy in another format), move to the trash or restore.
- **Editor:** a full-screen workspace in the layout of section 5.7 (decided 2026-11-17, replaces the toolbar, the header and the tabbed side panel of the first delivery). The draft is saved by itself about 2 seconds after the last change, with the saving state always visible; a `conflict` stops the autosave and asks to reload, keeping the work on screen.
- **Selection:** click selects, Shift+click adds or removes, a click on a grouped element selects the group, dragging on an empty area selects by area (marquee); the transform handles cover the whole selection.
- **Keyboard:** the shortcuts of section 5.7. The layers list is the accessible alternative to the canvas: every element can be selected (Shift for several), reordered, locked and removed from it with buttons (UI-8); images carry an alternative text.
- **Phone:** below 768 px the editor shows a read-only message; editing is for tablet and desktop (decided 2026-11-16, an exception to UI-7 for this screen only).
- **Without `design.update`**, or for a design in the trash, the editor opens read-only. "Exportar" also needs `media.upload`.

### 5.6 Layout of the list (decided 2026-11-17)

Reverse engineering of the Canva home screen (public behavior only, from a screenshot of the product): (1) a **hero band** with a soft diagonal gradient, a large centered question with one word highlighted, pill tabs and a wide rounded search field with a colored border; (2) a row of **round quick-create buttons**, one colored circle with an icon per document type and its name below, scrolling sideways when it does not fit; (3) a section title on the left ("Continue designing") with a link on the right; (4) a **grid of cards**: a light gray rounded tile holding the design preview contained and centered with a soft shadow, then the name in bold (one line, ellipsis) and a meta line with a small colored type icon, the type and "Edited 9 hours ago". Nothing of Canva's brand is reused (no name, logo, wordmark or colors): only the structure, with the palette tokens and pt-BR copy.

Mapping to Aura (`components/shared/design/designs-page.tsx` and small parts next to it):

| Canva | Aura |
|---|---|
| Page without a header | No `PageHeader` either (decided 2026-11-17, an exception to UI-6 for this screen): the hero is the top of the page and the format circles are the primary action |
| "What will you Canva today?" | "O que vamos criar hoje?", the word "criar" with a gradient of the `--violet` and `--orchid` tokens; band gradient from `info` to `violet` at low opacity on `surface`; body text keeps the contrast of the palette |
| Pills Home / Templates | Pills "Ativos", "Modelos", "Lixeira" (the existing status filter in the URL, `aria-pressed`). No brand filter (decided 2026-11-17): the list shows the designs of every brand the person can access, until the global brand context (Phase B of the plan) scopes it |
| "Search anything" | Wide rounded field "Buscar designs pelo nome" with the `--violet` border, debounced 300 ms, in the URL (UI-1) |
| Quick-create circles | One circle per format ("Feed quadrado", "Feed retrato", "Story ou Reel") and "Modelos" (goes to the tab); hidden without `design.create` except "Modelos". A format circle **creates the design at once** with the name "Design sem título" and opens the editor, where the name is changed in the top bar (the Canva flow; decided 2026-11-17, the "Novo design" dialog is gone). The brand is the last brand chosen in a creation form of this browser (`StoredKey.CalendarBrand`, the same default as the other creation forms) when the person still has access to it, otherwise the first brand of the person's list; without any brand the circle says "Cadastre uma marca antes de criar um design." The circle is disabled while the creation runs (no double submit) |
| "Continue designing" / "See all" | "Continue criando" (tab Ativos), "Modelos da marca", "Lixeira"; on the right the total ("12 designs"); **infinite scroll** (decided 2026-11-17, an exception to the page number in the URL of UI-1): the next server page of 20 loads when the end of the grid comes into view, with a "Carregar mais" button as the keyboard alternative |
| Card with preview | Tile with the **thumbnail of the last export of page 1** (the `thumb` derivative of that media version, signed URL); a design never exported shows a placeholder drawn at the ratio of its format with the pen icon. "Modelo" badge on templates. The name is the link (focusable); the thumbnail is decorative |
| Meta line | Format icon tinted by format + short format ("Feed 1:1", "Feed 4:5", "Story 9:16") · brand · "Editado há 9 h" / "Editado em 3 de nov." (`formatSocialTime`) |
| Card actions | A "⋯" menu button on the tile (always visible on touch, visible on hover or focus with a mouse): "Abrir design", "Usar modelo" (on a template: creates a copy of it in the same brand, named after it, and opens it), "Redimensionar", "Mover para a lixeira" / "Restaurar" |

Grid: 2 columns at 360 px, 3 from `sm`, 4 from `lg`, 5 from `xl`, 6 from `2xl`. States (UI-2): a skeleton of the same cards, error with "Tentar de novo", empty and no-results (`SearchableEmptyState`). Data: `listDesigns` also returns `thumbVersionId` (the latest `design_exports` row with `page_no = 1` of each design of the page, one extra select on the table, no migration). A live preview of never-exported drafts was rejected for now: it would load every draft document and its images on the list (up to 20 Konva stages); it stays a possible later step.

Implementation steps (task D-08): (1) this section and the glossary; (2) `thumbVersionId` in `listDesigns`; (3) `design-gallery-hero.tsx` (band, tabs, search), `design-quick-create.tsx`, `design-card.tsx` (tile, placeholder, meta, menu), `design-card-grid.tsx` (grid, skeleton); (4) `designs-page.tsx` composes them and keeps the dialogs; `NewDesignDialog` accepts an initial format; (5) lint, typecheck, build, the existing E2E guard.

### 5.7 Layout of the editor (decided 2026-11-17)

Reverse engineering of the workspace of desktop image editors (Photoshop, Affinity; public behavior only, from screenshots): a **vertical tool rail** on the left with exclusive tools and one-letter shortcuts, an **options bar** above the canvas that shows what the active tool or the selection can do, a **pasteboard** (a neutral area larger than the document) with zoom and pan, **docked panels** stacked on the right (transform, properties, layers) and a **status bar** with the size, the cursor position and the zoom. Only the structure is reused: no name, icon set, color scheme or wording of those products. Their pixel features (brushes, pixel selection, masks, adjustment layers, blend modes, Bézier pen) stay **out** (section 4.3): the editor stays a layout editor of section 5.2.

Layout (route with `staticData.fullScreen`, the same mechanism as the site preview: no admin sidebar, no `PageHeader`):

| Area | Content |
|---|---|
| Top bar | "Voltar para designs" (link), the name (editable), brand · format, "Modelo da marca", the saving state, undo and redo, "Versões", "Salvar versão" and **"Exportar" at the top right** (primary action). Below `xl`, a "Painéis" button opens the docked panels in a sheet |
| Alerts | Trash, read-only on a phone, `conflict` and save failure, under the top bar |
| Tool rail (`DesignTool`) | "Mover" (V), "Texto" (T), "Retângulo" (R), "Elipse" (E), "Linha" (L), "Mão" (H), "Zoom" (Z), and "Imagem" (I), which opens the media picker (an action, not a mode). Each button has a tooltip with its shortcut and `aria-pressed`. Hidden when the design is read-only |
| Options bar | With a selection: its name, align left / center / right / top / middle / bottom (`DesignAlign`; one element or one group aligns to the page, more align to the selection), distribute horizontally or vertically (`DesignDistribute`, three or more), bring to front, send to back, group or ungroup, lock, duplicate, delete. Without a selection, a hint for the active tool |
| Viewport | Pasteboard with the page centered and a soft shadow; transparent pages show the checkerboard inside the page only; content outside the page is clipped (it is not exported). Rulers in document pixels on the top and left with the cursor position marked |
| Docked panels (`DesignPanel`) | Collapsible sections stacked in one scrolling column: "Transformar" (X, Y, width, height, rotation, "Manter proporção"; for several elements it edits the bounding box: moving moves all, resizing scales all, rotation is disabled), "Propriedades" (opacity and the properties of the kind, or the page when nothing is selected), "Camadas", "Marca". Which sections are open is kept per browser (`StoredKey.DesignPanels`) |
| Status bar | The pages ("Páginas": select, add, duplicate, move, delete), the page size, the cursor position, the zoom (minus, percentage, plus, "Ajustar à tela", "100%") and "Atalhos" (the list of shortcuts) |

Tools and gestures:

- **Drawing:** with "Texto", "Retângulo", "Elipse" or "Linha", dragging on the canvas creates the element in that box (a line goes from the start point to the end point; Shift keeps a square, a circle or a 45° step); a click without dragging creates the default size centered on the click. Then the tool goes back to "Mover". A new text opens for typing at once.
- **Text on the canvas:** a double click on a text (or creating one) edits it in place over the canvas with the same font, size, color, alignment and rotation; clicking outside or Ctrl+Enter applies, Escape cancels; an emptied text is removed. The text field of "Propriedades" stays.
- **Zoom and pan:** zoom from 10% to 800%, centered on the cursor (Ctrl or ⌘ + wheel, the "Zoom" tool: click zooms in, Alt+click zooms out) or on the view (Ctrl+= / Ctrl+-, the status bar); "Ajustar à tela" (Ctrl+0) and "100%" (Ctrl+1). Pan with the wheel (Shift for horizontal), the "Mão" tool, holding Space, or the middle button. Zoom and pan never create an undo step and never mark the draft as changed.
- **Shortcuts:** V, T, R, E, L, I, H, Z select the tools; Space holds the hand; arrows move the selection by 1 px (10 px with Shift); Delete removes; Ctrl+A selects every unlocked element of the page; Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) undo and redo; Ctrl+D duplicates; Ctrl+G groups; Ctrl+Shift+G ungroups; Escape leaves the text editing, then returns to "Mover", then clears the selection. One-letter shortcuts are ignored while typing in a field.
- **Read-only** (no `design.update`, trash, phone): no rail and no options bar; zoom, pan and the panels in read-only mode still work.

Exceptions to the base rules, for this screen only: **UI-6** (the primary action "Exportar" is at the top right of the editor's own top bar, not of a `PageHeader`, and the breadcrumb is replaced by "Voltar para designs"); **UI-7** as already decided (editing from 768 px). The UI stays in the light theme with the existing palette tokens (pasteboard `muted`, panels `card`); a dark workspace would need new tokens with verified contrast in `color-palette.md` first and was not chosen.

Not in this delivery (later, each needs its own decision): user guides dragged from the rulers (they would be stored in the document, which means a version 3 and a migration), a history panel (the undo stack has no names for its steps), resizable panel widths (`react-resizable-panels`, the peer of the `lost-ui` `Resizable`, is not installed), pinch zoom on touch screens.

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Text fidelity (screen vs export, fonts not loaded) | Looks right on screen, wrong in the file | Wait for fonts before measure and export; one text style per box in the MVP; golden-image tests |
| Font and asset licensing | Legal exposure for client work | Curated list of open-license fonts; no stock catalog; record the license of each font in the docs |
| Large images in memory (a 40 MP photo decoded on a phone) | Tab crash | Edit on a downscaled proxy (the library's display copy), export from the original in tiles or at capped size; tablet/desktop only |
| Large documents | Slow save, big rows | Cap element count and JSON size; assets by reference |
| Canvas accessibility | UI-8 failure | Keyboard operations and a layers list from the first version |
| Scope creep ("it should do what Canva does") | Never finished | The scope of 4.3 is a recorded decision; additions go through section 9.1 of base.md |
| Background removal and AI | Needs a model or a paid API | Out of MVP; if wanted, a separate decision about provider, cost and personal-data handling (SEC-12) |
| Instagram color/size rules | Export is rejected or recompressed | Presets follow [instagram-publishing.md](instagram-publishing.md) limits; export sRGB, JPEG for photos |

## 7. Phases (original estimates)

| Phase | Content | Estimate |
|---|---|---|
| 0 | Decisions D1 to D3 recorded, library choice confirmed with a 3-day spike (text fidelity and export) | 1 week |
| 1 | Document model, store, undo/redo, Konva scene, text and image tools, save/load, migration and pgTAP | 4 to 5 weeks |
| 2 | Export to the media library, attach to content, brand kit, multiple pages, multi-selection, snap guides, line and group, crop and filters, restore a version | 2 to 3 weeks |
| 3 | Templates per brand, resize presets, polish and accessibility pass | 2 to 3 weeks |

## 8. Decisions (2026-11-16)

1. The media library document was changed (D1): the library stays storage and editing lives in this module.
2. The canvas library is **Konva** with `react-konva`. The 3-day spike was skipped by decision, so text fidelity between screen and export is unverified until the export is built.
3. The editor is for desktop and tablet only.
4. Fonts are a short open-license list, to be self-hosted with the brand kit; phase 1 uses the two families the application already loads.
5. `manager` and `collaborator` view, create and update designs; only `manager` moves them to the trash.
6. The Site and CMS space does not use the editor in the first delivery.

## 8b. Decisions (2026-11-17)

1. The images a saved version references are registered in `media_usages` (type `design_version`), so the library counts them as used and refuses to delete them. Images of a draft that was never saved are not registered; a deleted image shows a placeholder.
2. A saved version can be restored into the draft ("Restaurar no rascunho"), audited as `design.version_restored`.
3. The document becomes version 2 with pages (carousel up to 10 pages); a group is a shared `groupId`, not a tree.
4. "Crop inside a frame" is a cover fit with zoom and focus; the filters are brightness and contrast only.
5. Fonts are self-hosted from `@fontsource` (eight families, OFL).
6. Templates are designs marked "Modelo da marca" (`is_template`); "Redimensionar" creates a new design (a copy), it never changes the source.
7. "Attach to a content item" uses the existing picker of the content editor: the export says where the files are and does not change a content draft by itself.

## 8c. Decisions (2026-11-17, editor layout)

1. The editor takes the workspace layout of section 5.7 (tool rail, options bar, pasteboard with zoom and pan, docked panels, status bar) in full screen.
2. UI-6 exception for this screen: "Exportar" at the top right of the editor's top bar; "Voltar para designs" instead of the breadcrumb.
3. Light theme with the existing tokens; no dark workspace.
4. Pixel-editing features stay out (section 4.3); guides stored in the document, a history panel and resizable panels are later.

## 8d. Decisions (2026-11-17, list)

1. The list has no `PageHeader`; the hero is the top of the page (UI-6 exception for this screen).
2. Infinite scroll over the server pages, with "Carregar mais" as the keyboard alternative; the page number leaves the URL (UI-1 exception).
3. A format circle creates "Design sem título" at once and opens the editor; templates are used from their card ("Usar modelo"); the "Novo design" dialog is removed.
4. No brand filter and no brand choice on the list: the brand of a new design is the remembered creation brand or the first accessible one, until Phase B (global brand context) replaces it.

## 9. Acceptance criteria

- A click on "Feed quadrado" opens the editor of a new "Design sem título" without any dialog; renaming it in the top bar shows the new name in the list.
- Scrolling to the end of the list loads the next 20 designs; "Carregar mais" does the same by keyboard.
- Create a design from a preset, add text and an image from the library, move, resize and undo with the keyboard and the mouse.
- Reload the page: the design is identical; two tabs editing the same design produce a `conflict`, never a silent overwrite.
- Export a PNG: the file passes the same validation as any upload and looks identical to the screen (text included).
- The exported file attached to an approved revision is unchanged when the design is edited afterwards.
- A user of brand A cannot list, open or export a design of brand B, even by id (pgTAP matrix per base.md 5.6); an external user reaches no design.
- Works at tablet width; at 360 px it shows the read-only message; layers list is reachable by keyboard.
- A carousel of three pages exports three files; exporting again adds a version to each of the same three assets.
- An image used by a saved version cannot be deleted from the library.
- Restoring version 1 brings its content back into the draft; version 1 itself is unchanged.
- A template of brand A is offered only when creating a design of brand A; "Redimensionar" keeps the source design unchanged.
- The editor opens in full screen with the whole page visible ("Ajustar à tela"); zooming to 400% around the cursor and panning keep the point under the cursor fixed and do not mark the draft as changed.
- Dragging with "Retângulo" creates a rectangle of that box; a click creates the default size; dragging with "Linha" creates a line between the two points; the tool goes back to "Mover".
- A double click on a text edits it on the canvas; Escape cancels; clicking outside applies with one undo step.
- Selecting three elements and "Distribuir na horizontal" leaves equal gaps; one element "Centralizar na horizontal" centers it on the page.
- Changing the width in "Transformar" with two elements selected scales both.

## Implementation status

**Phases 1, 2 and 3 delivered in code on 2026-11-17** (tasks D-02 to D-07). The registries were written on 2026-11-16 (phase 1) and 2026-11-17 (phases 2 and 3), before the code. The analysis of Canva uses public sources and inference only (section 2); the effort figures are estimates.

Migrations:

- `20261116100000_design.sql` (phase 1): tables `designs` and `design_versions`, the four actions and their role seeds, `design_create`, `design_save_draft`, `design_rename`, `design_save_version`, `design_set_trashed`, internal `design_assert_document` and `design_lock`, trigger `design_versions_immutable`, `audit_write` with the four first `design.*` actions.
- `20261117100000_design_phases_2_3.sql`: usage type `design_version`, column `designs.is_template`, table `design_exports`, `design_upgrade_document` (version 1 to 2) and the conversion of the drafts, `design_assert_document` for version 2 (pages, `line`), `design_create` with the optional document (the three-argument version was dropped), `design_save_version` writing the usages, `design_restore_version`, `design_set_template`, `design_record_export` (the file must be an available image of the same brand, of the declared type, uploaded by the caller), `audit_write` with `design.exported`, `design.version_restored`, `design.template_changed`.
- pgTAP `31_design.test.sql` (30 assertions, now on version 2 documents) and `32_design_phases.test.sql` (24 assertions: upgrade, pages, other brand, page limit, usages, export rules, restore, template, audit, brand isolation, no delete on exports); `01_auth_roles_profiles.test.sql` counts 59 actions.

Code:

- `src/lib/shared/design/`: `types.ts`, `schemas.ts` (version 2 with pages, groups, line, shadow, crop, filters, alt; version 1 read and converted), `document.ts` (pure operations on pages and elements: groups, selection, cover crop, snapping, resize to another preset, brand fonts), `history.ts`, `fonts.ts` (eight `@fontsource` families through `FontFace`), `browser.ts`, `design.functions.ts` (13 server functions), `document.test.ts` (22 Vitest cases).
- `src/lib/shared/brands/visual-identity.ts`: the visual identity schema moved here from `lib/marketing/brands/schemas.ts`, because the editor (shared) reads the brand kit and a space never imports another.
- `src/hooks/shared/design/`: `use-design-editor.ts` (pages, multi-selection, groups), `use-design-autosave.ts`, `use-design-assets.ts` (display or original copies, fonts), `use-design-shortcuts.ts`, `use-design-export.ts` (render page by page, `sendUpload`, `recordDesignExport`).
- `src/components/shared/design/`: `designs-page.tsx` (tabs "Ativos", "Modelos", "Lixeira", "Redimensionar"), `resize-design-dialog.tsx`, `design-editor-page.tsx`, `design-workspace.tsx`, `design-canvas.tsx` (multi-selection, transform of the whole selection, snap guides), `design-element-node.tsx`, `design-pages-strip.tsx`, `design-properties-panel.tsx`, `design-text-properties.tsx`, `design-image-properties.tsx`, `design-shape-properties.tsx`, `design-layers-panel.tsx`, `design-brand-panel.tsx`, `design-versions-dialog.tsx`, `design-export-dialog.tsx`, `design-name-field.tsx`, `design-save-status.tsx`.
- List as a card gallery (section 5.6, task D-08, 2026-11-17): `design-gallery-hero.tsx`, `design-quick-create.tsx`, `design-card.tsx`, `design-card-grid.tsx`, `designs-page.tsx` rewritten (the `DataTable` is gone from this screen), `new-design-dialog.tsx` takes an initial format, `listDesigns` returns `thumbVersionId` (latest export of page 1), `formatEdited` in `format.ts`, `DESIGN_PRESET_SHORT_LABEL`. Verified by typecheck, lint, Vitest, `check:docs`, `check:consistency` and `vite build` (the gradients compile to the palette tokens). **Not seen in a browser**: the layout at 360 px, tablet and desktop, the hover menu, the thumbnails (they need an exported page 1 and the bucket CORS rule) and keyboard navigation were not checked.
- Shared with the video editor on 2026-11-17 (no behavior change): the autosave logic moved to `src/hooks/shared/use-draft-autosave.ts` (`use-design-autosave.ts` is now a thin wrapper), the file-name slug of the export moved to `src/lib/shared/file-name.ts`, and `design-name-field.tsx` takes an optional label and id. Verified by typecheck, lint and Vitest only; the design editor was not reopened in a browser.
- Routes, menu item, `Action.Design`, `AuditAction.Design` (seven actions) and labels, `QueryKey.Design`, `AppRoute.Designs`, `errors.ts`, `database.types.ts`, `routeTree.gen.ts`, `check:consistency` (`designs.preset`, `design_exports.format`), `e2e/auth-guards.spec.ts` (the list route without a session). Dependencies: `konva` 10.9.1, `react-konva` 19.3.2, `@fontsource/*` 5.3.0 (eight packages, OFL-1.1).

- **Editor layout of section 5.7 (tasks D-09 to D-11, 2026-11-17):** the route has `staticData.fullScreen`; `design-workspace.tsx` now only wires data and actions; new `design-top-bar.tsx`, `design-tool-rail.tsx`, `design-context-bar.tsx`, `design-viewport.tsx` (pasteboard, page backdrop, clip), `design-rulers.tsx`, `design-text-overlay.tsx`, `design-draft-shape.tsx`, `design-panel-dock.tsx` (`StoredKey.DesignPanels`), `design-transform-panel.tsx`, `design-status-bar.tsx`; `design-canvas.tsx` takes an optional `view` (zoom, pan, stage size) and keeps the old page-sized stage for the export; geometry and the selection buttons left `design-properties-panel.tsx` (now in "Transformar" and the options bar); `design-toolbar.tsx` removed. Hooks: `use-design-viewport.ts`, `use-design-tool.ts`, `use-canvas-gestures.ts` (draw, marquee, pan, wheel, zoom tool, pointer capture), `use-design-shortcuts.ts` rewritten (tools, Space, view keys, Ctrl+A; Space is left alone on a focused button). Pure code with Vitest: `lib/shared/design/viewport.ts` (fit, zoom around a point, steps, ruler ticks, boxes, 45° snap; 8 cases) and `arrange.ts` (align, distribute, transform of the selection, marquee, placement, line between points, drawn element; 12 cases). `lib/shared/value-store.ts` is the generic store the video `createClock` now uses (no behavior change). Enums `DesignTool`, `DesignAlign`, `DesignDistribute`, `DesignPanel` and new `DESIGN_LIMITS` entries for the view.
- **List changes of 8d (task D-12, 2026-11-17):** no `PageHeader`, no brand filter, infinite scroll (`useInfiniteQuery` + `useInView` sentinel + "Carregar mais") in `designs-page.tsx` and `design-card-grid.tsx`; `use-create-design.ts` creates "Design sem título" from a format circle or a copy from "Usar modelo" and opens the editor; `new-design-dialog.tsx` removed. Global pointer cursor for enabled buttons in the base layer of `styles.css` (design-system section 4).
- Verified for both: `npm run lint`, `npm run typecheck`, `npx vitest run` (377 tests), `npm run check:consistency`, `npm run check:docs`, `vite build`. **Not tested:** nothing of the new layout or the list was opened in a browser: zoom and pan feel, wheel and trackpad behavior, pointer capture outside the viewport, drawing, marquee, text editing on the canvas (the textarea is an approximation of Konva's text metrics and may shift a few pixels), rulers, the docked panels and the sheet below `xl`, tablet width, the instant creation and its brand choice, the infinite scroll trigger, the cursor rule across the app. The export path was not touched beyond the optional `view`, and it was not re-run either.

Validation performed (2026-11-17): `npm run db:verify` (1209 assertions, 0 failures, PGlite), `npm run check:consistency`, `npm run check:docs`, `npm run typecheck`, `npm run lint`, `npm run test` (336 tests), `npx playwright test e2e/auth-guards.spec.ts` (42 passed; the older login-form test is flaky and passed on retry). With `vite dev`, every new module compiles (the font files resolve as assets) and the routes answer on the server (redirect to the login without a session).

**Not tested:** nothing was used in a browser with a signed-in user. None of the acceptance criteria of section 9 was exercised by hand: drawing, dragging, the transform handles, multi-selection, snap guides, groups, pages, fonts on screen, the brand kit, autosave and the conflict between two tabs, versions and restore, templates, resize, keyboard, tablet width, the 768 px message, and above all **the export** (rendering, upload, recording, screen versus file fidelity, CORS). No Playwright flow with a session; `supabase test db` on Docker was not run.

Both migrations were **applied to the linked project (Compasso, production) on 2026-11-17** with `npx supabase db push`; `supabase migration list` shows them on both sides, and `database.types.ts` was regenerated from the project with `node scripts/db-types.mjs --linked` (CLI output; typecheck passes).

Known gaps and pending items:

- Images are read with `crossOrigin = "anonymous"` (needed for the export and the filters). The private bucket must send the CORS `GET` rule for the app origins ([../spaces/r2-storage.md](../spaces/r2-storage.md) section 6, item S11 of the external setup); without it the editor shows "Imagem indisponível". A browser cache entry of the same signed URL loaded earlier without CORS could also block it; not verified.
- A new version of an existing media asset needs `media.update`. A `collaborator` (who has only `media.upload`) therefore creates new files each time it exports; a `manager` adds versions to the files of the previous export of each page.
- "Attach to a content item" is the existing picker of the content editor; the export dialog tells where the files are and links to them in the library.
- Text is edited in the properties panel, not on the canvas; snapping works on unrotated boxes (rotated elements are ignored as targets); a multi-selection is moved, resized and rotated together but its properties are edited one element at a time.
- Without `design.update`, for a design in the trash and below 768 px the editor is read-only, as section 5.5 says.

Sources: [Canva engineering: real-time mouse pointers](https://canva.dev/blog/engineering/realtime-mouse-pointers), [Canva engineering: draw in present mode](https://www.canva.dev/blog/engineering/draw-in-present-mode/), [Canva engineering: Apps SDK](https://canva.dev/blog/engineering/how-we-built-the-canva-apps-sdk), [Canva job post: Lightspeed Renderer](https://jobs.blackbird.vc/companies/canva/jobs/72657275-lightspeed-renderer-senior-software-engineer).

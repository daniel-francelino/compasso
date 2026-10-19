# Compasso design system

> Single reference for whoever designs or builds interface in Compasso: tokens, typography, component states, the component kit and layout patterns. It respects the brand palette in [color-palette.md](color-palette.md) (which defines every color, its contrast ratios and the `styles.css` tokens) and complements [admin-layout-and-standards.md](admin-layout-and-standards.md) (layout and patterns of the back office) and [base.md](base.md) (cross-cutting rules). The mechanics (tokens in `styles.css`, shadcn/ui kit, lint that forbids loose colors) come from the Memoria Print project; the brand, palette and components are Compasso's own. UI copy is Brazilian Portuguese; everything else is English.

## 1. Principles

1. **Tokens are the source of truth.** Color, font, radius and shadow come from `src/styles.css`. A new value enters there first, never directly in a component.
2. **Contrast first.** Body text keeps AAA (7:1) on its intended surfaces; the palette document lists the verified pairs. A new color pair is checked before use.
3. **Brand as a barrier, not an option.** Only the palette tokens exist. No hex, no pure black/white, no default Tailwind palette (`red-500`…). ESLint enforces it.
4. **State is never color alone.** Every state has an icon or text next to the color.
5. **Three surfaces, one language.** The **back office** (`/admin`) is dense and functional; the **client portal** (`/portal`) is mobile-first, calm and reassuring; the **public site** is editorial and warm (the only place for the decorative gradient). They share tokens and typography, not presentation components (section 9).
6. **Reuse before creating.** If a component exists in `shared/ui` or `shared/admin`, use it. A new component is born only when a pattern repeats in two places.
7. **UI copy in Brazilian Portuguese**, clear and direct; props, code and documentation in English.

## 2. Where things live

| What | Where |
|---|---|
| Tokens, base layers, global utilities, rich-text editor style | `src/styles.css` |
| Interface primitives (button, field, dialog, table…), adapted shadcn/ui | `src/components/shared/ui/` |
| Back office kit (page header, lists, forms, empty states…) | `src/components/shared/admin/` |
| Components used by marketing and portal (calendar, status, preview) | `src/components/shared/{calendar,editorial,preview}/` |
| Components per space | `src/components/{marketing,cms,site,portal}/` (a space does not import from another) |
| `cn()` utility (joins classes) | `src/lib/shared/utils.ts` |
| Date, time zone and number formatting | `src/lib/shared/format.ts` |
| Fonts | `<link>` in `src/routes/__root.tsx` (**never** a remote `@import` in the CSS) |
| Logo | `src/assets/shared/` (fixed asset; do not recolor or distort) |

Stack: Tailwind CSS v4 (`@theme inline` in CSS, no `tailwind.config`), Radix UI, `class-variance-authority` (variants), `lucide-react` (icons), `sonner` (toasts), Tiptap (formatted text). The public site may use `motion` for entrance animations.

## 3. Tokens

### 3.1 Colors

The full table (brand colors, warm neutrals, state colors, editorial status map, verified contrast and the CSS variables) is in [color-palette.md](color-palette.md). Summary of roles:

| Role | Token |
|---|---|
| Page background | `ivory` |
| Cards, panels, popovers | `surface` |
| Secondary background, `muted` | `cream` |
| Main text | `ink` |
| Secondary text | `ink-soft` |
| Primary action, links, focus ring | `violet` (hover `violet-deep`) |
| Interactive borders (inputs, outlined buttons) | `line-strong` |
| Decorative borders and dividers | `line` |
| Sidebar | `peach`, active item `orchid-light` |
| Success / warning / danger / info | `success` (`cactus`), `warning`, `danger`, `info` |
| Ornaments only (never text) | `violet-bright`, `orchid`, `coral` |

**Usage rule:** in the back office prefer **semantic** tokens (`text-muted-foreground`, `bg-card`, `border-border`). Brand names (`text-ink`, `bg-orchid-light`) are for the public site, the portal and colored states.

### 3.2 Typography

| Role | Typeface (proposal, to confirm with the brand material) | Class | Use |
|---|---|---|---|
| Body and interface | **DM Sans** (or Inter) | `font-sans` (default) | All running text, 16 px minimum for body |
| Headings | **Cormorant Garamond**, weight 600–700, 20 px or larger | `font-display` | Page `h1`, card and section titles, public site headlines |

Heading utilities (no size tokens scattered around): `heading-page`, `heading-section`, `heading-card`. Scale in the back office: page title `heading-page` (`text-3xl`), card title `heading-card` (`text-xl`), body `text-sm` (tables, forms) or `text-base` (touch), auxiliary `text-xs` / `text-sm text-muted-foreground`. On touch devices (`pointer: coarse`) the base rises to about 106 % and everything in `rem` follows: do not use `px` for text.

### 3.3 Spacing, radii, shadows

- **Spacing:** Tailwind default scale. Between blocks of a back office page `space-y-6`; inside a form `space-y-5`; inside a field `space-y-1.5`. Back office content width: max **72 rem**; forms and dialogs `max-w-md`–`max-w-4xl`. Public site sections: `px-6 py-24 lg:py-32`, container `mx-auto max-w-6xl`.
- **Radii** (`--radius: 0.75rem`): `rounded-md` for buttons, fields and badges of the back office; `rounded-xl` for cards; `rounded-2xl` for panels and empty states; `rounded-full` for pills and avatars.
- **Shadows:** the Tailwind scale only (`shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`). On the public site, warm shadows may use brand tokens with opacity.

### 3.4 Motion

- Respect `prefers-reduced-motion` in every animation, including entrance animations of the public site.
- Back office and portal: minimum motion (`transition-colors`, `animate-pulse` on skeletons, `animate-spin` while loading); entrance animations of dialogs and drawers come from `tw-animate-css`.

### 3.5 Dark mode

Not supported in the MVP. Do not add `dark:` classes. If it is decided later, it needs its own token set and a new contrast verification.

## 4. Component states

Every interactive component covers the six states of [base.md](base.md) section 13:

| State | How it is expressed | Example |
|---|---|---|
| **Normal** | Semantic tokens | `bg-primary text-primary-foreground` |
| **Hover** | `violet-deep` for the primary action; `accent` surface for items | `hover:bg-violet-deep`, `hover:bg-accent` |
| **Focus** | A 2 px `ring` in `violet` with an `ivory` offset, visible by keyboard: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | `Button`, `Input`, `IconButton` |
| **Disabled** | `disabled:opacity-50` + `disabled:pointer-events-none` **and** the **reason** in a tooltip (`WhyDisabled`); the text keeps 4.5:1 | `Button`, `WhyDisabled` |
| **Loading** | `Button loading`: disabled, spinner in the middle, content hidden (width does not change); lists with `Skeleton`; containers with `aria-busy` | `ListSkeleton`, `DataTable` |
| **Error** | Field: `aria-invalid` + `text-destructive` message below; form: `FormError` (`role="alert"`); page: `EmptyState` with "Tentar novamente" | `Field`, `FormError` |

Rules:

- A button in loading state is **disabled** (no double submit), keeps its width and, if the operation fails, the filled-in data.
- Touch targets: with `pointer: coarse` controls rise to **44 px** (`pointer-coarse:h-11`).
- Focus is never removed without a replacement.
- Error text explains what to do, in Brazilian Portuguese, without internal codes.

## 5. Primitives (`shared/ui`)

shadcn/ui style adapted to the tokens. Do not edit Radix behavior; only adjust classes.

| Component | Variants / sizes |
|---|---|
| **Button** | `default` (violet), `destructive`, `outline` (border `line-strong`), `secondary`, `ghost`, `link` · sizes `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (h-9 w-9) · all grow on touch |
| **Badge** | `default`, `secondary`, `destructive`, `outline` (base of the status badges) |
| **Alert** | `default`, `destructive` |
| **Input / Textarea / Select** | Height 36 px (44 px on touch), border `input` (`line-strong`), transparent background |
| **Card** | `rounded-xl border bg-card shadow` + `CardHeader/Title/Description/Content/Footer` |

Available in `src/components/shared/ui/`: accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, checkbox, collapsible, command, context-menu, date-picker-field, date-range-picker, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip. (Chart and color-field components are only copied if a screen needs them.)

Usage rules:

- **Dates** with `DatePickerField` and **date-times** with `DateTimeField` (which always shows the time zone); never the native field. **Phone** with `PhoneField`.
- **Field hint:** `InfoTip`; **field warning:** `WarningTip` (warning tone = look at it, danger tone = blocks).
- **Toast** only through the global `Toaster`. Do not build toasts by hand.

## 6. Back office components (`shared/admin`)

Generic, no business rule. Full list and props are in each file.

| Group | Components | Purpose |
|---|---|---|
| **Structure** | `PageHeader`, `AppSidebar` + `nav-config.ts`, `AuthShell`, `SpaceSwitcher`, `BrandSwitcher` | Header, menu, space and brand switching |
| **Lists** | `ListToolbar`, `ListContent`, `ListFilters`, `DataTable`, `PaginationBar`, `SearchableEmptyState` | Search, filters, table, pagination |
| **Forms** | `TextField`, `TextAreaField`, `NumberField`, `SelectField`, `PhoneField`, `DateTimeField`, `Field`, `FormError`, `EditorSheet` | Fields with label, hint, error and counter |
| **Content and approvals** | `ChannelPreview`, `RevisionView` (`shared/preview`), `EditorialStatusBadge`, `PublicationStatusBadge`, `RequestStatusBadge` (`shared/content`), `DateTimeField`, `DateField` | Platform preview with carousel and caption truncation; the exact revision (preview, full caption, files, planned date with zone) used by the team and the portal; status badges; date-time field that always shows the time zone, refuses a time that does not exist (daylight saving) and asks which occurrence when a time happens twice; date-only field |
| **Cards and detail** | `SectionCard`, `DetailRow`, `NoticeCard`, `StatusBadge` | Section card (title, icon, actions), label/value row, page-wide notice, status badge |
| **Groups of fields** | `FieldGroup` | `<fieldset>` with legend (icon, hint, `hideLegend`), variants `plain` / `section` / `boxed`, a single spacing between fields (`gap` md = 16 px, sm = 8 px) and native `disabled`. Do not write `<fieldset>` + `<legend>` by hand |
| **Feedback** | `EmptyState`, `RecordUnavailable`, `ListSkeleton`, `FormSkeleton`, `PageSkeleton`, `InfoTip`, `WarningTip`, `WhyDisabled` | Empty, error, loading and explanation states |
| **Actions** | `IconButton`, `RecordActions`, `ConfirmDialog`, `ReasonDialog`, `FormDialog`, `Can` | Row actions, confirmation, permissions |
| **Public site** | `RenderPage`, `SiteLayout`, `SiteImage`, `SiteButton`, `TurnstileBox` and one renderer per section (`shared/site`) | The single renderer used by the public site and by the CMS preview; every renderer draws nothing when its data is missing; images only through the published media map; colors only through named appearance choices |
| **Calendar** | `CalendarToolbar`, `CalendarGrid`, `CalendarList`, `CalendarLegend`, `EntryChip` (`shared/calendar`) | Month/week grid with roving focus and arrow keys, list alternative, legend, chip tinted by `StatusTone`; they receive `GridItem` view models, so the team calendar and the portal calendar share them. The names replace the single `CalendarView` of the first draft; `CalendarView` is now the enum of the views |
| **Domain, shared** | `ChannelIcon`, `ChannelPreview`, `MediaPicker`, `RichTextEditor`, `ApprovalTimeline` | Pieces used by `marketing` and `portal` |

Page header: `PageHeader({ title, description?, breadcrumbs?, actions? })`. The `h1` uses `heading-page`; the primary action is always **at the top right** (below the title on small screens); the breadcrumb goes up to the fixed bar. Every back office page starts with it.

Section card: the title (`h2`, `heading-card`) with an **icon** on the left (`size-5 text-muted-foreground`, decorative). Short context → an `InfoTip` next to the title instead of a paragraph.

Dialogs: see "Dialog pattern" in [admin-layout-and-standards.md](admin-layout-and-standards.md).

### 6.1 Status badges

One component, `StatusBadge`, with a `tone`. The label uses `text-foreground` (≥ 7:1 over the tone background) and the meaning goes in the **icon**, the border and a 10 % background. Each module chooses the `tone` of its status (`EditorialStatusBadge`, `PublicationStatusBadge`, `InvitationStatusBadge`); it never writes color classes. The editorial status map (`statusStyles`) is in [color-palette.md](color-palette.md), section 4.

| `tone` | Meaning | Color token |
|---|---|---|
| `success` | Approved, active, published | `cactus` / `sage` |
| `negative` | Cancelled, archived, blocked, error | `danger` / `coral-dark` |
| `draft` | Draft, pending, in preparation | `cream` |
| `info` | In production, in progress | `orchid-light` |
| `warning` | Awaiting approval, attention | `peach` + `warning` |
| `neutral` | Inactive, no highlight | `line` / `muted` |

### 6.2 List and page states

Fixed order: **skeleton** (1st load) → **error** (with "Tentar novamente") → **empty** → **no results** (with "Limpar busca") → list. `EmptyState` is the single component for empty, no results and error: dashed box `rounded-2xl`, icon `size-8`, title in `font-medium`, description `text-sm text-muted-foreground`, optional action.

## 7. Layout patterns

- **List:** `PageHeader` (action "Novo …") → `ListToolbar` (tabs, search with 300 ms debounce) → `ListFilters` → `DataTable` or card list → `PaginationBar`. Filters, search and page **in the URL** and on the server; changing a filter goes back to page 1.
- **Detail:** `PageHeader` → summary (status, next action) → tabs by area → section cards. Sensitive data behind `Can`. A missing record shows `RecordUnavailable` in the same layout.
- **Form:** zod validation **on client and server**; fields with label, required `*`, hint, error next to the field and focus on the first invalid one (`zodFieldErrors` + `focusFirstInvalid`); button in loading state; `useUnsavedChanges(dirty)`; quick create/edit in `EditorSheet` (fixed footer "Cancelar / Salvar", no card or own margin).
- **Calendar:** month, week and list views; status colors from `statusStyles`; deadlines as all-day items; drag opens a confirmation (see `technical-architecture-v0.1.md`, section 13).
- **Approval screen (portal):** per-channel preview at the top, caption and files, date with time zone, history and comments, two clear decisions at the bottom ("Aprovar", "Pedir alterações"), 44 px targets.
- **Public site sections:** `<section>` with `px-6 py-24 lg:py-32` and container `mx-auto max-w-6xl`; heading in `font-display` + paragraph in `text-lg leading-relaxed text-ink-soft`. Backgrounds alternate `ivory` / `cream` / `peach` through the CMS block appearance (`appearance.background`), never through a free color.

## 8. Icons, images and ornaments

- **Icons:** only `lucide-react`; `aria-hidden` when decorative; `size-3` (badges), `size-4` (buttons, rows), `size-5` (titles), `size-8` (empty states).
- **Ornaments:** the star and organic-patch shapes of the brand (`violet-bright`, `orchid`, `coral`) are decorative, `pointer-events-none` and `aria-hidden`; only on the public site (and, sparingly, on portal empty states). Not in the back office.
- **Images:** come from the Media Library and the CMS, never from the code (see [../spaces/public-site-delivery.md](../spaces/public-site-delivery.md)). Always `alt` (empty only if decorative). Private files use short signed URLs with `unoptimized` images.
- **Logo:** fixed asset; do not change color or proportion.

## 9. Back office × portal × public site

| Aspect | Back office (`/admin`) | Client portal (`/portal`) | Public site |
|---|---|---|---|
| Goal | Operate fast and clearly | Decide with confidence | Evoke, connect, invite |
| Main button | `Button` (`rounded-md`, h-9) | `Button` `lg`, full width on mobile | Pill button (`SiteButton`: `rounded-full`, `violet`, hover `violet-deep`) |
| Cards | `rounded-xl`, border, light shadow | `rounded-2xl`, generous padding | `rounded-3xl`, warm shadows |
| Secondary text | `muted-foreground` | `ink-soft` | `ink-soft` |
| Headings | `font-display` 20–30 px | `font-display` 24–32 px | `font-display` 36–96 px, `tracking-tight` |
| Ornaments / gradient | No | Rare | Yes, with moderation (token `--gradient-hero`) |
| Density | High, tables | Low, one decision per screen | Low, generous space |

## 10. Accessibility (minimums)

- Contrast according to [color-palette.md](color-palette.md); check before using a new color in text.
- Visible focus on every control; logical tab order; "Pular para o conteúdo" in the back office.
- Fields with `label`, `aria-invalid`, `aria-describedby`; loading lists with `role="status"` and `aria-busy`.
- Targets ≥ 44 px on touch; no horizontal scroll at 360 px.
- Motion respects `prefers-reduced-motion`.
- Icon-only controls have an accessible name (`IconButton`, `aria-label`).
- Alternative text on every content image (mandatory per active language in the CMS).
- Calendar has a list alternative for keyboard and screen reader users.
- `axe` runs in the Playwright flows.

## 11. How to contribute

**Add a token.** Define the variable in `:root` of `styles.css`, expose it in `@theme inline` (`--color-…`), document it in [color-palette.md](color-palette.md) with its verified contrast. New colors only with brand approval.

**Add a component.**

1. Look in `shared/ui` and `shared/admin`. If it exists, adapt it.
2. Generic → `shared/admin` (or `shared/ui` if it is a primitive); with business rules → the space folder.
3. Use semantic tokens, `cn()` and `cva` for variants; cover the six states (section 4); `aria-*` and focus.
4. UI text in Brazilian Portuguese; props and code in English.
5. Add the row to the table in section 6 and, if there is a new pattern, a paragraph.

**UI review checklist.**

- [ ] Tokens only (no hex, no `#`/`rgb` in JSX, no Tailwind palette, no `bg-white`/`bg-black`/`text-white`).
- [ ] No new `text-[…]`, `shadow-[…]`, `rounded-[…]` without a reason; use the scale.
- [ ] Six states covered; disabled reason explained.
- [ ] Contrast verified; state not communicated by color alone.
- [ ] Mobile (360 px), tablet and desktop.
- [ ] Reuses `PageHeader`, `EmptyState`, skeletons and `ConfirmDialog` where applicable.
- [ ] Copy in clear, direct Brazilian Portuguese.

## 12. Enforcement

ESLint (`eslint.config.js`) forbids, in `.tsx` files: hex values, arbitrary hex in Tailwind classes, `white`/`black` and the default Tailwind palette; a raw card instead of `SectionCard`; a raw `<fieldset>` instead of `FieldGroup`; and `as unknown as`. The exemption list starts **empty** in Compasso and can only shrink. The public site cannot import content from the code (see the public site document).

## 13. Status

Starting point of phase 0: tokens in `styles.css` from [color-palette.md](color-palette.md); kit copied from Memoria Print and re-themed; `StatusBadge`, `FieldGroup`, `SectionCard` and the heading utilities carried over. Pending for the first phases: `SiteButton`, `ChannelPreview`, `CalendarView`, `ApprovalTimeline`, an internal `/admin/design` page (development only) that renders tokens, live contrast checks, variants and states for visual review.

### UI review of 2026-10-19 (comparison with Memoria Print)

Decisions: (1) `SpaceSwitcher` is the header popover of Memoria Print (tiles), driven by the route; (2) a list has **one** empty state: `DataTable` shows `empty` without the table header and without a second dashed box; (3) the search field is the `Input type="search"` with its own icon (no second icon); (4) list filters beyond two live in `ListFilters` (one "Filtros" popover with the active count) instead of a permanent row of selects; (5) `SearchableEmptyState` is used by every searchable list so "no results" always offers "Limpar pesquisa"; (6) `DetailRow`, `NoticeCard`, `RecordUnavailable` and `WarningTip` are copied from Memoria Print where a screen builds the same pattern by hand; (7) titles that mix words and numbers (calendar range) use `first-letter:uppercase`, never `capitalize`.

Applied on 2026-10-19: `SpaceSwitcher` (header popover, driven by the route), `DataTable` empty state without a second box, `ListToolbar` with a single search icon and an `extra` slot, `ListFilters` in clients, brands and approvals, `SearchableEmptyState` in clients, brands, approvals and content, `RecordUnavailable` in the eight "not found" screens, icons in every empty state, `Input` and `SelectTrigger` at the same height (`h-10`, `h-11` on touch), calendar titles with `first-letter:uppercase`. **Not done yet** (needs a decision, listed in [pending-external-setup.md](../pending-external-setup.md) as D29): the dependent filters of content, calendar, library and audit stay as permanent rows because a popover with a draft cannot refresh the channel list when the brand changes; `DetailRow`, `NoticeCard`, `WarningTip`, `RecordActions`, `PhoneField` and `ListContent` of Memoria Print are not copied because no screen needs them yet. The comparison was made on screenshots of 30 admin screens at 1280 px and of the clients list at 375 px, taken with Playwright against the real Supabase project; no other screen size and no screen with data was reviewed.

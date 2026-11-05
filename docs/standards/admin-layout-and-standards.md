# Back office — Layout and interface standards

> Layout of `/admin` (sidebar, header, pages), the reusable component kit and the patterns for lists, forms and dialogs. It is the reference for building every module consistently. The component names (`PageHeader`, `DataTable`, ...) are those of the `shared/admin` kit that Aura Creative copies from the Memoria Print project in phase 0 (see `technical-architecture-v0.1.md`, section 17.1) and adapts. Companion documents: [base.md](base.md) (cross-cutting rules), [design-system.md](design-system.md) (tokens and components), [color-palette.md](color-palette.md). UI texts shown in examples are Brazilian Portuguese because they are UI copy.

## 1. Layout

```
┌───────────────┬──────────────────────────────────────────────┐
│ Logo          │ ☰  │ Space ▾  Brand ▾                  🔔     │  ← header (fixed)
│               ├──────────────────────────────────────────────┤
│ Início        │ Breadcrumbs                                  │
│ Notificações  │ Page title                      [Primary     │
│               │ Description                      action]     │
│ GESTÃO DE     │                                              │
│ MARKETING     │ content (list, detail or form)               │
│  Clientes     │                                              │
│  Calendário   │                                              │
│ ▾ Configurações                                              │
│               │                                              │
│ [M] Name ⌄    │                                              │  ← sidebar footer: account
└───────────────┴──────────────────────────────────────────────┘
```

- **Space selector** (`SpaceSwitcher`) in the fixed header, next to the notification bell: an icon button that opens a popover with one tile per space the person can use ("Gestão de Marketing", "Site e CMS"); the selector is hidden when there is only one. The current space is deduced from the **route** (`/admin/site/*` → Site and CMS; `/admin/marketing/*` → Marketing Management); on shared routes (library, settings, notifications, profile) the last space is kept (`StoredKey.LastSpace`). Choosing a space navigates to its home. Decided 2026-10-19 after the visual review (the first version was a select in the sidebar that did not follow the route).
- **Brand context** (decided 2026-11-05, specified in section 6, not implemented): the top bar of the Marketing space has a **brand selector** ("Marca ativa"); an active brand filters every Marketing screen that lists by brand. Brand-specific screens still take the brand from the URL (`/admin/marketing/brands/$brandId/...`). Until it is built, screens keep their own brand filters.
- **Sidebar** (`AppSidebar`): icons + text, sections with a title, items with collapsible **sub-items**, pending counters (for example approvals waiting), highlighted active item and `aria-current`.
  - **Collapses to icons only** (☰ button or `Ctrl/Cmd + B`) with a "rail" to reopen it. On small screens it opens as a **drawer**.
  - In icon mode, clicking an item with sub-items opens the sidebar first.
  - Footer with the account: the name opens the user menu with "Meu perfil" and "Sair". The sidebar has no "Minha conta" section (removed 2026-11-04, it repeated the user menu).
  - **Configurações** (decided 2026-11-04): "Pessoas" stays at the first level; the rarely used screens "Perfis", "Políticas", "Avisos padrão" and "Auditoria" are the sub-items of one collapsible item, **"Avançado"**, which has no page of its own. An item with sub-items shows only the sub-items the person may see and disappears when there are none.
- **Header**: sidebar button, space selector and notification bell (always in the same position).
- **Content**: maximum width of 72 rem by default, responsive margins, `id="main-content"` and a "Pular para o conteúdo" link for keyboard users. Brand detail pages, content screens and calendar screens use all available width because their dense grids and data benefit from the extra room.
- **Inside the layout**: non-existent pages ("Página não encontrada"), errors ("Algo deu errado" + try again) and missing permission ("Sem acesso a esta área") appear **in the same layout**, with a way to continue.
- **Feedback**: _toast_ notifications (Sonner) in the top-right corner.
- **Session**: if the session ends without the person asking (expired, revoked, another tab), go to the login with the current page as the return destination.
- The **client portal** has its own layout (`/portal`): no sidebar, brand switcher in the header, mobile first (see `technical-architecture-v0.1.md`, section 14).

## 2. How to add a module to the menu

Edit **a single file**: `src/components/shared/admin/nav-config.ts`.

```ts
{
  id: Space.Marketing,
  title: "Gestão de Marketing",
  sections: [
    {
      label: "Operação",
      items: [
        { title: "Clientes", icon: Users, to: "/admin/marketing/clients", action: Action.Clients.View },
        { title: "Calendário", icon: CalendarDays, to: "/admin/marketing/calendar", action: Action.Calendar.View },
        {
          title: "Conteúdos",
          icon: Palette,
          children: [
            { title: "Aprovações", icon: CheckCircle, to: "/admin/marketing/approvals", action: Action.Approvals.View },
          ],
        },
      ],
    },
  ],
},
```

- `to` is validated by TypeScript against the existing routes (create the route first).
- `action` is the required permission ([roles-and-actions.md](../foundations/roles-and-actions.md)); without it the item **does not appear**, and a group without visible items disappears.
- `badge` shows a counter (for example `pendingApprovals`); new counters are added to the `NavBadge` type and to the layout `loader`.
- The item is active for the route and for its sub-routes (`exact: true` only for the exact route).
- The route itself is protected with `beforeLoad: ({ context }) => requireAction(context, Action.Clients.View)`; the interface hides, the server and RLS refuse.

## 3. Reusable components

In `src/components/shared/admin/` (generic, no business rules). Before creating another one, use or adapt these.

| Component | Purpose |
| --- | --- |
| `PageHeader` | Breadcrumbs, title, description and **primary action** at the top right. Every page starts with it |
| `EmptyState` | Empty list, "no results" and error, with icon, text and action (for example "Tentar novamente") |
| `ListSkeleton` / `FormSkeleton` / `PageSkeleton` | Skeletons that keep the height of the elements (initial loading; also use as `pendingComponent`) |
| `PaginationBar` | Previous/next pagination with "Mostrando 1–10 de 57" |
| `DataTable` / `DataTableRowActions` | Server-driven table with row actions (section 4); `actionsMenu` keeps row actions in a three-dot dropdown even when there are two or fewer |
| `ConfirmDialog` | Confirmation of destructive actions, identifying the record; stays open with the button in _loading_ and only closes if the action succeeds |
| `ReasonDialog` | Confirmation that requires a written reason (reopen, cancel, request changes) |
| `IconButton` | Icon-only button, with the name in a tooltip and as the accessible name |
| `Field` / `PasswordField` | Field with label, required `*`, format hint, error next to the field (`aria-invalid`, `aria-describedby`) |
| `TagInputField` | Editable tag list with Enter to add and a labeled remove button for each chip |
| `FormError` | General form error (`role="alert"`) |
| `SectionCard`, `FieldGroup`, `DetailRow`, `NoticeCard` | Cards of sections, groups of fields, label/value rows, page-wide notices |
| `StatusBadge` | Single status badge with a `tone` (see [design-system.md](design-system.md)) |
| `Can` | Shows content only to those who have the action |
| `NotificationBell` / `NotificationRow` | Bell and notification row |

Aura Creative-specific components built on top of the kit live in `shared`: `ChannelIcon`, `DateTimeField` (with time zone), `MediaPicker`, `RichTextEditor`, `ChannelPreview`, `CalendarView`, `ApprovalTimeline`.

Hooks and utilities:

| Piece | Purpose |
| --- | --- |
| `useDebouncedValue` | Debounce for searches (300 ms) |
| `useUnsavedChanges(dirty)` | Warning before leaving with unsaved changes (navigation, closing the tab, switching record) |
| `useListState` | Search, filters, sort and page kept in the URL search params |
| `zodFieldErrors` + `focusFirstInvalid` | Per-field errors from zod and focus on the first invalid field |
| `formatDate`, `formatDateTime`, `formatInZone` (`src/lib/shared/format.ts`) | Dates in `pt-BR`; instants shown in the brand's IANA time zone |
| `requireAction` / `requireActionServer` / `can` | Permissions in the route, on the server and on the screen |

### Dialog pattern

1. `DialogTitle` with an **icon** to the left of the text (`size-5 text-muted-foreground`, decorative), representing the action: padlock to lock, prohibited icon to cancel, calendar to change dates.
2. Short description saying what happens and what gets recorded (for example "Isto cria uma nova revisão e exige nova aprovação").
3. Fields with labels; dates with `DatePickerField` and date-times with `DateTimeField` (always showing the time zone), never the native field.
4. Footer (`DialogFooter`): first the outline button **"Voltar"** with an arrow icon (closes without saving), then the main action **with an icon** and the text changing while it runs ("Salvando…", "Enviando…"). Destructive actions use the `destructive` variant. A dialog that only informs has just "Voltar" or "Fechar".
5. The dialog does not close while saving (`!busy`).

### Section card pattern

The card title (`h2`, `heading-card`) carries an **icon** on the left, always with the same size and a discreet color (`flex items-center gap-2` and `size-5 text-muted-foreground`). When the help text is only context, prefer an information icon with a tooltip (`InfoTip`) next to the title instead of a paragraph. A card groups what is saved together, under one "Salvar". Empty states use `EmptyState` with icon, title and one sentence explaining what to do.

### List pattern

1. `PageHeader` with the main action ("Novo cliente", "Novo conteúdo").
2. Tabs/filters + search box (with _debounce_); changing a filter **goes back to page 1**.
3. Data through `useQuery` with search/filters/page in the key (the old response never replaces the new one) and `keepPreviousData` so it does not flicker.
4. States: **skeleton** (1st load) → **error** with try again → **empty** → **no results** (with "Limpar busca") → list.
5. `PaginationBar` at the end; search, filters and total come **from the server**, over all records.
6. Filters and page live in the URL, so returning from a detail restores the list.

### Form pattern

1. Validation with **zod on the client** (same schema) and **again on the server** (`createServerFn(...).validator(schema)`), plus RLS/triggers.
2. Required fields marked; format/limit hints; error next to the field; focus on the first error.
3. Button in _loading_ and **no double submit**; dependent actions blocked while it runs.
4. If it fails, **the filled-in data is kept**; success only after confirmation, with a _toast_.
5. `useUnsavedChanges` when there are unsaved changes.
6. Optimistic locking: edits send the record `version`; a conflict asks the person to reload (`conflict` error code).

## 4. Reusable table and contextual editing

`src/components/shared/admin/data-table.tsx` provides `DataTable<T>` and `DataTableRowActions<T>`. The columns have `id`, `label`, a `cell(row)` function and an optional `className`. The table receives `rows`, `rowKey`, `rowLabel`, `caption`, loading/refreshing/error states, empty content and controlled pagination (`page`, `pageSize`, `total`, `onPageChange`). The optional selection exposes `selectedIds` and `onChange`; the header checkbox selects only the rows visible on the page. Search, filters, sorting and server requests remain the module's job; the table does not re-sort only the loaded page.

The `actions(row)` function returns only the authorized actions, with `id`, `label`, `icon`, `onSelect`, and optional `disabled` and `destructive`. Up to two actions are icon buttons with an accessible name; more than two are grouped in a "…" button with a menu. Confirmation and the business operation are the module's responsibility. Omitting `actions` hides the column.

The page breadcrumb appears in the fixed top bar next to the sidebar control. The title, description and actions stay in the content; long paths are truncated in the top bar.

Operation result messages go through the global `Toaster` (`src/components/shared/ui/sonner.tsx`): `toast.success`, `toast.error`, `toast.info` and `toast.warning` use the `success`, `danger`, `info` and `warning` tokens in the icon and outline, keeping the texts defined by each operation. Pages must not create their own notification styles or icons.

Date fields use `DatePickerField` with the calendar in Brazilian Portuguese, display `d de MMMM de yyyy` and form value `yyyy-MM-dd`. Optional fields can expose a "Limpar data" action.

Creating a record from a list uses a `Sheet` (`EditorSheet`): `onSaved` closes the panel and invalidates the query; `onStateChange` allows blocking closing during saving and warning about unsaved changes. The form inside a panel has no card, margin or actions of its own. The fixed footer holds "Cancelar" and "Salvar", both with icons. Editing a rich record (client, brand, content item) opens its full page. Deleting confirms the record name and keeps the server restrictions; records with history are **archived**, not deleted.

## 5. Conformance checklist for every feature

- [ ] Pagination, search and filters on the server (when the list can grow).
- [ ] Skeleton and loading, empty, no results, success and error states.
- [ ] Conflicting actions blocked; no double submit.
- [ ] Validation on the client **and** on the server; focus on the 1st error; unsaved-changes warning.
- [ ] Permissions (`action`) in the menu, in the route, on the server and in RLS, plus the brand link where the data belongs to a brand.
- [ ] Confirmation of destructive actions, with a result _toast_.
- [ ] Time zones shown wherever a date and time appears.
- [ ] Layout tested on mobile, tablet and desktop.
- [ ] Contrast and keyboard checked (see [color-palette.md](color-palette.md)).
- [ ] Main flows and relevant failures covered by tests (pgTAP for rules, Playwright for flows).

**Brand filter (2026-10-19, superseded 2026-11-05).** Marketing list screens owned their brand filters and the global brand selector had been removed from the sidebar. Replaced by the brand selector of section 6, which also removes the per-screen brand filters when it is implemented.

## 6. Brand selector (decided 2026-11-05)

> **Decision.** The Marketing space gets a **global brand selector** in the top bar, in the style of the project selector of Vercel: the person picks a brand once and every Marketing screen shows only that brand; "Todas as marcas" removes the filter. **This reverses the decision of 2026-10-19** ("there is no global brand selector", [../modules/brands.md](../modules/brands.md) status of 2026-10-19). Reason: with several brands the screens mix content from all of them and the manager repeats the same brand filter on every screen. **Status: specified, not implemented** (tasks B-02 to B-05 of [../implementation-plan.md](../implementation-plan.md)). Names below are proposals and enter the registries in the implementing change (GOLD-4).

### 6.1 The control

| Part | Rule |
|---|---|
| Name and component | "Marca ativa" in the copy; `BrandContextSwitcher` (proposal, `components/shared/admin/`, because the shared layout renders it) |
| Where | The top bar, **only in the Marketing space** (never in Site and CMS). Target: at the start of the bar, before the breadcrumbs, like the Vercel project selector. Today `BackofficeLayout` of `lost-ui` only has `topbarActions` (end of the bar), so the first delivery puts it there, next to the bell, and the library request L12 ([../lost-ui-requests.md](../lost-ui-requests.md)) asks for a start slot. On phones the trigger shows the logo and a truncated name |
| Trigger | Brand logo (`BrandAvatar`) + name + the up/down chevrons; with no brand chosen, a grid icon and "Todas as marcas". Accessible name "Marca ativa: {nome}. Trocar de marca" |
| Popover | A search field "Buscar marca…" focused on open (filters by brand and client name; Esc closes); the first row "Todas as marcas"; then one row per brand with logo, name, client name and a check on the active one; arrow keys, Enter and type-ahead (combobox and listbox roles, `aria-selected`). Footer: "Nova marca" (only with `brands.create`) and "Gerenciar marcas" (to `/admin/marketing/brands`) |
| Source | `listBrandOptions` through `useBrandOptions`: only the brands the person can access (RLS), active ones, alphabetical, at most 200. A brand that is archived appears only while it is the active one, labelled "Arquivada" |
| Single brand | No popover: the trigger shows the brand identity, as the portal does ([../modules/portal.md](../modules/portal.md#brand-switcher)); the screens behave as with "Todas as marcas" |
| No brand | The control is hidden |

### 6.2 What an active brand does

When a brand is active, every Marketing screen that lists or adds up by brand shows **only that brand**, and nothing of another brand appears in a count, a list or a block.

| Screen | With an active brand |
|---|---|
| Dashboard `/admin/marketing` | Every block is computed for that brand |
| Conteúdos (list and board) | Only that brand; "Criar conteúdo" starts in that brand |
| Calendário | Only that brand's entries; the forms for a content, an idea, a date and an event start in that brand |
| Aprovações | Only that brand's requests. A request opened by its own link belongs to its brand: the screen opens it and the selector switches to that brand |
| Feedbacks | Only that brand |
| Biblioteca `/admin/library`, inside the Marketing space | Only the files of that brand (the library of the Site space ignores the selector) |
| Brand pages `/admin/marketing/brands/$brandId/...` | The brand of the route is the active one (see 6.3) |
| Clientes and Marcas (the catalog) | **Not filtered**: they always list everything, so the person can find and open any brand |
| Configurações | Not affected |

### 6.3 Where the choice lives

- **The URL is the source of truth** (UI-1): list screens keep the search param `brand` they already have; brand pages carry `$brandId`. Changing the brand resets the page to 1.
- **Memory** (`StoredKey.ActiveBrand`, proposal, through `readStored` and `writeStored`): the last choice is stored. When the person opens a Marketing screen without `brand` in the URL, the stored brand is applied by a replace navigation (no history entry). "Todas as marcas" clears it. This key **replaces `StoredKey.CalendarBrand`** (the remembered brand of the calendar forms, [../modules/calendar.md](../modules/calendar.md)): one way to remember a brand (GOLD-2).
- **Menu links keep the brand**: going from the dashboard to "Conteúdos" or "Calendário" carries `?brand=` of the active brand.
- **A link with `brand` wins over the stored one.** A link without it takes the stored brand of whoever opens it, so every filtered screen shows a removable chip "Marca: {nome}" next to its filters; the person always sees which brand is filtering.
- **A brand the person cannot use** (link revoked, archived, deleted, another person's id in a URL) is ignored: the screen falls back to "Todas as marcas", the stored value is cleared and a toast says "Essa marca não está disponível para você." The decision is the database's, never the stored value's (SEC-2, SEC-3, SEC-13).
- **Brand pages**: opening `/brands/$brandId/...` makes that brand active. Choosing another brand there opens **the same tab** of the other brand; "Todas as marcas" opens `/admin/marketing/brands`.
- Server functions keep receiving the brand explicitly and checking `can_access_brand`; the selector changes only what the screen asks for.

### 6.4 What it replaces (GOLD-2)

The brand `Select` that several screens carry in their own filters (dashboard, content, calendar, approvals, metrics and the Feedbacks page) is **removed**: the screen reads the active brand and keeps the `brand` param. Two controls for the same thing would disagree. Forms that have a brand field (content, idea, date, event) start with the active brand and stay editable; with "Todas as marcas" they start empty and the field is required.

### 6.5 States and accessibility (UI-2, UI-7, UI-8)

Loading: a skeleton of the trigger's size. Error: the popover says "Não foi possível carregar as marcas" with "Tentar de novo". Search with no match: "Nenhuma marca encontrada". Touch targets of at least 44 px; on a phone the popover uses the full width. Focus returns to the trigger on close; state is never only color; colors only from the palette tokens; `prefers-reduced-motion` respected.

### 6.6 Code and registries (proposal)

No migration and no new function: it reads the existing `listBrandOptions`. New: `useActiveBrand` (`hooks/shared/`: reads the route or URL brand, the stored brand and validates it against the options), `BrandContextSwitcher` and its chip `ActiveBrandChip` (`components/shared/admin/`), `StoredKey.ActiveBrand`, `QueryKey` unchanged (`QueryKey.Brands.options()`). Removed in the same change: `StoredKey.CalendarBrand` and its readers (`calendar-page.tsx`, `event-dialog.tsx`, `note-dialog.tsx`, `content-editor-page.tsx`, `planning-step.tsx`) and the per-screen brand selects. UI terms for [ui-glossary.md](ui-glossary.md): "Marca ativa", "Todas as marcas", "Buscar marca…", "Gerenciar marcas", "Marca: {nome}".

### 6.7 Acceptance criteria

- [ ] Choosing a brand makes the dashboard, content, calendar, approvals, feedbacks and the Marketing library show only that brand, and the counts agree.
- [ ] "Todas as marcas" shows every brand the person may access, and nothing else.
- [ ] The choice survives a menu navigation and a reload; a link with `brand` overrides it; the chip shows and clears it.
- [ ] A stale, revoked or foreign brand id falls back to "Todas as marcas" without an error screen and without leaking whether the brand exists.
- [ ] On a brand page, switching brand keeps the tab; the selector reflects the route.
- [ ] Clientes and Marcas still list everything.
- [ ] A person with one brand sees its identity and no popover; with none, no control.
- [ ] It works at 360 px and by keyboard only (open, search, choose, close); the person never sees data of a brand they are not linked to, also by editing the URL.
- [ ] No screen keeps its own brand filter next to the selector, and `StoredKey.CalendarBrand` no longer exists.

### 6.8 Open decisions

Recommended answers are what the text above assumes. Confirm or change them before the first task (base.md 9.1).

| # | Question | Recommendation |
|---|---|---|
| O1 | Remember the brand across sessions (browser storage) or only while the tab lives? | Across sessions, with the visible chip. Opening the tool on the brand you were working on is the point |
| O2 | Should Clientes and Marcas follow the selector? | No: they are the catalog used to find a brand |
| O3 | More than 200 brands? | Not needed now; if it happens, the search goes to the server |
| O4 | Put "Recentes" and the pending counters per brand (as the portal switcher does) in the popover? | Later, once the selector is in use |
| O5 | A keyboard shortcut to open the selector? | Later |
| O6 | With a single brand, should it count as the active brand? | No: it only shows the identity; the screens behave as "Todas as marcas" |

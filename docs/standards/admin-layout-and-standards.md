# Back office — Layout and interface standards

> Layout of `/admin` (sidebar, header, pages), the reusable component kit and the patterns for lists, forms and dialogs. It is the reference for building every module consistently. The component names (`PageHeader`, `DataTable`, ...) are those of the `shared/admin` kit that Compasso copies from the Memoria Print project in phase 0 (see `technical-architecture-v0.1.md`, section 17.1) and adapts. Companion documents: [base.md](base.md) (cross-cutting rules), [design-system.md](design-system.md) (tokens and components), [color-palette.md](color-palette.md). UI texts shown in examples are Brazilian Portuguese because they are UI copy.

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
- **Brand selector** (inside Marketing Management): "Todas as marcas" or one brand. The selected brand lives **in the URL** (`/admin/marketing/brands/$brandId/...`), never in global state, and stays visible in the header.
- **Sidebar** (`AppSidebar`): icons + text, sections with a title, items with collapsible **sub-items**, pending counters (for example approvals waiting), highlighted active item and `aria-current`.
  - **Collapses to icons only** (☰ button or `Ctrl/Cmd + B`) with a "rail" to reopen it. On small screens it opens as a **drawer**.
  - In icon mode, clicking an item with sub-items opens the sidebar first.
  - Footer with the account: name, profile, "Meu perfil" and "Sair".
- **Header**: sidebar button, space and brand selectors, notification bell (always in the same position).
- **Content**: maximum width of 72 rem, responsive margins, `id="main-content"` and a "Pular para o conteúdo" link for keyboard users.
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

Compasso-specific components built on top of the kit live in `shared`: `BrandSwitcher`, `ChannelIcon`, `DateTimeField` (with time zone), `MediaPicker`, `RichTextEditor`, `ChannelPreview`, `CalendarView`, `ApprovalTimeline`.

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

**Brand filter (2026-10-19).** `BrandSwitcher` is in the sidebar header, below the space name, only in the Marketing Management space and with `brands.view`; when the sidebar is collapsed to icons it is hidden. Open question: whether the sidebar should float over the page (absolute) instead of pushing it; today it pushes, and collapses to icons with the trigger in the top bar.

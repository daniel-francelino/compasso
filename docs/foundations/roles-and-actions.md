# Roles and actions (permissions)

> The permission model of Compasso: configurable **roles** made of fixed **actions**, combined with the user's **brand links**. It is used by [authentication.md](authentication.md), the menu, the routes, the server functions and RLS. The model (roles, actions, `has_action`, admin-only actions, audit) comes from the Memoria Print project; the action catalog, the starting roles and the brand scope are Compasso's own. See also `technical-architecture-v0.1.md`, section 8. UI texts are Brazilian Portuguese; everything else is English.

## 1. Goal

- Manage **what each person can do** without changing code: administration creates roles and chooses the actions of each one.
- From the start there is a system role, **`owner`**, with access to **everything**, which cannot be edited or deleted.
- Each person has **one role**. What they can do on a brand also depends on their **brand links** (section 3).
- Verification happens **in the database** (RLS) and on the server; hiding a button on screen is only a convenience.

## 2. Concepts

| Concept | What it is | Example |
|---|---|---|
| **Action** | An atomic permission identified by a `module.verb` key. The catalog comes from code/migrations; it is **not** created through the interface | `content.update`, `approvals.decide`, `site.publish` |
| **Role** | A named set of actions assigned to people | `owner`, `manager`, `collaborator`, `external_approver` |
| **System role** | Role created by a migration, protected | `owner` |
| **Brand link** | Row of `brand_members` that scopes a user to a brand (`kind` internal or external, `can_decide`, `status`) | Marta → brand "Café Aurora" |
| **User** | Has exactly one role (after being approved) and zero or more brand links | Marta → `manager` on three brands |

Why a fixed action catalog: each action corresponds to something the code checks. Creating actions through the interface would do nothing; what the interface manages is **which roles have which actions**.

## 3. Effective permission = action AND brand scope

| Who | Brand scope |
|---|---|
| `owner` (`is_admin()`) | All brands |
| Internal roles (manager, collaborator…) | Brands with an active `brand_members` row of `kind = 'internal'` |
| External roles (approver, commenter) | Brands with an active `brand_members` row of `kind = 'external'`; deciding also requires `can_decide = true` |

Examples: editing a content item requires `has_action('content.update')` **and** `can_access_brand(brand_id)`; deciding an approval requires `has_action('approvals.decide')`, and being an **approver of the brand** (`approver_is_valid`: an approved external account whose role has the action and whose brand link has `can_decide`).

Data that does not belong to a brand (settings, roles, users, the site) depends only on the action.

## 4. Rules

1. The role **`owner`** (`is_system = true`):
   - has **all** actions, **including those created in the future** (it keeps no list; full access is implicit);
   - cannot be **edited, renamed or deleted**;
   - is the only one that can have the **administration-only actions** (section 6).
2. There must **always be at least one active Owner account**.
3. Nobody changes their **own** role, status or brand links in a way that raises their power.
4. A role can only be **deleted if nobody has it**; otherwise it must be reassigned first.
5. A **write** action **requires the read** action of the same module (for example `content.update` requires `content.view`). The interface marks the dependency automatically and the database rejects invalid combinations.
6. A role that is **external** (`portal_only`) can only contain portal actions (`portal.view`, `approvals.decide`, `comments.create_external`); the database rejects internal actions in it, and rejects portal-only roles for internal users.
7. Changes to roles, actions and brand links take **immediate effect** on new operations, even with an open session (the checks query the database).
8. Everything that changes (create/edit/delete role, change actions, assign role, change brand links) goes to **audit**.
9. The starting roles come **pre-created** (section 7) but are editable like any non-system role.

## 5. Action catalog (initial proposal)

Convention: `module.verb`, in English. `view` = see; the others write. Each module adds its actions in its own migration (`insert ... on conflict do nothing`).

| Module | Actions |
|---|---|
| **Clients** | `clients.view`, `clients.create`, `clients.update`, `clients.delete` |
| **Brands** | `brands.view`, `brands.create`, `brands.update`, `brands.delete`, `brands.manage_members` |
| **Channels** | `channels.view`, `channels.create`, `channels.update`, `channels.delete`, `channels.connect` (connect and configure the platform account; requires `channels.update`) |
| **Metrics** | `metrics.view` (read the analysis and reports of linked brands; requires `brands.view`), `metrics.report` (write marks, build, publish and withdraw reports; requires `metrics.view`), `metrics.portal_view` (external: read published reports; requires `portal.view`) |
| **Content** | `content.view`, `content.create`, `content.update`, `content.delete`, `content.submit`, `content.cancel`, `content.reopen`, `content.publish_manual` |
| **Approvals (internal)** | `approvals.view`, `approvals.override` |
| **Approvals (external)** | `approvals.decide` |
| **Comments** | `comments.create_internal`, `comments.create_external` |
| **Portal** | `portal.view` |
| **Calendar** | `calendar.view`, `calendar.manage` (reschedule, deadlines, ideas and dates) |
| **Media** | `media.view`, `media.upload`, `media.update`, `media.delete`, `media.publish`, `media.share` |
| **Site and CMS** | `site.view`, `site.edit`, `site.settings`, `site.structure`, `site.publish` |
| **Notifications** | `notifications.configure` |
| **Audit** | `audit.view` |
| **Invitations** | `invitations.create` |
| **Users** | `users.view`, `users.approve`, `users.manage` (`admin_only`) |
| **Roles** | `roles.manage` (`admin_only`) |
| **Settings** | `settings.manage` (`admin_only`) |

**Reserved actions (NOT in the MVP catalog; do not use until added here):** `media.upload_external` (client uploads), `content.assign` (assigning owners as a separate permission), `reports.view`. Adding any of them means adding the row above, the migration seed, the `Action` constant and the starting-role changes in the same change.

Dependencies (`requires`) stored in the catalog, for example:

- `content.update` → `content.view`, `channels.view`
- `content.submit` → `content.update`
- `content.reopen` → `content.update`
- `content.publish_manual` → `content.view`
- `approvals.decide` → `portal.view`
- `approvals.override` → `content.submit`
- `comments.create_external` → `portal.view`
- `media.upload` → `media.view`; `media.update` → `media.view`; `media.publish` → `media.update`; `media.share` → `media.view`
- `site.edit` → `site.view`; `site.structure` → `site.edit`; `site.publish` → `site.view`
- `invitations.create` → `users.view`
- `brands.manage_members` → `brands.update`
- `channels.connect` → `channels.update`; `metrics.view` → `brands.view`; `metrics.report` → `metrics.view`; `metrics.portal_view` → `portal.view`

## 6. Administration-only actions

Some actions would let someone **give themselves more power** (for example, whoever manages roles could create a role with everything and assign it to themselves). That is why these actions are marked `admin_only` in the catalog:

- `users.manage`, `roles.manage`, `settings.manage`.

Only the system role `owner` has them; they **do not appear as an option** when editing the other roles. `invitations.create` and `users.approve` can be given to other roles, but **they can only assign roles without administration-only actions**: whoever has `invitations.create` and is not an Owner cannot invite someone as `owner`. The rule is validated in the database, not only in the interface.

## 7. Starting roles

> Phase 5 adds the pre-created role `site_editor` ("Editor do site") with `site.view`, `site.edit`, `media.view` and `media.upload`, in migration `20261018101100_site_cms.sql`.

| Role | Type | Actions |
|---|---|---|
| `owner` ("Proprietário") | System, protected | All (implicit) |
| `manager` ("Gestor") | Pre-created, editable | `clients.*`, `brands.view/create/update/manage_members`, `channels.*` (including `channels.connect`), `content.*` except `delete`, `metrics.view`, `metrics.report`, `approvals.view`, `approvals.override`, `comments.create_internal`, `calendar.*`, `media.view/upload/update/share`, `invitations.create`, `users.view` |
| `collaborator` ("Colaborador") | Pre-created, editable | `clients.view`, `brands.view`, `channels.view`, `content.view/create/update`, `approvals.view`, `comments.create_internal`, `calendar.view`, `media.view/upload` |
| `external_approver` ("Aprovador externo") | Pre-created, editable, portal only | `portal.view`, `approvals.decide`, `comments.create_external` |
| `external_commenter` ("Comentarista externo") | Pre-created, editable, portal only | `portal.view`, `comments.create_external` |

Dependencies are added automatically (for example `content.*` brings `channels.view`). Every write action also requires the `view` action of its module (and `portal.view` for portal actions); the seed in the migration is the executable list. `manager` receives `users.view` only because `invitations.create` requires it (read-only list of users and invitations). Neither `manager` nor `collaborator` has `site.*`, `users.manage`, `users.approve`, `roles.manage` or `settings.manage`; a "Site editor" role is created through the interface (for example `site.view`, `site.edit`, `media.view`, `media.upload`). Whoever edits the site does not publish by default: `site.publish` is a separate action so the "prepare → approve" flow is possible.

## 8. Data model

Explanatory excerpts; the executable source is the authentication migration of Compasso. Do not use these excerpts as an extra migration. `npm run check:consistency` verifies that SQL, `ACTION_KEYS` and the policies agree.

```sql
create table roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  portal_only boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table actions (
  key         text primary key,
  module      text not null,
  description text not null,
  admin_only  boolean not null default false,
  portal      boolean not null default false,
  requires    text[] not null default '{}'
);

create table role_actions (
  role_id     uuid not null references roles (id) on delete cascade,
  action_key  text not null references actions (key) on delete cascade,
  primary key (role_id, action_key)
);

create table role_audit (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  role_id    uuid,
  action     text not null,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);
```

Notes: the catalog is **seeded by migrations**; `profiles` has the constraint `status <> 'approved' or role_id is not null`; triggers on `role_actions`/`roles` guarantee rules 1, 4, 5 and 6 and write to `role_audit`; the `owner` role has **no rows** in `role_actions`.

### Functions for RLS

```sql
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.status = 'approved' and r.key = 'owner' and r.is_system
  )
$$;

create function has_action(p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from profiles p
    join role_actions ra on ra.role_id = p.role_id
    where p.id = auth.uid() and p.status = 'approved' and ra.action_key = p_action
  )
$$;

create function my_actions() returns text[]
language sql stable security definer set search_path = public as $$
  select case when is_admin()
    then array(select key from actions)
    else array(
      select ra.action_key from profiles p
      join role_actions ra on ra.role_id = p.role_id
      where p.id = auth.uid() and p.status = 'approved')
  end
$$;
```

The brand-scope functions `can_access_brand` and `is_external_brand_member` are in `technical-architecture-v0.1.md`, section 8.3. Use in tables:

```sql
create policy "read content" on content_items for select
  using (has_action('content.view') and can_access_brand(brand_id));
```

**External users never read the base tables.** Internal notes, internal briefings and unshared drafts live in tables that have no policy for external roles; the portal reads only through `portal_*` functions that return safe columns. A filtered view only protects data if direct access to the source is also restricted.

## 9. In the application

### Session state

`getAuthState` returns the role and the list of effective actions (`my_actions()`):

```ts
type AuthState = {
  user: { id: string; email: string } | null;
  profile: { id: string; name: string; email: string; status: AccountStatus; kind: ProfileKind;
             role: { key: string; name: string } | null } | null;
  actions: ActionKey[];
};
```

### Utilities

| Utility | Purpose |
|---|---|
| `can(auth, Action.Content.Update)` | One-off check in code |
| `<Can action={Action.Content.Reopen}>…</Can>` | Show/hide parts of the screen |
| `requireAction(context, Action.Calendar.View)` | Guard in route `beforeLoad`: refuses access if the action is missing |
| `requireActionServer(Action.Content.Submit)` | Inside server functions: returns `denied` before touching the database |

The `Action` object groups the keys by module (`Action.Content.Update` → `"content.update"`); `ACTION_KEYS` derives from it, so there is a single source. `npm run check:consistency` compares `ACTION_KEYS` with the rows inserted into `actions` and with every `has_action('…')` in the SQL. The sidebar shows only the sections for which the person has the `*.view` action.

### "Roles" screen (`/admin/settings/roles`, action `roles.manage`)

- List of roles with name, number of users and a "Sistema" tag on `owner`.
- **Create role**: name and description; option to **start from an existing one** (duplicate); choose internal or portal-only.
- **Edit role**: permission matrix **grouped by module**, with a checkbox per action, a short description and, per module, "selecionar tudo / nada". Dependencies are marked automatically (and unchecking a read unchecks the writes that depend on it).
- `admin_only` actions do not appear. `owner` opens in **read-only** mode with the note "Acesso total".
- **Delete** only if no one has the role.
- Shows a summary "o que este perfil não pode fazer" to avoid surprises.

### "Users" screen

The role selector lists **roles** (from the `roles` table). Whoever has `invitations.create` but is not an Owner only sees roles without administration-only actions.

## 10. Implementation plan

| Step | Task | Result |
|---|---|---|
| 1 | Authentication migration with the roles/actions model and the Compasso catalog; seed `owner` and the starting roles | Database ready |
| 2 | `getAuthState` with role and actions; `can`, `<Can>`, `requireAction`, `requireActionServer`; `Action` object | Permissions available in the app |
| 3 | "Users" and "Roles" screens; invitations | Access management |
| 4 | `check:consistency` for actions, error codes and `CHECK` lists | Safety net |
| 5 | In each new module: register its actions in the migration, use `has_action` and `can_access_brand` in RLS and `requireAction` in routes | Consistent permissions |
| 6 | pgTAP matrix: every role × every table/function, brands A and B | Regression protection |

## 11. Acceptance criteria

- [ ] `owner` exists with access to everything and **cannot be edited or deleted**.
- [ ] An action created in a future migration is **automatically available to `owner`** without configuring anything.
- [ ] Administration creates a role, chooses actions and assigns it to a person; the person sees **only** what the role allows, on **only** the brands they are linked to.
- [ ] Removing an action from a role, or revoking a brand link, has **immediate effect**, even with an open session.
- [ ] Direct API requests (public key) from someone without the action or the brand link are refused by RLS.
- [ ] Write actions cannot be given without the corresponding read action.
- [ ] An external role cannot contain internal actions, and an external user cannot read internal tables or columns.
- [ ] Whoever is not an Owner **cannot** give themselves or others administration-only actions or the `owner` role.
- [ ] A role in use cannot be deleted, and the system cannot be left without an active Owner.
- [ ] All role and access changes are in the audit.

## 12. Open questions

1. Should a person be able to have **more than one role** at the same time? (This document assumes one; combine permissions by creating a new role.)
2. Do we need **per-person exceptions** (give or remove an action for a specific user)? The MVP assumes only roles plus brand links.
3. Does the catalog cover what is wanted? Is any action missing (for example `content.assign`, `reports.view`)?
4. Is an additional pre-created role wanted (for example "Contador/Leitor" with read-only access)?
5. ~~Should the manager be able to skip an approval?~~ **Decided 2026-10-22: yes**, as an approval recorded on the client's behalf, with the new action `approvals.override` (internal, requires `content.submit`, starting role `manager`). Specified in [../modules/approvals.md](../modules/approvals.md#approval-by-the-team-decided-2026-10-22) and [../modules/content.md](../modules/content.md#flexible-approval-decided-2026-10-22); implemented in migration `20261023110000_approvals_approve_on_behalf.sql` (catalog row, seed, `Action.Approvals.Override`).

## Implementation status

2026-10-19: The roles screen and role editor display pre-created role descriptions and action descriptions in Brazilian Portuguese through the frontend catalog, without changing stored role or action data. Files: `src/lib/shared/auth/role-matrix.ts`, `src/components/shared/settings/roles/roles-page.tsx`, `src/components/shared/settings/roles/role-editor.tsx`. Validation performed: ESLint, TypeScript, Prettier, `npm run check:docs` and `git diff --check`. **Not tested**: role screens in a browser.

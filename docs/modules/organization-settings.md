# Module — Organization and settings

> Functional specification. Context and conventions in [README.md](README.md). Space: `shared` (`/admin/settings/*`, UI label "Configurações"). It groups the organization data and defaults, the management of users, roles and invitations, and the operational policies. The mechanics of users, roles and invitations are in [../foundations/authentication.md](../foundations/authentication.md) and [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md); this document specifies the screens and the organization-level settings.

## Goal and scope

One place where authorized people configure how the organization works: identity and defaults, who has access, which roles exist, how approvals and uploads behave, and retention policies.

Included: organization profile, defaults, users, invitations, roles, operational policies, notification defaults, audit access. Not included in the MVP: billing and plans, several organizations, SSO, custom domains.

## Screens

| Route | Screen | Action |
|---|---|---|
| `/admin/settings` | Overview of settings (cards with status) | any settings action |
| `/admin/settings/users` | Users and invitations | `users.view` (manage: `users.manage`; invite: `invitations.create`) |
| `/admin/settings/roles` | Roles and the permission matrix | `roles.manage` |
| `/admin/settings/policies` | Operational policies | `settings.manage` |
| `/admin/settings/notifications` | Default notification rules (global) | `notifications.configure` |
| `/admin/settings/audit` | Audit trail ([audit.md](audit.md)) | `audit.view` |

Only the sections the person can use appear; the menu item "Configurações" shows only if at least one is available.

## Organization

Decision (2026-10-19): there is **no screen and no menu item** to manage the organization record. The data stays in `organizations` (and `organization_save` stays in the database) and is edited by hand when needed. The fields below describe what the record holds.

| Field | Rule |
|---|---|
| Name | Required |
| Legal name / tax id | Optional, internal |
| Default time zone | Required IANA zone; default for new brands and for the global calendar (proposal `America/Sao_Paulo`) |
| Default language | `pt-BR` (UI); content language decisions are made by the CMS settings |
| Logo | Optional fixed asset used in emails and the portal header |
| Contact email for the team | Optional, used as the reply-to of notification emails |

Changing the default time zone affects only **new** brands; existing brands keep theirs.

## Users and invitations

Detailed in [../foundations/authentication.md](../foundations/authentication.md), section 5:

- Tabs **Ativos**, **Convites pendentes**, **Suspensos**.
- Invite (email, role, brands, `can_decide` for external users; the access link is shown to copy and the email is optional), new link, resend by email, revoke, change role, edit brand links, suspend, reactivate.
- Protections: nobody changes their own role or suspends themselves; the last active Owner is protected.
- External users are marked "Externo" and show their brands; a client contact invited from [clients.md](clients.md) appears here with the same data.

## Roles

Detailed in [../foundations/roles-and-actions.md](../foundations/roles-and-actions.md), section 9: list, create, duplicate, edit with the matrix grouped by module, delete when unused; `owner` is read-only; `admin_only` actions are hidden; portal-only roles are marked.

## Operational policies

Stored as validated settings groups (jsonb with zod schemas, optimistic version), read by server functions and SQL functions where needed:

| Policy | Options | Default |
|---|---|---|
| **Internal review** | Optional / mandatory before sending for approval | Optional |
| **Default approval deadline** | Days after submission (local date of the brand) | 3 days |
| **Overdue reminders** | Interval of `approval.overdue` reminders | Next day, then every 2 days |
| **Calendar conflict thresholds** | Max channel rows per channel per day; minimum interval between posts | 3 per day; 30 minutes |
| **Upload limits** | Maximum size per type; files per operation; total quota; per-user daily limit | See [../spaces/media-library.md](../spaces/media-library.md) |
| **Signed URL lifetime** | Internal and external (seconds) | 300 / 120 |
| **Retention** | Media trash (days); audit events (months); notification cleanup (days) | 30 days; 24 months; 90 days |
| **Invitation validity** | Days | 7 |
| **Password and session** | Minimum length (10, not lower), session duration, MFA requirement for Owners | 10; provider default; required from phase 6 |
| **Email** | Sender name, reply-to, which notification kinds send email by default | See [../foundations/notifications.md](../foundations/notifications.md) |

A change to a policy is audited with old and new values; policies that affect running flows (for example making internal review mandatory) apply to **new** submissions only.

## Rules

1. Only the Owner can change `admin_only` settings; a role with `settings.manage` is a role the Owner chose to create (it is `admin_only`, so in practice only the Owner).
2. Settings are validated with zod on client and server; invalid groups are refused entirely.
3. Optimistic locking by `version` on the organization record and each settings group.
4. Secrets (API keys, tokens) are **never** stored in settings; they live in the environment of the host.
5. Every change writes an audit event with the changed keys (not secret values).

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

| Entity | Content |
|---|---|
| `organizations` | Name, default time zone, logo asset, contact data |
| `organization_settings` | `key` (policy group), `value jsonb`, `version`, audit stamps |
| `profiles`, `roles`, `actions`, `role_actions`, `invitations`, `brand_members` | See the foundations documents |

## Permissions

| Action | Allows |
|---|---|
| `settings.manage` (`admin_only`) | Organization data and policies |
| `users.view`, `users.approve`, `users.manage` (`admin_only`) | See users, handle access states, suspend/change roles |
| `roles.manage` (`admin_only`) | Create and edit roles |
| `invitations.create` | Invite people (with the assignable-role restriction) |
| `notifications.configure` | Global notification rules |
| `audit.view` | See the audit trail |

## Acceptance criteria

- Only people with the right action see each section; a direct URL without the action leads to "Sem acesso".
- Changing a policy is audited and applies only to new operations.
- The last Owner cannot be removed; nobody can raise their own power.
- Secrets never appear in settings, logs or responses.
- An invalid settings payload is refused with per-field messages.
- Changing the default time zone does not alter existing brands.


## Implementation status

Phase 1 (tasks P1-01, P1-02, P1-07, 2026-10-18). Done: users screen (`/admin/settings/users`: active, invitations, suspended; invite, resend, revoke, change role, suspend/reactivate), roles screen with the permission matrix and automatic dependencies (`/admin/settings/roles`), organization screen and policies screen (`/admin/settings/organization`, `/policies`, eight groups validated with zod), profile page (name, password, notification preferences), invitation acceptance page. SQL: `profile_set_access`, `role_save`, `role_delete`, `organization_save`, `organization_setting_save` (migration `20261018100600_access_and_settings_functions.sql`) and invitations (`20261018100500_auth_invitations.sql`). Validation performed: 35 + 44 SQL assertions on PGlite, 5 Vitest tests of the role matrix, typecheck, lint. **Not tested**: real Supabase, e-mail sending (the Resend adapter is untested), the screens in a browser. Also done after the first pass: the `/admin/settings` index, `/admin/settings/notifications` (defaults per kind through `notification_kind_save`, migration `20261018100700_notification_defaults.sql`, 8 SQL assertions), password recovery, callback, reset and confirm-email screens (`SITE_URL` or the request origin builds the link; the allowed redirect URLs must be set in Supabase). **Not done**: edit of brand links from the users screen (done from the brand), policies are stored but not yet read by the modules that will use them (invitation validity is still the 7-day constant).
2026-10-19: The organization screen (`/admin/settings/organization`), its menu entry and index card, `getOrganization`, `saveOrganization`, `organizationSchema` and `QueryKey.Organization.detail` were removed; the table and `organization_save` remain in the database. The policies screen now has one card with every policy group and a single "Salvar" that saves all changed groups (one `saveSetting` call per changed group, stopping at the first failure). Validation performed: typecheck, lint. **Not tested**: the policies screen in a browser, a partial failure while saving several groups.
2026-10-19: The default notifications screen (`/admin/settings/notifications`) is now one card with one row per notification kind and a single "Salvar" that saves every changed kind (one `saveKindDefaults` call per changed kind, stopping at the first failure; the unsaved-changes warning is on). Validation performed: lint of the changed files. **Not tested**: the screen in a browser, a partial failure while saving several kinds. The whole-project typecheck currently fails in `content.functions.ts` and `approvals.functions.ts`, which another change is editing.
2026-10-19: The profile page (`/admin/profile`) is now one card with three sections (name, password, notification preferences) and a single "Salvar". Saving runs the changed steps in order (name, password if filled, one `savePreference` per changed notification kind) and stops at the first failure; preferences no longer save on each toggle. New: `src/lib/shared/notifications/preference-drafts.ts`; `PreferencesSection` became the controlled `PreferencesFields`. Validation performed: lint and typecheck. **Not tested**: the page in a browser, a partial failure across steps.
2026-10-19: Visual redesign of the default notifications and policies screens. Notifications: kinds grouped by area (Aprovações, Produção e publicação, Comentários, Convites, Site, Arquivos), a column header (Aviso, Quando avisar, E-mail), an icon and a one-line description per kind, the lead time with its unit ("dias antes do prazo" or "dias depois do prazo") and an e-mail switch per row; the group, icon, description and timing of each kind live in `src/lib/shared/notifications/kind-info.ts` (UI copy only; kinds missing from the map fall into "Outros"). Policies: each group has an icon and a one-line description; each field shows its label, an `InfoTip` for the extra information, and the value with its unit beside it. New shared component `IconTile` (`src/components/shared/admin/icon-tile.tsx`). Validation performed: lint, typecheck. **Not tested**: the layout in a browser at 360 px, tablet and desktop, contrast of the tile tokens.
2026-10-19: Aligned profile, organization, policy and notification-default save actions to the right using the shared form action component. Validation performed: targeted ESLint, `check:docs`, Prettier and `git diff --check`. Full typecheck remains blocked by existing calendar and brand-logo type errors outside this change. **Not tested**: browser rendering.

Manual access delivery (2026-10-19). Done: the invite dialog generates the link and shows it in "Link de acesso" with a copy button; "Também enviar por e-mail" is an optional switch (off by default); the invitations list has "Gerar novo link" and "Reenviar por e-mail". Files: `invitations.functions.ts`, `schemas.ts` (`sendEmail`, `resendInvitationSchema`), `invite-dialog.tsx`, `invite-link-dialog.tsx`, `users-page.tsx`. No migration (the token flow is unchanged). Validation performed: typecheck, lint. **Not tested**: the dialogs in a browser, copying to the clipboard, end-to-end acceptance of a copied link.

2026-10-19: The invitation dialog's brand selector label is now "Marcas" and each option shows its brand avatar. Files: `src/components/shared/settings/users/invite-dialog.tsx`. Validation performed: targeted ESLint, full TypeScript check, Prettier, `check:docs` and `git diff --check`. **Not tested**: browser rendering.

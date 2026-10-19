# Module — Clients

> Functional specification. Context and conventions in [README.md](README.md). Space: `marketing` (`/admin/marketing/clients`).

## Goal and scope

Keep one record per commercial client, with the contacts needed for service, the internal owner, and access to the client's brands and history. The client is the **commercial relationship** ("Grupo de restauração"); the unit of editorial work is the **brand** ([brands.md](brands.md)). A client contact is **not** a user of the system: only contacts that are explicitly invited become external users, and only for specific brands.

Included: register, search, edit, archive and consult. Not included in the MVP: billing, contracts, quotes, CRM pipeline, e-signature, import of clients, merging duplicates.

## Client record

| Field | Rule |
|---|---|
| Name | Required; 2–120 characters; repeated names allowed (warn about similar names) |
| Internal owner | Optional; an internal user with access (default: the creator) |
| Status | Active or archived |
| Internal notes | Optional; plain text; **never** shown in the portal or in any external function |
| Segment / tags | Optional; free tags for filtering |
| Created / updated / by | Audit stamps |

### Contacts

A client has zero or more contacts (`client_contacts`):

| Field | Rule |
|---|---|
| Name | Required |
| Email | Optional; validated; normalized for search |
| Phone | Optional; stored with country code |
| Role / title | Optional |
| Primary | At most one primary contact |
| Portal access | Read-only badge: "Sem acesso", "Convite pendente", "Com acesso a N marcas" (derived from invitations and `brand_members`) |

Action "Convidar para o portal" (needs `invitations.create` **and** `brands.manage_members`) opens the invitation dialog prefilled with the contact's name and email, requiring the choice of **specific brands** and whether the person **may decide** approvals. Access to the portal is never inherited from the client.

## Screens and flows

Routes: `/admin/marketing/clients`, `/admin/marketing/clients/new`, `/admin/marketing/clients/$clientId`.

- **List:** name, owner, number of brands, number of contacts, status, last activity and a three-dot row action menu with open, edit, archive/reactivate and eligible delete actions. Search by name, contact name and email; filters by status, owner and tag. Main action "Novo cliente". Server pagination.
- **Create:** a form with name, owner and notes. Creating a client does not create a brand; brands are created separately from the client's brands tab.
- **Tags:** type one tag and press Enter to add it as a chip; each chip has a remove button. Tags are trimmed, duplicates are ignored case-insensitively, and a client can have up to 20 tags of 40 characters each.
- **Record:** summary (status, owner), tabs **Marcas**, **Contatos**, **Atividade**, **Notas**. The brands and contacts tabs do not show numeric count summaries. The brands tab lists the client's brands with status and a shortcut "Nova marca". The activity tab presents audit events in a section card timeline, with the action, actor and timestamp; an empty state explains what will appear there. The notes tab uses the standard empty state when there are no notes and offers "Adicionar nota" to people with `clients.update`. From a brand overview, people with `clients.update` can open this client's existing edit form in a full-screen dialog and save without leaving the brand.
- **Archive / reactivate:** archiving removes the client from selectors by default and **archives nothing else automatically**: the screen lists the active brands and asks whether to archive them too (never silently). Content in progress remains reachable. Reactivation requires `clients.update`.
- **Quick select:** a searchable picker used when creating a brand; it can create a client without losing the form being filled.

### Avoiding duplicates

1. Search by name and contact before creating.
2. If a similar name or contact exists, show matches (only to those with `clients.view`) and let the person choose the existing record or confirm creating another.
3. Never merge records automatically. Merging is out of the MVP; it would have to move brands, contacts and invitations without duplicating anything.

## Rules

1. A client cannot be deleted if it has brands; it is archived. A client without brands and without history may be deleted by `clients.delete`.
2. A client record is visible to a user when the user has `clients.view` **and** is linked to at least one brand of that client (Owner sees all). The list never leaks clients the person cannot access, nor their counts.
3. Internal notes and the contact list are internal; external users never receive them.
4. Changing the owner is audited.
5. Optimistic locking by `version`; a conflict asks to reload.

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

| Entity | Content |
|---|---|
| `clients` | `organization_id`, name, `owner_user_id`, `internal_notes`, `tags`, `archived_at`, audit stamps; `unique (id, organization_id)` |
| `client_contacts` | `client_id`, name, email, phone, role, `is_primary`, audit stamps |

Schema in [../reference/data-model.md](../reference/data-model.md) section 4. Indexes: `(organization_id, archived_at)`, trigram or lower-case index on name, normalized email.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `clients.view` | List and open clients the person can access | — |
| `clients.create` | Create clients | `clients.view` |
| `clients.update` | Edit data, contacts, owner, archive/reactivate | `clients.view` |
| `clients.delete` | Delete a client without brands or history | `clients.update` |
| `invitations.create` | Invite a contact to the portal | `users.view` |

Brand access: a Manager sees the clients of the brands they are linked to; a Collaborator can view them; the Owner sees all.

## Audit and personal data

Audit events: `client.created`, `client.updated`, `client.owner_changed`, `client.archived`, `client.reactivated`, `client.deleted`, `contact.created/updated/deleted`. Do not copy full contact data or notes into the audit metadata; store identifiers and changed field names. Personal data (contact names, emails, phones) follows the retention and deletion policy of the organization (LGPD); archiving does not anonymize.

## Error codes

> Messages (pt-BR) and categories are authoritative in [../reference/error-codes.md](../reference/error-codes.md); this list only names the codes this module uses.

`client_has_brands`, `client_name_required`, `contact_email_invalid`, `conflict`, `denied`, `not_found`.

## Acceptance criteria

- Creating a client does not create a brand; a brand can be created separately from the client's brands tab.
- A user linked only to brand A of a client sees that client, not clients of other brands, and not the counts of brands they cannot access.
- Archiving a client does not archive brands unless the person confirms it; content in progress stays reachable.
- Internal notes never appear in `portal_*` responses.
- The portal-access badge of a contact reflects invitations and links in real time.
- A client with brands cannot be deleted.
- Row actions are shown in a three-dot menu and respect client permissions; delete is disabled when the client has brands.
- Duplicate warnings show similar names and contacts without blocking creation.


## Implementation status

Phase 1 (task P1-03/P1-04, 2026-10-18). Files: migrations `20261018100300_clients_brands_channels.sql` and `20261018100310_clients_brands_channels_functions.sql`; tests `supabase/tests/03_clients_brands_channels.test.sql`; `src/lib/marketing/clients/*`; `src/components/marketing/clients/*`; routes `/admin/marketing/clients`, `/new`, `/$clientId`.

Done: list (status tabs, search, server pagination), create, duplicate-name warning, record with tabs (brands, contacts, activity for `audit.view`, notes), contacts (primary rule, e-mail validation), archive with the option to archive brands, delete, invite a contact to the portal. Validation performed: 58 SQL assertions on PGlite; typecheck, lint; guard redirects in Playwright. **Not tested**: real Supabase, the screens in a browser with data. Also done after the first pass: filters by owner and tag in the URL, the portal-access badge of each contact ("Sem acesso", "Convite pendente", "Com acesso a N marcas", shown only to people with `users.view`). **Not done**: the quick client picker inside the brand form (a plain select is used), a "last activity" column (the list shows the update date).

2026-10-19: Removed the "Criar a primeira marca com o mesmo nome" checkbox. Client creation now always creates only the client; create brands separately from the client's brands tab. Added the chip-based client tag editor, and added row action menus to the client list. Validation performed: targeted ESLint, `check:docs` and `git diff --check`. Typecheck was attempted and currently fails in `src/components/shared/media/share-dialog.tsx` due to an unresolved import and an invalid status tone. **Not tested**: browser behavior and real Supabase.

2026-10-19: Removed the brand count summary from the client's brands tab. Client list actions now use a three-dot menu for all roles, with edit, archive/reactivate and eligible delete actions gated by permissions. Validation performed: targeted ESLint, `check:docs` and `git diff --check`. Typecheck was attempted and is blocked by unrelated unused imports and an unresolved `CollectionsPanel` in `src/components/shared/media/library-page.tsx`. **Not tested**: browser behavior and real Supabase.

2026-10-19: Removed the contact count summary from the client's contacts tab. Validation performed: targeted ESLint, `check:docs` and `git diff --check`. **Not tested**: browser behavior and real Supabase.

2026-10-19: Restyled the client activity tab as a section card timeline with clearer event labels, actor names, and timestamps. Validation performed: targeted ESLint, `check:docs` and `git diff --check`. **Not tested**: browser behavior and real Supabase.

2026-10-19: Replaced the plain "Sem notas." text with the standard notes empty state and an edit action for people with `clients.update`. Validation performed: targeted ESLint, `check:docs` and `git diff --check`. **Not tested**: browser behavior and real Supabase.

2026-10-19: Reused the client edit form in a full-screen dialog opened from the client name in a brand overview. Validation performed: targeted ESLint, typecheck, `check:consistency`, `check:docs`, Prettier and `git diff --check`. **Not tested**: browser behavior.

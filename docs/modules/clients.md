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

- **List:** name, owner, number of brands, number of contacts, status, last activity. Search by name, contact name and email; filters by status, owner and tag. Main action "Novo cliente". Server pagination.
- **Create:** a form with name, owner and notes; a checkbox **"Criar a primeira marca com o mesmo nome"** (default on) creates a brand with the same name in the same transaction, keeping both entities separate.
- **Record:** summary (status, owner), tabs **Marcas**, **Contatos**, **Atividade**, **Notas**. The brands tab lists the client's brands with status and a shortcut "Nova marca". The activity tab shows the audit events of the client and its brands (internal events only).
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

| Entity | Content |
|---|---|
| `clients` | `organization_id`, name, `owner_user_id`, `internal_notes`, `tags`, `archived_at`, audit stamps; `unique (id, organization_id)` |
| `client_contacts` | `client_id`, name, email, phone, role, `is_primary`, audit stamps |

Reference DDL in `technical-architecture-v0.1.md`, section 9.1. Indexes: `(organization_id, archived_at)`, trigram or lower-case index on name, normalized email.

## Permissions

| Action | Allows | Requires |
|---|---|---|
| `clients.view` | List and open clients the person can access | — |
| `clients.create` | Create clients (and optionally the first brand, which also needs `brands.create`) | `clients.view` |
| `clients.update` | Edit data, contacts, owner, archive/reactivate | `clients.view` |
| `clients.delete` | Delete a client without brands or history | `clients.update` |
| `invitations.create` | Invite a contact to the portal | `users.view` |

Brand access: a Manager sees the clients of the brands they are linked to; a Collaborator can view them; the Owner sees all.

## Audit and personal data

Audit events: `client.created`, `client.updated`, `client.owner_changed`, `client.archived`, `client.reactivated`, `client.deleted`, `contact.created/updated/deleted`. Do not copy full contact data or notes into the audit metadata; store identifiers and changed field names. Personal data (contact names, emails, phones) follows the retention and deletion policy of the organization (LGPD); archiving does not anonymize.

## Error codes

`client_has_brands`, `client_name_required`, `contact_email_invalid`, `conflict`, `denied`, `not_found`.

## Acceptance criteria

- Create a client with and without the first brand; the first brand has the same name and is a separate record.
- A user linked only to brand A of a client sees that client, not clients of other brands, and not the counts of brands they cannot access.
- Archiving a client does not archive brands unless the person confirms it; content in progress stays reachable.
- Internal notes never appear in `portal_*` responses.
- The portal-access badge of a contact reflects invitations and links in real time.
- A client with brands cannot be deleted.
- Duplicate warnings show similar names and contacts without blocking creation.

## Implementation status

Not started (phase 1 of the plan).

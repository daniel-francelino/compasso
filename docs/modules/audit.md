# Module — Audit

> Functional specification. Context and conventions in [README.md](README.md). Space: `shared` (`/admin/settings/audit`, UI label "Auditoria"). It records **who did what, when and on which entity** for the critical actions of the business, so decisions are traceable and disputes can be settled.

## Goal and scope

Two complementary trails:

| Trail | Records | Tables |
|---|---|---|
| **Access audit** | Decisions about accounts and roles: invitations, approvals of access, suspensions, role changes and permission changes | `profile_audit`, `role_audit` (from the authentication foundation) |
| **Business audit** | Actions on clients, brands, content, approvals, media, site | `audit_events` (this module) |

Included: event recording by server functions and SQL functions, the audit screen with filters, export of a filtered view, retention. Not included in the MVP: tamper-evident hashing, streaming to external systems, per-field diffs of every column.

## Event model

| Field | Meaning |
|---|---|
| `id` | Increasing identifier |
| `organization_id` | Organization |
| `brand_id` | Brand, when the event belongs to one (enables per-brand views and access checks) |
| `actor_id` | The user (null for system jobs) and `actor_kind` (internal, external, system) |
| `action` | `domain.verb`, a constant (`AuditAction`), for example `approval.decided` |
| `entity_type`, `entity_id` | The affected entity |
| `metadata` | Small jsonb with identifiers and changed field names; **no secrets, no full personal data, no full text of notes or comments** |
| `occurred_at` | Instant (UTC) |
| `request_id` | Correlation with logs |

Events are **append-only**: no `update`, no `delete` (a trigger refuses); the retention routine is the only deleter. They are written **by functions in the same transaction** as the operation (so an event exists if and only if the action was committed), never by the client.

**Single writer:** every event is written through the SQL function `audit_write(p_org uuid, p_brand uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb)`, which validates that `p_action` is in the catalog of audit actions and fills `actor_id`, `actor_kind` and `request_id`. Nobody inserts into `audit_events` directly, and there is **one** audit table, **one** TypeScript constant list (`AuditAction` in `lib/shared/audit/actions.ts`) and **one** screen. Adding an event means adding it to this document, to `AuditAction` and to the SQL catalog, then calling `audit_write` (rule base.md section 2).

## Events recorded (the catalog)

This table is the **registry of audit actions** (rule: one row per action; `AuditAction` in TypeScript and the catalog inside `audit_write` must contain exactly these). Access decisions about accounts and roles (role changes, suspension, approval of access) are **not** here: they live in `profile_audit` and `role_audit`. Logins are not audited here.

| Action | Entity type | Written by |
|---|---|---|
| `invitation.created` | `invitation` | `invitation_create` |
| `invitation.revoked` | `invitation` | `invitation_revoke` |
| `invitation.accepted` | `invitation` | `accept_invitation` |
| `client.created` | `client` | `client_save` |
| `client.updated` | `client` | `client_save` |
| `client.owner_changed` | `client` | `client_save` |
| `client.archived` | `client` | `client_set_archived` |
| `client.reactivated` | `client` | `client_set_archived` |
| `client.deleted` | `client` | `client_delete` |
| `contact.created` | `client_contact` | `client_contact_save` |
| `contact.updated` | `client_contact` | `client_contact_save` |
| `contact.deleted` | `client_contact` | `client_contact_delete` |
| `brand.created` | `brand` | `brand_save` |
| `brand.updated` | `brand` | `brand_save` |
| `brand.timezone_changed` | `brand` | `brand_save` |
| `brand.archived` | `brand` | `brand_set_archived` |
| `brand.reactivated` | `brand` | `brand_set_archived` |
| `brand.deleted` | `brand` | `brand_delete` |
| `brand.member_added` | `brand_member` | `brand_member_set` |
| `brand.member_revoked` | `brand_member` | `brand_member_set` |
| `brand.member_can_decide_changed` | `brand_member` | `brand_member_set` |
| `channel.created` | `channel` | `channel_save` |
| `channel.updated` | `channel` | `channel_save` |
| `channel.archived` | `channel` | `channel_set_archived` |
| `channel.reactivated` | `channel` | `channel_set_archived` |
| `channel.deleted` | `channel` | `channel_delete` |
| `content.created` | `content_item` | `content_item_save` |
| `content.updated` | `content_item` | `content_item_save` |
| `content.cancelled` | `content_item` | `content_item_cancel` |
| `content.deleted` | `content_item` | `content_item_delete` |
| `content.submitted` | `content_item` | `submit_for_approval` |
| `content.reopened` | `content_item` | `reopen_content` (reason in metadata) |
| `content_channel.added` | `content_channel` | `content_item_save` |
| `content_channel.removed` | `content_channel` | `content_item_save` |
| `content_channel.rescheduled` | `content_channel` | `reschedule_channel` (old and new instant) |
| `content_channel.published_manually` | `content_channel` | `mark_published` |
| `content_channel.cancelled` | `content_channel` | `content_channel_cancel` |
| `calendar_note.created` | `calendar_note` | `calendar_note_save` |
| `calendar_note.updated` | `calendar_note` | `calendar_note_save` |
| `calendar_note.archived` | `calendar_note` | `calendar_note_archive` |
| `calendar_note.converted` | `calendar_note` | `content_item_save` (`source_note`) |
| `variant.created` | `content_variant` | legacy: written before 2026-10-19, kept so old history keeps its label |
| `variant.updated` | `content_variant` | legacy |
| `variant.submitted` | `content_variant` | legacy |
| `variant.reopened` | `content_variant` | legacy |
| `variant.rescheduled` | `content_variant` | legacy |
| `variant.cancelled` | `content_variant` | legacy |
| `variant.published_manually` | `content_variant` | legacy |
| `comment.created` | `comment` | `comment_add`, `portal_add_comment` |
| `comment.deleted` | `comment` | `comment_delete` |
| `approval.requested` | `approval_request` | `submit_for_approval`, `reassign_approver` |
| `approval.decided` | `approval_request` | `portal_decide_approval` |
| `approval.superseded` | `approval_request` | `submit_for_approval`, `reopen_content`, `reschedule_channel` |
| `approval.cancelled` | `approval_request` | `cancel_request` |
| `approval.approver_reassigned` | `approval_request` | `reassign_approver` |
| `approval.reminder_sent` | `approval_request` | `send_approval_reminder` |
| `media.published` | `media_version` | `media_publish_derivative` |
| `media.unpublished` | `media_version` | `media_withdraw_derivative` |
| `media.deleted_permanently` | `media_asset` | `media_delete_permanently` |
| `media.version_replaced` | `media_asset` | `media_replace_version` |
| `media.share_created` | `media_share` | `media_share_create` |
| `media.share_revoked` | `media_share` | `media_share_revoke` |
| `site.page_published` | `site_page` | `publish_site_page` |
| `site.page_unpublished` | `site_page` | `unpublish_site_page` |
| `site.rolled_back` | `site_page` | `site_rollback` |
| `site.case_study_authorized` | `site_page` | `site_case_study_authorize` |
| `site.case_study_withdrawn` | `site_page` | `site_case_study_withdraw` |
| `site.settings_changed` | `site` | `site_settings_save`, `site_redirect_save`, `site_redirect_delete` |
| `settings.policy_changed` | `organization_setting` | `organization_setting_save` |
| `organization.updated` | `organization` | `organization_save` |
| `audit.exported` | `audit_event` | `exportAudit` (server function) |

Rule: the **decision** of an approval is an immutable row in `approval_decisions`; the audit event references it; both exist in the same transaction.

## Screen

Route `/admin/settings/audit` (action `audit.view`; only the Owner by default).

- Table: time (shown in the organization's zone), actor, action (human label in pt-BR), entity (with a link when the person can open it), brand, short summary.
- Filters: period, actor, domain/action, brand, entity type, text in the id. Server pagination; filters in the URL.
- Detail drawer with the stored metadata (as-is), request id and the link to the entity.
- Export of the filtered result as CSV (needs `audit.view` and is itself audited as `audit.exported`), limited to a maximum number of rows.
- A brand tab shows the business events of that brand to users with `audit.view` or `approvals.view` (events of the entity types they can see), so the approval history is available next to the content.

Visibility: an event with a `brand_id` is only visible to users who `can_access_brand` it **and** have `audit.view`; events without a brand (settings, roles) only to `audit.view` holders. External users never read audit events; the portal shows the decision history through `portal_get_approval`.

## Retention and privacy

- Default retention 24 months (configurable in the policies); the cleanup routine deletes older events in batches and records its own run.
- Personal data in metadata is limited to ids; names are resolved at read time, so erasing or anonymizing a person (LGPD request) does not require rewriting history; anonymized actors appear as "Usuário removido".
- The audit never stores passwords, tokens, signed URLs, invitation tokens or secrets.

## Data model

> Authoritative schema: [../reference/data-model.md](../reference/data-model.md). Functions, actions, audit and notifications per operation: [../reference/functions.md](../reference/functions.md). Statuses and constants: [../reference/enums.md](../reference/enums.md).

```sql
create table audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  brand_id uuid,
  actor_id uuid,
  actor_kind text not null default 'internal' check (actor_kind in ('internal','external','system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  request_id text,
  occurred_at timestamptz not null default now()
);
create index on audit_events (organization_id, occurred_at desc);
create index on audit_events (brand_id, occurred_at desc);
create index on audit_events (entity_type, entity_id);
```

RLS: `select` requires `has_action('audit.view')` and (`brand_id is null` or `can_access_brand(brand_id)`); no policy for `insert`/`update`/`delete`; the writer function is `security definer`. The `AuditAction` constants are verified against the actions used in SQL by `check:consistency`.

## Permissions

| Action | Allows |
|---|---|
| `audit.view` | See and filter business events of the accessible scope; export |

## Acceptance criteria

- Every critical action of the table above writes exactly one event in the same transaction; a rolled-back operation leaves none.
- Nobody (not even the Owner) can edit or delete events through the application; only the retention routine deletes.
- A user without brand access never sees events of that brand, nor counts of them.
- An external user cannot read audit events.
- Metadata never contains secrets or full personal data.
- The export is limited, audited and respects the same visibility.

## Implementation status

Phase 0 done on 2026-10-18 (task P0-06): migration `20261018100200_audit_events.sql` (table, immutability trigger, `audit_write` with the catalog of 58 actions, organization-level read policy), `src/lib/shared/audit/actions.ts` (`AuditAction`), `supabase/tests/02_audit_events.test.sql` (14 assertions). `npm run check:consistency` compares the SQL catalog, `AuditAction` and the table in this document.

Validation performed: the 14 assertions passed on PGlite via `npm run db:verify`. **Not tested**: the real Supabase stack (`supabase test db`), see [../pending-external-setup.md](../pending-external-setup.md) V1/V3. Phase 1 (2026-10-18): brand-scoped read policy replaced in the clients migration; `audit_list` (filters, pagination, export that is itself audited) in `20261018100600_access_and_settings_functions.sql`; screen `/admin/settings/audit` with domain and period filters, detail drawer and CSV export (formula-injection safe); events written so far: invitations, clients, contacts, brands, members, channels, organization, policies. **Not tested**: real Supabase and the screen in a browser. **Pending**: filter by actor and brand in the UI, events of later modules.

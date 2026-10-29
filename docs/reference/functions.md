# Functions (SQL and server)

> Index of every callable of Aura Creative: **SQL functions** (called through `supabase.rpc`), **server functions** (`createServerFn` in `*.functions.ts`) and **server routes**. For each: who may call it, what it writes (audit, notifications), which errors it raises. Implementation shape: base.md section 5.1 (server function) and 5.5 (SQL). Multi-step writes are SQL functions (transactions); server functions validate the input, check the action, call the RPC and validate the output. Names here are authoritative; add a row before writing the code (GOLD-4).
>
> Legend — **Act.**: required action(s) (plus brand link where the data belongs to a brand). **Audit**: `AuditAction` written by `audit_write` ([../modules/audit.md](../modules/audit.md)). **Notif.**: notification kind created. Errors link to [error-codes.md](error-codes.md).

## 1. Authorization helpers (SQL, used by policies and functions)

| Function | Returns | Notes |
|---|---|---|
| `is_admin()` | boolean | approved Owner |
| `has_action(p_action text)` | boolean | Owner or role contains the action |
| `my_actions()` | text[] | for the UI (`getAuthState`) |
| `can_access_brand(p_brand uuid)` | boolean | Owner, or active internal link (approved profile) |
| `is_external_brand_member(p_brand uuid, p_must_decide boolean default false)` | boolean | active external link, optionally with `can_decide` |
| `can_view_client(p_client uuid)` | boolean | Owner, creator/owner of the client, or access to one of its brands (clients with no brand yet stay visible to their creator) |
| `current_organization_id()` | uuid | the single organization (internal helper) |
| `assert_action(p_action text)` / `assert_brand_access(p_brand uuid)` | void | raise `denied` / `not_found` (internal helpers used at the start of every write function) |
| `channel_is_used(p_channel uuid)` / `brand_has_history(p_brand uuid)` | boolean | internal checks; the content migration redefines them (a channel is used once a content channel row points to it; a brand has history once it has contents or media) |
| `editorial_transition_allowed(p_from text, p_to text)` | boolean | the transition map of [enums.md](enums.md), enforced by the `content_items_guard` trigger |
| `user_can_work_on_brand(p_user uuid, p_brand uuid)` | boolean | internal: approved internal account that is the Owner or an active internal member (used to validate an item owner) |
| `approver_is_valid(p_brand uuid, p_user uuid)` | boolean | internal: active external member of the brand with `can_decide`, approved account and a role that holds `approvals.decide` |
| `content_check_media(p_brand uuid, p_media jsonb)` / `content_normalize_media(p_media jsonb)` / `content_check_channel(p_brand uuid, p_channel uuid)` | void / jsonb / void | internal: raise `media_not_available`, `invalid_input`, `channel_brand_mismatch`, `channel_archived` |
| `content_cancel_pending_requests(p_item uuid, p_reason text)` / `content_channels_signature(p_item uuid)` | void / jsonb | internal: cancels the pending requests of a content; the signature of its active channel rows (used to refuse changes to an approved content) |
| `portal_assert_member(p_brand uuid)` / `portal_request_row(p_request approval_requests)` | void / jsonb | internal helpers of the portal functions (not callable by `authenticated`); the row carries `objective_kind` and `plan_summary` from the version snapshot (migration `20261020130000_portal_request_plan_summary.sql`) |
| `notification_lead_days(p_user uuid, p_kind text)` | int[] | the person's lead days or the kind default (used by scanners) |
| `generate_due_notifications()` | jsonb | runs every `notify_scan_*` function and cleans old notifications (`pg_cron`); `notify_scan_invitations()` expires invitations and creates `invitation.expiring` |
| `audit_write(p_org uuid, p_brand uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb)` | void | single audit writer; validates `p_action` against the catalog |
| `notify_users(...)` / `resolve_notifications(p_ref_type text, p_ref_id uuid)` | void | single notification writer ([../foundations/notifications.md](../foundations/notifications.md)) |

All are `security definer` with a fixed `search_path`; `execute` is revoked from `anon` except where the public read functions below say otherwise.

## 2. Accounts, invitations, roles (module: authentication, roles-and-actions)

| SQL function | Server function | Act. | Audit / log | Errors |
|---|---|---|---|---|
| `invitation_create(p_email, p_role, p_grants jsonb, p_token_hash, p_expires_at)` | `createInvitation` (generates token, returns the link, sends email only when `sendEmail` is true) | `invitations.create` (+ role assignable) | `invitation.created` | `role_not_assignable`, `invalid_input` |
| `invitation_revoke(p_invitation)` | `revokeInvitation` | `invitations.create` | `invitation.revoked` | `not_found` |
| `accept_invitation(p_token_hash text)` | `acceptInvitation` (service role; creates the auth user) | none (token) | `invitation.accepted`; Notif. `invitation.accepted` | `invitation_invalid`, `invitation_email_mismatch` |
| `profile_set_access(p_profile, p_status, p_role default null)` | `setUserAccess` | `users.manage` / `users.approve` | `profile_audit` | `last_owner`, `self_change_forbidden`, `role_not_assignable` |
| `role_save(p_role jsonb)` / `role_delete(p_role)` | `saveRole`, `deleteRole` | `roles.manage` | `role_audit` | `role_system_protected`, `role_in_use`, `action_requires_read`, `portal_role_internal_action` |
| — | `getAuthState`, `signIn` (generic errors, no enumeration), `signOut`, `updateProfile` | approved | — | — |

### 2b. Organization, settings and audit access (module: organization-settings, audit)

| SQL function | Server function | Act. | Audit | Errors |
|---|---|---|---|---|
| `organization_save(p_organization jsonb)` | none (no screen since 2026-10-19; kept in the database for manual use) | `settings.manage` | `organization.updated` | `conflict`, `invalid_input` |
| `organization_setting_save(p_key text, p_value jsonb, p_expected_version int)` | `saveOrganizationSetting` | `settings.manage` | `settings.policy_changed` | `conflict`, `invalid_input` |
| `audit_list(p_filters jsonb, p_page int, p_export boolean default false)` (checks `audit.view` and brand scope itself; with `p_export` returns up to 5000 rows and writes `audit.exported`) | `listAuditEvents` | `audit.view` | — | `denied` |
| (same `audit_list` with `p_export`) | `exportAudit` (CSV, row limit) | `audit.view` | `audit.exported` | `denied` |

### 2c. Support server functions (reads and small writes, no SQL function of their own)

| Server function | Act. | Notes |
|---|---|---|
| `listUsers`, `listInvitations` | `users.view` | paginated, filtered on the server (RLS) |
| `listRoles` (with the action catalog), `listAssignableRoles` | `roles.manage` / `invitations.create` | assignable roles hide the owner role and administration-only roles for non-owners |
| `previewInvitation`, `resendInvitation` | none (token) / `invitations.create` | preview uses the service role and reveals only the invited e-mail and role name; resend (`{ id, sendEmail }`) creates a new invitation (revokes the pending one) and returns the new link, sending email only when `sendEmail` is true |
| `listSettings`, `saveSetting` | `settings.manage` | `saveSetting` validates each policy group with zod before `organization_setting_save` |
| `listAuditEvents` | `audit.view` | calls `audit_list`; filters: domain, period, actor, brand, entity |
| `listNotifications`, `countUnread`, `markRead`, `markAllRead`, `snoozeNotification`, `listPreferences`, `savePreference` | approved account | own rows only; RLS applies (update limited to `read_at` and `snoozed_until`) |
| `changePassword` | approved account | Supabase Auth `updateUser` |
| `listBrandOptions` | `brands.view` | lightweight picker list (shared space) |
| `listBrandMembers`, `listMemberCandidates` | `brands.view` / `brands.manage_members` | |
| `findSimilarClients`, `listOwnerOptions` | `clients.view` | duplicate warning and owner select |

## 3. Clients, brands, channels (module: clients, brands, channels)

| SQL function | Server function | Act. | Audit | Errors |
|---|---|---|---|---|
| `client_save(p_client jsonb, p_create_brand boolean)` | `saveClient` | `clients.create` / `clients.update` (+ `brands.create` when creating the first brand) | `client.created`, `client.updated`, `client.owner_changed` | `conflict`, `invalid_input` |
| `client_set_archived(p_client, p_archived, p_archive_brands boolean)` | `setClientArchived` | `clients.update` | `client.archived`, `client.reactivated` | `conflict` |
| `client_delete(p_client)` | `deleteClient` | `clients.delete` | `client.deleted` | `client_has_brands` |
| `client_contact_save(p_contact jsonb)` / `client_contact_delete(p_contact)` | `saveClientContact`, `deleteClientContact` | `clients.update` | `contact.created`, `contact.updated`, `contact.deleted` | `contact_email_invalid` |
| `brand_save(p_brand jsonb)` | `saveBrand` | `brands.create` / `brands.update` | `brand.created`, `brand.updated`, `brand.timezone_changed` | `brand_name_taken`, `conflict` |
| `brand_set_logo(p_brand, p_version)` | `setBrandLogo` | `brands.update` (+ brand link) | `brand.updated` | `logo_invalid` |
| `brand_logo_keys(p_brands)` | read by `listBrandOptions`, `listBrands`, `getBrand` (the server signs the thumbnail) | `brands.view` + brand link | — | — |
| `brand_set_archived(p_brand, p_archived)` | `setBrandArchived` | `brands.update` | `brand.archived`, `brand.reactivated` | `conflict` |
| `brand_delete(p_brand)` | `deleteBrand` | `brands.delete` | `brand.deleted` | `brand_not_empty` |
| `brand_member_set(p_brand, p_user, p_kind, p_can_decide, p_status)` | `setBrandMember` | `brands.manage_members` | `brand.member_added`, `brand.member_revoked`, `brand.member_can_decide_changed` | `member_kind_mismatch`, `last_internal_member` |
| `channel_save(p_channel jsonb)` | `saveChannel` | `channels.create` / `channels.update` | `channel.created`, `channel.updated` | `channel_duplicate`, `platform_change_forbidden`, `conflict` |
| `channel_set_archived(p_channel, p_archived)` | `setChannelArchived` | `channels.update` | `channel.archived`, `channel.reactivated` | — |
| `channel_delete(p_channel)` | `deleteChannel` | `channels.delete` | `channel.deleted` | `channel_in_use` |
| list/get via typed queries with RLS | `listClients`, `getClient`, `listBrands`, `getBrand`, `listChannels` | `*.view` | — | `not_found` |

## 4. Content and approvals (module: content, approvals)

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `content_item_save(p_item jsonb)` | `saveContentItem` | `content.create` / `content.update` | `content.created`, `content.updated`, `content_channel.added`, `content_channel.removed`, `calendar_note.converted` (with `source_note`) | — | `conflict`, `plan_locked` (publication date and rows after the plan is approved), `requires_new_revision`, `channel_archived`, `channel_brand_mismatch`, `media_not_available`, `invalid_input`, `transition_not_allowed` |
| `content_type_save(p_type jsonb)` | `saveContentType` | `content.manage_types` | `content_type.saved` | — | `content_type_name_taken`, `invalid_input`, `not_found` |
| `content_type_set_archived(p_type uuid, p_archived boolean)` | `archiveContentType` | `content.manage_types` | `content_type.archived` | — | `not_found` |
| (typed query) | `listContentTypes` (active types) / `listContentTypeCatalog` (all types with the count of contents) | `content.view` / `content.manage_types` | — | — | — |
| `content_item_save` (new item) | `duplicateContentItem` | `content.create` | `content.created`, `content_channel.added` | — | `invalid_input`, `media_not_available`, `channel_archived`, `brand_archived` |
| `content_item_cancel(p_item, p_reason)` | `cancelContentItem` | `content.cancel` | `content.cancelled` | — | `reason_required` |
| `content_item_delete(p_item)` | `deleteContentItem` | `content.delete` | `content.deleted` | — | `content_has_history` |
| `content_move(p_item, p_to_status, p_expected_version)` | `moveContent` (board) | `content.update` | `content.updated` | — | `transition_not_allowed`, `conflict`, `plan_not_approved` |
| `content_channel_cancel(p_channel_row, p_reason)` | `cancelContentChannel` | `content.cancel` | `content_channel.cancelled` | — | `reason_required`, `transition_not_allowed` |
| `submit_for_approval(p_item, p_due_date, p_message, p_expected_version)` (the stage comes from the editorial status; notifies every approver of the brand) | `submitForApproval` | `content.submit` | `content.submitted` (with `stage`), `approval.requested`, `approval.superseded` (when replacing) | `approval.requested`, `approval.superseded` | `conflict`, `channel_required`, `media_not_available`, `approver_required`, `plan_incomplete`, `plan_not_approved`, `channel_archived` |
| `approve_on_behalf(p_item, p_stage, p_reason, p_expected_version)` (`plan` or `art`; reuses the pending request or freezes a version through `content_freeze_revision`) | `approveOnBehalf` | `approvals.override` | `approval.approved_by_team` | `approval.approved_by_team` (only when a request was pending) | `denied`, `not_found`, `conflict`, `invalid_input`, `transition_not_allowed`, `plan_not_approved`, `channel_required`, `channel_archived`, `media_not_available`, `plan_incomplete` |
| `reopen_content(p_item, p_reason, p_scope)` (`art` or `plan`) | `reopenContent` | `content.reopen` | `content.reopened` (with `scope`), `approval.superseded` (when a request was pending) | `approval.superseded` | `reason_required`, `transition_not_allowed`, `invalid_input` |
| `brand_approver_ids(p_brand)`, `plan_approval_required()`, `content_plan_signature(p_item)` (internal helpers, not granted to clients) | — | — | — | — | — |
| `reschedule_channel(p_channel_row, p_planned_at, p_timezone, p_expected_version)` | `rescheduleChannel` | `calendar.manage` + `content.update` | `content_channel.rescheduled` (plus `approval.requested` and `approval.superseded` when it creates a version) | `approval.requested`, `approval.superseded` (only when the content was awaiting approval or approved) | `conflict`, `transition_not_allowed`, `channel_archived`, `approver_required`, `plan_locked`, `invalid_input` |
| `reschedule_production_deadline(p_item, p_date, p_expected_version)` | `rescheduleProductionDeadline` | `calendar.manage` + `content.update` | `content.updated` | — | `conflict`, `transition_not_allowed`, `invalid_input` |
| `publish_content(p_item, p_expected_version)` | `publishContent` | `content.publish_manual` | `content.published` | — | `not_approved`, `channels_not_published`, `conflict` |
| `media_purge_pending()` / `media_purge_confirm(p_ids)` | the cron route `/api/cron/media-cleanup` and `publishContent` (service role, never `authenticated`) | — | — | — | — |
| `mark_published(p_channel_row, p_published_at, p_url, p_evidence_media_version, p_note)` | `markPublished` | `content.publish_manual` | `content_channel.published_manually` | — | `not_approved`, `transition_not_allowed` |
| `calendar_note_save(p_note jsonb)` (ideas, dates and events; an event carries `event_type`, `all_day`, `end_date`, `starts_at`, `ends_at`, `timezone`, `location`, `client_visible`, `internal_notes`) | `saveCalendarNote` | `calendar.manage` + brand | `calendar_note.created`, `calendar_note.updated` (with `kind` and `client_visible`) | `calendar.event` (to the client members, when a shared note is created, changed, hidden or archived) | `conflict`, `transition_not_allowed`, `invalid_input`, `brand_archived`, `not_found` |
| `calendar_note_archive(p_note)` | `archiveCalendarNote` | `calendar.manage` + brand | `calendar_note.archived` | `calendar.event` (when the note was shared) | `transition_not_allowed`, `not_found` |
| `calendar_note_get(p_note)` (returns the event fields and the internal notes, team only) | `getCalendarNote` | `calendar.view` + brand | — | — | `not_found` |
| `calendar_note_days(...)`, `calendar_event_when(note)`, `calendar_event_notify(note, change)` (internal helpers, not granted to clients) | — | — | — | — | — |
| (history only, no function writes them) | — | — | `approval.approver_reassigned` (written by the removed `reassign_approver` until 2026-10-20), `variant.created`, `variant.updated`, `variant.submitted`, `variant.reopened`, `variant.rescheduled`, `variant.cancelled`, `variant.published_manually` | — | — |
| `comment_add(p_item, p_visibility, p_body, p_parent)` | `addComment` | `comments.create_internal` for an internal comment, `comments.create_external` for an external one written by the team | `comment.created` | — (only `portal_add_comment` notifies the team) | `invalid_input` |
| `comment_edit(p_comment, p_body)` | `editComment` | author | `comment.edited` | — | `denied`, `invalid_input`, `not_found` |
| `comment_delete(p_comment)` | `deleteComment` | author | `comment.deleted` | — | `denied` |
| `cancel_request(p_request, p_reason)` | `cancelApprovalRequest` | `content.submit` | `approval.cancelled` | — | `reason_required`, `request_not_pending` |
| `send_approval_reminder(p_request)` | `remindApprover` | `content.submit` | `approval.reminder_sent` | `approval.requested` (reminder) | `request_not_pending` |
| `comment_list(p_item)` | `listComments` | `content.view` or `approvals.view` + brand | — | — | `not_found` |
| `approver_options(p_brand)` (the approvers of the brand, who are asked when a content is sent) | `listApproverOptions` | `content.submit` + brand | — | — | `not_found` |
| `profile_set_avatar(p_version)` | `setAvatar` | approved profile (own photo only) | — (personal preference, not audited) | — | `avatar_invalid`, `denied` |
| `person_avatar_keys(p_ids uuid[])` (the server signs the thumbnails) | `getAvatarUrls` | approved profile; sees self, owners and people who share a brand | — | — | `denied` |
| `media_request_upload` / `media_confirm_upload` with scope `profile` | `requestUpload`, `confirmUpload` | approved profile (no `media.upload`); own photo only | — | — | `upload_type_not_allowed`, `upload_too_large` |
| `person_names(p_ids uuid[])` | (internal helper `personNames`, not a server function) | `content.view` or `approvals.view` | — | — | `denied` |
| (typed query) | `listAssigneeOptions` | `content.view` + brand | — | — | `not_found` |
| typed queries | `listContentItems`, `getContentItem`, `listBoard`, `listApprovals`, `getApprovalRequest` | `content.view` / `approvals.view` | — | — | `not_found` |

Implemented in `20261018100900_content.sql` (tables, triggers, RLS) and `…100910_content_functions.sql`, then redefined by the single-aggregate refactor (`20261019130000` to `…130030`, 2026-10-19: the `*_variant_*` functions were replaced by the ones above and `variant.*` stopped being written). Notes: `content_move` only performs the transitions that need no side effect (`draft → in_production`, `in_production ↔ internal_review`, `changes_requested → in_production`); sending, deciding, reopening and cancelling have their own functions. `content_item_save` takes the whole content **and** its `channels` array (`id`, `channel_id`, `format`, `caption`, `planned_at`, `planned_timezone`) in one transaction: rows with an `id` are updated, rows without are added, rows missing are removed unless published (then `transition_not_allowed`); an `approved` content refuses a change of caption, call to action, files or channel rows with `requires_new_revision` (reopen first). `content_item_delete` is allowed only while no version or comment exists (`content_has_history`). `reschedule_channel` (phase 4, rewritten for channel rows): a content before approval just changes the date of that row; one awaiting approval or approved gets a new version copied from the current one with the new date of that channel, addressed to the same approver, and its pending request is superseded. The audit actions `variant.created`, `variant.updated`, `variant.submitted`, `variant.reopened`, `variant.rescheduled`, `variant.cancelled` and `variant.published_manually` remain in the catalog only as history of the old model; no function writes them any more. The conversion of a local time to an instant happens in TypeScript, so `local_time_nonexistent` and `local_time_ambiguous` are raised there and `date_in_past` is only a warning of the dialog.

## 5. Portal (module: portal) — the only functions external users can call

All: `security definer`, require `has_action('portal.view')` and an active external link; return explicit columns; outputs validated in the server function (`parseOutput`).

| SQL function | Server function | Extra requirement | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `portal_list_brands()` (returns the client name too) | `listPortalBrands` | — | — | — | — |
| `portal_get_brand(p_brand)` | `getPortalBrand` | — | — | — | `not_found` |
| `portal_brand_logo_keys(p_brands uuid[])` (the server signs the thumbnails) | `listPortalBrands`, `getPortalBrand` | — | — | — | — |
| `portal_list_pending(p_brand)` | `listPortalPending` | link to brand | — | — | `not_found` |
| `portal_list_approvals(p_brand, p_status, p_page, p_page_size)` | `listPortalApprovals` | link to brand; status filter `pending`, `approved`, `changes_requested`, `superseded` (cancelled requests never appear) | — | — | `not_found`, `invalid_input` |
| `portal_get_approval(p_request)` | `getPortalApproval` | link to the request's brand; request shared with the person | — | — | `not_found` |
| `portal_record_view(p_request)` | `recordPortalView` | — | — | — | — |
| `portal_decide_approval(p_request, p_outcome, p_comment)` | `decidePortalApproval` | `approvals.decide`; any approver of the brand (`approver_is_valid`: external member with `can_decide`); the first decision wins | `approval.decided` (with `stage`) | `approval.decided` | `denied`, `request_not_pending`, `revision_superseded`, `comment_required` |
| `portal_list_comments(p_item)` | `listPortalComments` | link | — | — | `not_found` |
| `portal_add_comment(p_item, p_body)` | `addPortalComment` | `comments.create_external` | `comment.created` | `comment.created` | `invalid_input` |
| `portal_list_calendar(p_brand, p_from, p_to)` | `listPortalCalendar` | link to the brand; returns `{ brand_timezone, events, entries }`: `entries` has one entry per channel row of the latest version of each content that has a request that is not cancelled (date, status and title from the snapshot); `events` has the occurrences of the shared events and dates of the brand (title, description, type, day, time and zone, place; never the internal notes); range at most 100 days | — | — | `not_found`, `invalid_input` |
| `portal_media_urls(p_revision, p_version_ids uuid[])` (checks, then the server signs; `signPortalPreviewMedia` batches display-derivative signing for listing previews, falling back to the original when no derivative exists) | `signPortalMedia`, `signPortalPreviewMedia` | revision shared with the person | — | — | `denied` |

## 6. Calendar and dashboard (modules: calendar, dashboard)

| SQL function | Server function | Act. | Notes |
|---|---|---|---|
| `list_calendar_entries(p_from, p_to, p_brands uuid[], p_channels uuid[], p_assignee uuid, p_editorial text[], p_publication text[], p_notes text[])` | `listCalendarEntries` | `calendar.view` | range at most 100 days (`invalid_input` otherwise); returns `{ entries, truncated, undated }` (at most 500 entries and 100 undated channel rows; entry kinds in `CalendarEntryKind`, including `idea` and `date` when `p_notes` lists them); implemented in `20261019130020_calendar_notes.sql` |
| `reschedule_channel`, `reschedule_production_deadline` | `rescheduleChannel`, `rescheduleProductionDeadline` | `calendar.manage` + `content.update` | see section 4 |
| `calendar_range_ok(p_from, p_to)`, `content_item_is_ready(p_item)`, `notification_date_text(p_date)` | — | — | internal helpers of the calendar migration (not callable by `authenticated`) |
| `notify_scan_content()` | cron route `/api/cron/due-notifications` through `generate_due_notifications()` | service role / `pg_cron` | writes `approval.overdue` (to whoever submitted), `content.due_soon`, `content.overdue` (owner and managers of the brand) and `content.publish_due` (one per channel row), idempotent through `dedupe_key`, and resolves the ones that no longer apply |
| `dashboard_attention(p_brands uuid[])` | `getAttention` | `content.view` / `approvals.view` | single definition of "needs attention"; returns each content once with its `DashboardReason` list (approval reasons only with `approvals.view`); implemented in `20261018100930_dashboard.sql` and redefined in `20261019130030_content_single_aggregate_portal.sql` |
| `dashboard_publication_pending(p_brands uuid[])` | `getPublicationPending` | `content.publish_manual` | contents `approved` with a `planned` channel row whose `planned_at` has passed (cancelled ones excluded, brand link checked, at most 50, oldest first); the "Marcar como publicado" block | — | — | `denied` |
| `dashboard_upcoming(p_brands uuid[], p_days int)` | `getUpcoming` | `calendar.view` | |
| `dashboard_status_counts(p_brands uuid[])` | `getStatusCounts` | `content.view` | counts contents by editorial status, cancelled ones excluded |
| `dashboard_my_items()` | `getMyItems` | `content.view` | contents assigned to the caller with their editorial status, at most 20 |
| (typed query `listApprovals`) | `getPendingApprovals` | `approvals.view` | the "Aprovações pendentes" block reuses the approvals list filtered by `pending` |
| `dashboard_recent_activity(p_brands uuid[], p_limit int)` | `getRecentActivity` | `audit.view` or `approvals.view` | |

## 7. Media (module: media-library)

| SQL function | Server function / route | Act. | Audit | Errors |
|---|---|---|---|---|
| `media_request_upload(p_scope, p_brand, p_filename, p_size, p_mime, p_idempotency_key, p_asset default null)` (a given `p_asset` creates a new version and needs `media.update`; accepts the MIME types of [../spaces/media-library.md](../spaces/media-library.md) section 7) | `requestUpload` (then signs the PUT URLs) | `media.upload` (+ brand link; `site.view` for the site scope) | — | `upload_too_large`, `upload_type_not_allowed`, `quota_exceeded`, `storage_unavailable` |
| `media_confirm_upload(p_version, p_checksum, p_width, p_height, p_duration, p_derivative_bytes default 0)` | `confirmUpload` (stat → range read → validates → calls the RPC) | `media.upload` | — | `upload_size_mismatch`, `upload_content_mismatch`, `upload_video_invalid`, `upload_not_received`, `media_not_available` |
| `media_update(p_asset jsonb)` | `updateMedia` | `media.update` | — | `conflict` |
| `media_set_trashed(p_asset, p_trashed)` | `trashMedia` | `media.delete` | — | `media_in_use` (when archiving a used file is restricted) |
| `media_delete_permanently(p_asset)` | `deleteMediaPermanently` | `media.delete` | `media.deleted_permanently` | `media_in_use` |
| `media_replace_version(p_asset, p_version)` | `replaceMediaVersion` | `media.update` + `media.upload` | `media.version_replaced` | `conflict` |
| `media_publish_derivative(p_version)` | `publishMedia` | `media.publish` | `media.published` | `media_not_available` |
| `media_withdraw_derivative(p_version)` | `withdrawMedia` | `media.publish` | `media.unpublished` | `media_in_use` |
| `media_collection_save` / `media_collection_delete` / `media_collection_move_items` | `saveCollection`, `deleteCollection`, `moveToCollection` | `media.update` (delete: `media.delete`) | — | `invalid_input` |
| `media_share_create(p_input)` / `media_share_update(p_input)` / `media_share_revoke(p_share)` | `createMediaShare`, `updateMediaShare`, `revokeMediaShare` | `media.share` (+ brand link; `site.view` for the site scope) | `media.share_created`, `media.share_revoked` (update is recorded only in `media_share_events`) | `share_invalid`, `share_invalid_expiry`, `password_weak`, `share_target_invalid`, `share_not_found`, `share_not_active` |
| `media_share_list(p_kind, p_target)` / `media_share_targets()` | `listMediaShares`, `listShareTargets` | `media.share` / `media.view` | — | `share_target_invalid` |
| `media_share_public_open(p_token, p_grant)` / `media_share_public_unlock(p_token, p_password)` / `media_share_public_file(p_token, p_grant, p_asset, p_mode)` | `openSharedMedia`, `unlockSharedMedia`, `getSharedFileUrl` (public, no session) | none: the secret, the status, the expiry, the lock, the download limit and the password session are checked inside the function; granted to `anon` | — | answers with a state value instead of raising |
| `media_storage_used()`, `media_storage_summary()` (used and quota) | `getStorageSummary` | `media.view` | — | — |
| `media_mark_failed(p_version, p_reason)` (author only; returns the object keys to delete; notifies `media.upload_failed`) | `abortUpload`, and `confirmUpload` on any validation failure | `media.upload` | — | `not_found` |
| `media_expire_sessions()` (service role only; returns the keys of abandoned uploads) | cron route `/api/cron/media-cleanup` | `CRON_SECRET` | — | — |
| `media_storage_keys()` | `checkStorage` ("Verificar com o bucket": compares the bucket listing with the keys) | `media.delete` | — | `storage_unavailable` |
| `media_policy_mb(p_name, p_default)`, `media_version_in_use(p_version)`, `media_assert_asset_access(p_asset)`, `can_view_media_asset(p_asset)` | — | internal helpers (`media_version_in_use` is redefined by the content migration to include `content_revision_media`) | — | — |
| — | `listMedia`, `getMedia`, `listCollections` | `media.view` | — | `not_found` |
| — | `signMediaUrls` (authorizes then signs) | `media.view` (+ brand link) or portal | — | `denied`, `storage_unavailable` |
| — | server route `/api/cron/media-cleanup` | `CRON_SECRET` | — | — |

## 8. Site and CMS (module: cms-site)

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `site_page_save(p_page jsonb, p_expected_version int)` | `saveSitePage` | `site.edit` (structure fields: `site.structure`) | — | — | `slug_taken`, `slug_reserved`, `conflict`, `page_system_protected` |
| `site_ensure()` | `ensureSite` (called by the overview) | `site.view` | — | — | `denied` |
| `site_page_delete(p_page)` | `deleteSitePage` | `site.structure` | — | — | `page_system_protected`, `page_has_history` |
| `site_entry_save(p_entry jsonb)` / `site_entry_delete(p_entry)` | `saveSiteEntry`, `deleteSiteEntry` | `site.edit` | — | — | `conflict` |
| `site_settings_save(p_group text, p_value jsonb, p_expected_version int)` | `saveSiteSettings` | `site.settings` | `site.settings_changed` | — | `conflict`, `invalid_input` |
| `site_case_study_authorize(p_page, p_brand, p_consent_note)` | `authorizeCaseStudy` | `site.edit` + `brands.view` with link | `site.case_study_authorized` | — | `denied` |
| `site_case_study_withdraw(p_page)` | `withdrawCaseStudy` | `site.edit` | `site.case_study_withdrawn` | `site.published`-type warning (none) | — |
| `publish_site_settings(p_resolved, p_expected_version)` | `publishSiteSettings` | `site.publish` | `site.settings_changed` | `site.published` | `draft_changed`, `media_not_published`, `invalid_input` |
| `publish_site_page(p_page, p_note, p_resolved, p_expected_hash)` | `publishSitePage` (resolves links and images in TypeScript, runs the checks, then calls this) | `site.publish` | `site.page_published` | `site.published` | `publish_checks_failed` (TypeScript), `draft_changed`, `nothing_to_publish`, `media_not_published`, `case_study_not_authorized` |
| `unpublish_site_page(p_page)` | `unpublishSitePage` | `site.publish` | `site.page_unpublished` | — | `page_system_protected` |
| `site_rollback(p_page, p_revision)` | `rollbackSitePage` | `site.publish` | `site.rolled_back` | `site.published` | `not_found`, `media_not_published`, `case_study_not_authorized` |
| `site_redirect_save(p_redirect jsonb)` / `site_redirect_delete(p_redirect)` | `saveRedirect`, `deleteRedirect` | `site.settings` | `site.settings_changed` | — | `redirect_invalid` |
| `site_contact_submit(p_site, p_payload jsonb)` (granted to `anon`) | `submitContactMessage` (rate limit + Turnstile + honeypot) | none (public) | — | `site.contact_message` | `contact_consent_required`, `rate_limited`, `invalid_input` |
| (no SQL; reads the environment) | `getContactConfig` (returns only the public Turnstile site key for the landing form; section 18.1 of [../spaces/cms-site.md](../spaces/cms-site.md)) | none (public) | — | — | — |
| `site_contact_update(p_message, p_status, p_note)` | `updateContactMessage` | `site.view` | — | — | `not_found` |
| `site_published_page(p_slug)` (granted to `anon`) | `getPublicPage` | public | — | — | — |
| `site_published_settings()` (granted to `anon`) | `getPublicSettings` | public | — | — | — |
| `site_published_sitemap()` (granted to `anon`) | `getPublicSitemap` | public | — | — | — |
| `site_draft_snapshot(p_page)` | `getDraftSnapshot` (preview and publish) | `site.view` | — | — | `not_found` |
| `site_pages_overview()` | `listSitePages` | `site.view` | — | — | — |
| `site_overview()` | `getSiteOverview` | `site.view` | — | — | — |
| (typed query) | `listPageOptions`, `getPageEditor`, `getPreview`, `checkPublish`, `listRevisions`, `listEntries`, `listMessages`, `getCaseAuthorization`, `getSettings`, `listRedirects` | `site.view` (`site.settings` for settings and redirects, `site.publish` for revisions) | — | — | `not_found` |
| `site_media_info(p_ids uuid[])` | `getSiteMediaInfo` (the resolver of images) | `site.view` + visibility of each file | — | — | — |
| `site_media_ids(p_content)`, `site_media_in_use(p_version)`, `site_redirect_check(p_site, p_from, p_to)`, `site_publish_page_row(...)`, `site_pages_guard()`, `site_page_revisions_guard()` | — | internal helpers (not callable by `authenticated`) | — | — | — |

Notes on section 8: `site_published_page` answers an object with a status of none, ok (with the page kind, its content and the cards of the authorized case studies), redirect (with the destination and whether it is permanent) or not_found; `site_draft_snapshot` returns the draft, its md5 hash, the status and whether a case study is authorized; `site_media_info` returns checksum, size, mime and whether each image is public.

## 9. Notifications and jobs (modules: notifications, audit)

| SQL function | Server function / route | Act. | Notes |
|---|---|---|---|
| `notify_users(p_kind, p_brand, p_title, p_body, p_link, p_ref_type, p_ref_id, p_dedupe_key, p_recipients uuid[])` | — (called by other functions) | — | single writer; checks recipients' action and brand scope |
| `resolve_notifications(p_ref_type, p_ref_id)` | — | — | |
| `notification_lead_days(p_user, p_kind)` | — | — | |
| `notification_kind_save(p_kind, p_default_lead_days int[], p_default_email boolean)` | `listKindDefaults`, `saveKindDefaults` | `notifications.configure` | audit `settings.policy_changed` with key `notifications.<kind>`; errors `invalid_input`, `not_found` |
| `generate_due_notifications()` | `pg_cron` daily/hourly | — | discovers `notify_scan_*` |
| `notify_scan_approvals()`, `notify_scan_content()`, `notify_scan_invitations()`, `notify_scan_publications()` | — | — | one per module |
| `notifications_cleanup()` | `pg_cron` | — | 90-day cleanup |
| `audit_cleanup()` | `pg_cron` | — | retention policy |
| — | `listNotifications`, `markRead`, `markAllRead`, `snoozeNotification`, `savePreferences` | approved | |
| — | server route `/api/cron/email-outbox` | `CRON_SECRET` | sends `email_outbox` rows |

## 9b. Instagram connection, automatic publishing and metrics (modules: instagram-publishing, metrics)

Specified in [../modules/instagram-publishing.md](../modules/instagram-publishing.md) and [../modules/metrics.md](../modules/metrics.md). **Service functions** are callable only with the service-role key (from the jobs in `src/lib/shared/jobs/`); `execute` is revoked from `anon` and `authenticated`.

### Channel connection

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `channel_connection_list(p_brand)` | `listChannelConnections` | `channels.view` + brand link | — (never returns the token) | — | `not_found` |
| `channel_connection_store(p_channel, p_actor, p_account jsonb, p_token_encrypted, p_expires_at, p_scopes)` | `completeInstagramConnection` (code exchange, long-lived token, encryption), through `storeConnection` in `lib/shared/jobs/connection-store.server.ts`. **Service only** (no grant to `authenticated`): the account id comes from Meta, never from the client, and the function re-checks `channels.connect` and the brand link for `p_actor` | service | `channel.connected` | — | `channel_archived`, `channel_account_in_use`, `invalid_input`, `not_found`, `denied` |
| `channel_connection_settings(p_channel, p_auto_publish_default, p_collect_metrics, p_expected_version)` | `saveConnectionSettings` | `channels.connect` | `channel.updated` | — | `conflict`, `not_found` |
| `channel_connection_disconnect(p_channel)` | `disconnectChannel` | `channels.connect` | `channel.disconnected` | — | `publish_in_progress`, `not_found` |
| `channel_connection_secret(p_channel)`, `channel_connections_to_renew(p_within_days)` | read by the jobs | service | — | — | — |
| `channel_connection_renewed(p_channel, p_token_encrypted, p_expires_at)` | `runChannelRenewal` | service | resolves the connection notifications | — | `not_found` |
| `channel_connection_failed(p_channel, p_status, p_code)` | jobs, `probeConnection` | service | `channel.connection_lost` | `channel.connection_expiring`, `channel.connection_expired` | `invalid_input`, `not_found` |
| `channel_connection_json(c)` | — | internal | the only shape returned to a client | — | — |

### Automatic publishing

| SQL function | Server function / route | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `channel_row_set_publish_mode(p_row, p_mode, p_expected_version)` | `setPublishMode` | `content.publish_manual` + brand link | `content_channel.publish_mode_changed` | — | `connection_missing`, `format_not_supported`, `transition_not_allowed`, `conflict`, `invalid_input` |
| `channel_row_publish_now(p_row, p_expected_version)` | `publishNow` (also the retry of a failed row) | `content.publish_manual` + brand link | `content_channel.publish_requested` | — | `connection_missing`, `transition_not_allowed`, `conflict` |
| `content_publish_info(p_item)` | `getPublishInfo` | `content.view` + brand link | — | — | `not_found` |
| `publish_work(p_limit, p_late_hours)` | server route `/api/cron/publish-due` → `runPublishDue` | service | `content_channel.publish_failed` (connection missing or expired, too late) | `content.publish_failed` | — |
| `publish_attempt_set(p_attempt, p_status, p_container, p_error, p_provider)` | `runPublishDue` | service | — | — | `invalid_input`, `not_found` |
| `publish_row_complete(p_attempt, p_media_id, p_permalink)` | `runPublishDue` | service | `content_channel.published_auto` | `content.published_auto` | `not_found` |
| `publish_row_failed(p_attempt, p_code, p_provider, p_uncertain)` | `runPublishDue` | service | `content_channel.publish_failed` | `content.publish_failed` | `not_found` |
| `publish_row_release(p_attempt, p_code)` | `runPublishDue` | service | — | — | `not_found` |
| `publish_payload(p_row, p_attempt)`, `publish_notify_failed(p_row)` | — | internal | — | — | — |
| trigger `content_channels_guard` | — | — | — | — | `publish_in_progress` (a row being published cannot be rescheduled, cancelled or have its mode changed) |
| `dashboard_publication_pending(p_brands)` (updated) | `getPublicationPending` | `content.publish_manual` | — | — | `denied` |

### Metrics and reports

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `metrics_overview`, `metrics_top_posts`, `metrics_breakdown`, `metrics_audience`, `metrics_plan_summary`, `metric_marks_list` | `getMetricsAnalysis` | `metrics.view` + brand link | — | — | `invalid_input`, `not_found` |
| `metric_mark_save(p_mark jsonb)` | `saveMetricMark` | `metrics.report` | `metric_mark.created`, `metric_mark.updated` | — | `invalid_input`, `conflict`, `not_found` |
| `metric_mark_delete(p_mark)` | `deleteMetricMark` | `metrics.report` | `metric_mark.deleted` | — | `not_found` |
| `metrics_report_list(p_brand)`, `metrics_report_get(p_report)` | `listMetricReports`, `getMetricReport` | `metrics.view` + brand link | — | — | `not_found` |
| `metrics_report_save(p_report jsonb)` | `saveMetricReport` | `metrics.report` | — | — | `report_period_invalid`, `report_already_published`, `conflict`, `invalid_input` |
| `metrics_report_new_version(p_report)` | `newMetricReportVersion` | `metrics.report` | — | — | `transition_not_allowed` |
| `metrics_report_delete(p_report)` | `deleteMetricReport` | `metrics.report` | — | — | `report_already_published` |
| `metrics_report_publish(p_report, p_expected_version, p_snapshot jsonb)` | `publishMetricReport` (builds the snapshot on the server) | `metrics.report` | `metrics_report.published` | `metrics.report_published` | `report_empty`, `report_already_published`, `conflict`, `invalid_input` |
| `metrics_report_withdraw(p_report)` | `withdrawMetricReport` | `metrics.report` | `metrics_report.withdrawn` | — | `transition_not_allowed` |
| `dashboard_metrics_report_due(p_brands)` | `getReportsDue` | `metrics.report` | — | — | `denied` |
| `portal_metrics_report_list(p_brand)`, `portal_metrics_report_get(p_report)` | `portalListMetricReports`, `portalGetMetricReport` | `metrics.portal_view` + portal member | — | — | `denied`, `not_found` |
| `metrics_collect_targets()`, `metrics_store_daily`, `metrics_store_audience`, `metrics_store_media`, `metrics_media_due`, `metrics_store_post`, `metrics_collection_done` | `runCollectMetrics` | service | — | — | `invalid_input`, `not_found` |
| `metrics_snapshot_for_portal(p_snapshot, p_blocks)` | — | internal | — | — | — |
| `metrics_assert_read`, `metrics_totals`, `metrics_report_json`; triggers `metric_reports_guard`, `metric_reports_no_delete` | — | internal | — | — | `report_already_published` |
| — | `testChannelConnection` (checks the brand link with the caller's client, then `probeConnection` in `lib/shared/jobs/connection-test.server.ts` reads the stored token with the service role) | `channels.connect` | — | — | `not_found` |
| — | server route `/api/cron/publish-due` | `CRON_SECRET` | runs the publishing, token renewal and metrics collection jobs | — | — |

## 10. Rules

1. A server function calls **at most one** write RPC per user action (atomicity lives in SQL).
2. Every function that writes a business fact calls `audit_write` and, where listed, `notify_users` in the same transaction.
3. Public (`anon`) functions are exactly: `site_published_page`, `site_published_settings`, `site_published_sitemap`, `site_contact_submit`. Everything else revokes `anon`.
4. Portal functions are exactly the `portal_*` set of section 5. External roles call nothing else.
5. New function → new row here with action, audit, notification and errors; mirror in `check:consistency` where applicable.

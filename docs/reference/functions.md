# Functions (SQL and server)

> Index of every callable of Compasso: **SQL functions** (called through `supabase.rpc`), **server functions** (`createServerFn` in `*.functions.ts`) and **server routes**. For each: who may call it, what it writes (audit, notifications), which errors it raises. Implementation shape: base.md section 5.1 (server function) and 5.5 (SQL). Multi-step writes are SQL functions (transactions); server functions validate the input, check the action, call the RPC and validate the output. Names here are authoritative; add a row before writing the code (GOLD-4).
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
| `audit_write(p_org uuid, p_brand uuid, p_action text, p_entity_type text, p_entity_id uuid, p_metadata jsonb)` | void | single audit writer; validates `p_action` against the catalog |
| `notify_users(...)` / `resolve_notifications(p_ref_type text, p_ref_id uuid)` | void | single notification writer ([../foundations/notifications.md](../foundations/notifications.md)) |

All are `security definer` with a fixed `search_path`; `execute` is revoked from `anon` except where the public read functions below say otherwise.

## 2. Accounts, invitations, roles (module: authentication, roles-and-actions)

| SQL function | Server function | Act. | Audit / log | Errors |
|---|---|---|---|---|
| `invitation_create(p_email, p_role, p_grants jsonb, p_token_hash, p_expires_at)` | `createInvitation` (generates token, sends email) | `invitations.create` (+ role assignable) | `invitation.created` | `role_not_assignable`, `invalid_input` |
| `invitation_revoke(p_invitation)` | `revokeInvitation` | `invitations.create` | `invitation.revoked` | `not_found` |
| `accept_invitation(p_token_hash text)` | `acceptInvitation` (service role; creates the auth user) | none (token) | `invitation.accepted`; Notif. `invitation.accepted` | `invitation_invalid`, `invitation_email_mismatch` |
| `profile_set_access(p_profile, p_status, p_role)` | `setUserAccess` | `users.manage` / `users.approve` | `profile_audit` | `last_owner`, `self_change_forbidden`, `role_not_assignable` |
| `role_save(p_role jsonb)` / `role_delete(p_role)` | `saveRole`, `deleteRole` | `roles.manage` | `role_audit` | `role_system_protected`, `role_in_use`, `action_requires_read`, `portal_role_internal_action` |
| — | `getAuthState`, `signIn` (generic errors, no enumeration), `signOut`, `updateProfile` | approved | — | — |

### 2b. Organization, settings and audit access (module: organization-settings, audit)

| SQL function | Server function | Act. | Audit | Errors |
|---|---|---|---|---|
| `organization_save(p_organization jsonb)` | `saveOrganization` | `settings.manage` | `organization.updated` | `conflict`, `invalid_input` |
| `organization_setting_save(p_key text, p_value jsonb, p_expected_version int)` | `saveOrganizationSetting` | `settings.manage` | `settings.policy_changed` | `conflict`, `invalid_input` |
| `audit_list(p_filters jsonb, p_page int)` (RLS: action + brand scope) | `listAuditEvents` | `audit.view` | — | `denied` |
| — | `exportAudit` (CSV, row limit) | `audit.view` | `audit.exported` | `denied` |

## 3. Clients, brands, channels (module: clients, brands, channels)

| SQL function | Server function | Act. | Audit | Errors |
|---|---|---|---|---|
| `client_save(p_client jsonb, p_create_brand boolean)` | `saveClient` | `clients.create` / `clients.update` (+ `brands.create` when creating the first brand) | `client.created`, `client.updated`, `client.owner_changed` | `conflict`, `invalid_input` |
| `client_set_archived(p_client, p_archived, p_archive_brands boolean)` | `setClientArchived` | `clients.update` | `client.archived`, `client.reactivated` | `conflict` |
| `client_delete(p_client)` | `deleteClient` | `clients.delete` | `client.deleted` | `client_has_brands` |
| `client_contact_save(p_contact jsonb)` / `client_contact_delete(p_contact)` | `saveClientContact`, `deleteClientContact` | `clients.update` | `contact.created`, `contact.updated`, `contact.deleted` | `contact_email_invalid` |
| `brand_save(p_brand jsonb)` | `saveBrand` | `brands.create` / `brands.update` | `brand.created`, `brand.updated`, `brand.timezone_changed` | `brand_name_taken`, `conflict` |
| `brand_set_archived(p_brand, p_archived)` | `setBrandArchived` | `brands.update` | `brand.archived`, `brand.reactivated` | `conflict` |
| `brand_delete(p_brand)` | `deleteBrand` | `brands.delete` | `brand.deleted` | `brand_not_empty` |
| `brand_member_set(p_brand, p_user, p_kind, p_can_decide, p_status)` | `setBrandMember` | `brands.manage_members` | `brand.member_added`, `brand.member_revoked`, `brand.member_can_decide_changed` | `member_kind_mismatch`, `last_internal_member`, `approver_without_access` |
| `channel_save(p_channel jsonb)` | `saveChannel` | `channels.create` / `channels.update` | `channel.created`, `channel.updated` | `channel_duplicate`, `platform_change_forbidden`, `conflict` |
| `channel_set_archived(p_channel, p_archived)` | `setChannelArchived` | `channels.update` | `channel.archived`, `channel.reactivated` | — |
| `channel_delete(p_channel)` | `deleteChannel` | `channels.delete` | `channel.deleted` | `channel_in_use` |
| list/get via typed queries with RLS | `listClients`, `getClient`, `listBrands`, `getBrand`, `listChannels` | `*.view` | — | `not_found` |

## 4. Content and approvals (module: content, approvals)

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `content_item_save(p_item jsonb)` | `saveContentItem` | `content.create` / `content.update` | `content.created`, `content.updated` | — | `conflict` |
| `content_item_cancel(p_item, p_reason)` | `cancelContentItem` | `content.cancel` | `content.cancelled` | — | `reason_required` |
| `content_item_delete(p_item)` | `deleteContentItem` | `content.delete` | `content.deleted` | — | `in_use` |
| `content_variant_save(p_variant jsonb, p_expected_version int)` | `saveVariant` | `content.create` / `content.update` | `variant.created`, `variant.updated` | — | `conflict`, `channel_archived`, `channel_brand_mismatch` |
| `content_variant_move(p_variant, p_to_status, p_expected_version)` | `moveVariant` (board) | `content.update` | `variant.updated` | — | `transition_not_allowed`, `conflict` |
| `submit_for_approval(p_variant, p_approver, p_due_date, p_message, p_expected_version)` | `submitForApproval` | `content.submit` | `variant.submitted`, `approval.requested`, `approval.superseded` (when replacing) | `approval.requested`, `approval.superseded` | `conflict`, `media_not_available`, `approver_required`, `approver_without_access`, `channel_archived` |
| `reopen_variant(p_variant, p_reason)` | `reopenVariant` | `content.reopen` | `variant.reopened` | `approval.superseded` | `reason_required`, `transition_not_allowed` |
| `reschedule_variant(p_variant, p_planned_at, p_timezone, p_expected_version)` | `rescheduleVariant` | `calendar.manage` + `content.update` | `variant.rescheduled` | `approval.superseded` | `requires_new_revision`, `local_time_nonexistent`, `local_time_ambiguous`, `date_in_past`, `conflict` |
| `mark_published(p_variant, p_published_at, p_url, p_evidence_media_version, p_note)` | `markPublished` | `content.publish_manual` | `variant.published_manually` | — | `not_approved` |
| `content_variant_cancel(p_variant, p_reason)` | `cancelVariant` | `content.cancel` | `variant.cancelled` | — | `reason_required` |
| `comment_add(p_variant, p_visibility, p_body)` | `addComment` | `comments.create_internal` (internal) | `comment.created` | `comment.created` | `invalid_input` |
| `comment_delete(p_comment)` | `deleteComment` | author | `comment.deleted` | — | `denied` |
| `reassign_approver(p_request, p_new_approver)` | `reassignApprover` | `content.submit` | `approval.approver_reassigned` | `approval.requested`, `approval.superseded` | `approver_without_access`, `request_not_pending` |
| `cancel_request(p_request, p_reason)` | `cancelApprovalRequest` | `content.submit` | `approval.cancelled` | — | `reason_required`, `request_not_pending` |
| `send_approval_reminder(p_request)` | `remindApprover` | `content.submit` | `approval.reminder_sent` | `approval.requested` (reminder) | `request_not_pending` |
| typed queries | `listContentItems`, `getContentItem`, `getVariant`, `listApprovals`, `getApprovalRequest` | `content.view` / `approvals.view` | — | — | `not_found` |

## 5. Portal (module: portal) — the only functions external users can call

All: `security definer`, require `has_action('portal.view')` and an active external link; return explicit columns; outputs validated in the server function (`parseOutput`).

| SQL function | Server function | Extra requirement | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `portal_list_brands()` | `listPortalBrands` | — | — | — | — |
| `portal_list_pending(p_brand)` | `listPortalPending` | link to brand | — | — | `not_found` |
| `portal_get_approval(p_request)` | `getPortalApproval` | link to the request's brand; request shared with the person | — | — | `not_found` |
| `portal_record_view(p_request)` | `recordPortalView` | — | — | — | — |
| `portal_decide_approval(p_request, p_outcome, p_comment)` | `decidePortalApproval` | `approvals.decide`; designated approver; `can_decide` | `approval.decided` | `approval.decided` | `not_designated_approver`, `request_not_pending`, `revision_superseded`, `comment_required`, `approver_without_access` |
| `portal_list_comments(p_variant)` | `listPortalComments` | link | — | — | `not_found` |
| `portal_add_comment(p_variant, p_body)` | `addPortalComment` | `comments.create_external` | `comment.created` | `comment.created` | `invalid_input` |
| `portal_list_calendar(p_brand, p_from, p_to)` | `listPortalCalendar` | link; shared variants only | — | — | `invalid_input` |
| `portal_media_urls(p_revision, p_version_ids uuid[])` (checks, then the server signs) | `signPortalMedia` | revision shared with the person | — | — | `denied` |

## 6. Calendar and dashboard (modules: calendar, dashboard)

| SQL function | Server function | Act. | Notes |
|---|---|---|---|
| `list_calendar_entries(p_from, p_to, p_brands uuid[], p_channels uuid[], p_assignee uuid, p_editorial text[], p_publication text[])` | `listCalendarEntries` | `calendar.view` | max 100 days, paginated |
| `dashboard_attention(p_brands uuid[])` | `getAttention` | `content.view` / `approvals.view` | single definition of "needs attention" |
| `dashboard_upcoming(p_brands uuid[], p_days int)` | `getUpcoming` | `calendar.view` | |
| `dashboard_status_counts(p_brands uuid[])` | `getStatusCounts` | `content.view` | |
| `dashboard_my_items()` | `getMyItems` | `content.view` | |
| `dashboard_recent_activity(p_brands uuid[], p_limit int)` | `getRecentActivity` | `audit.view` or `approvals.view` | |

## 7. Media (module: media-library)

| SQL function | Server function / route | Act. | Audit | Errors |
|---|---|---|---|---|
| `media_request_upload(p_scope, p_brand, p_filename, p_size, p_mime, p_idempotency_key)` | `requestUpload` (then signs the PUT URLs) | `media.upload` (+ brand link) | — | `upload_too_large`, `upload_type_not_allowed`, `quota_exceeded` |
| `media_confirm_upload(p_version, p_checksum, p_width, p_height, p_duration)` | `confirmUpload` (stat → range read → validates → calls the RPC) | `media.upload` | — | `upload_size_mismatch`, `upload_content_mismatch`, `media_not_available` |
| `media_update(p_asset jsonb)` | `updateMedia` | `media.update` | — | `conflict` |
| `media_set_trashed(p_asset, p_trashed)` | `trashMedia` | `media.delete` | — | `media_in_use` (when archiving a used file is restricted) |
| `media_delete_permanently(p_asset)` | `deleteMediaPermanently` | `media.delete` | `media.deleted_permanently` | `media_in_use` |
| `media_replace_version(p_asset, p_version)` | `replaceMediaVersion` | `media.update` + `media.upload` | `media.version_replaced` | `conflict` |
| `media_publish_derivative(p_version)` | `publishMedia` | `media.publish` | `media.published` | `media_not_available` |
| `media_withdraw_derivative(p_version)` | `withdrawMedia` | `media.publish` | `media.unpublished` | `media_in_use` |
| `media_collection_save` / `media_collection_delete` / `media_collection_move_items` | `saveCollection`, `deleteCollection`, `moveToCollection` | `media.update` (delete: `media.delete`) | — | `invalid_input` |
| `media_storage_used()` | `getStorageUsed` | `media.view` | — | — |
| — | `signMediaUrls` (authorizes then signs) | `media.view` (+ brand link) or portal | — | `denied`, `storage_unavailable` |
| — | server route `/api/cron/media-cleanup` | `CRON_SECRET` | — | — |

## 8. Site and CMS (module: cms-site)

| SQL function | Server function | Act. | Audit | Notif. | Errors |
|---|---|---|---|---|---|
| `site_page_save(p_page jsonb, p_expected_version int)` | `saveSitePage` | `site.edit` (structure fields: `site.structure`) | — | — | `slug_taken`, `slug_reserved`, `conflict`, `page_system_protected` |
| `site_page_delete(p_page)` | `deleteSitePage` | `site.structure` | — | — | `page_system_protected` |
| `site_entry_save(p_entry jsonb)` / `site_entry_delete(p_entry)` | `saveSiteEntry`, `deleteSiteEntry` | `site.edit` | — | — | `conflict` |
| `site_settings_save(p_group text, p_value jsonb, p_expected_version int)` | `saveSiteSettings` | `site.settings` | `site.settings_changed` | — | `conflict`, `invalid_input` |
| `site_case_study_authorize(p_page, p_brand, p_consent_note)` | `authorizeCaseStudy` | `site.edit` + `brands.view` with link | `site.case_study_authorized` | — | `denied` |
| `site_case_study_withdraw(p_page)` | `withdrawCaseStudy` | `site.edit` | `site.case_study_withdrawn` | `site.published`-type warning (none) | — |
| `publish_site_page(p_page, p_note, p_live_from, p_expected_hash)` | `publishSitePage` | `site.publish` | `site.page_published` | `site.published` | `publish_checks_failed`, `draft_changed`, `nothing_to_publish`, `schedule_pending`, `media_not_published`, `case_study_not_authorized` |
| `unpublish_site_page(p_page)` | `unpublishSitePage` | `site.publish` | `site.page_unpublished` | — | `page_system_protected` |
| `site_rollback(p_page, p_revision)` | `rollbackSitePage` | `site.publish` | `site.rolled_back` | `site.published` | `schedule_pending` |
| `site_redirect_save(p_redirect jsonb)` / `site_redirect_delete(p_redirect)` | `saveRedirect`, `deleteRedirect` | `site.settings` | `site.settings_changed` | — | `redirect_invalid` |
| `site_contact_submit(p_site, p_payload jsonb)` (granted to `anon`) | `submitContactMessage` (rate limit + Turnstile + honeypot) | none (public) | — | `site.contact_message` | `contact_consent_required`, `rate_limited`, `invalid_input` |
| `site_contact_update(p_message, p_status, p_note)` | `updateContactMessage` | `site.view` | — | — | `not_found` |
| `site_published_page(p_slug)` (granted to `anon`) | `getPublicPage` | public | — | — | — |
| `site_published_settings()` (granted to `anon`) | `getPublicSettings` | public | — | — | — |
| `site_published_sitemap()` (granted to `anon`) | `getPublicSitemap` | public | — | — | — |
| `site_draft_snapshot(p_page)` | `getDraftSnapshot` (preview) | `site.view` | — | — | `not_found` |

## 9. Notifications and jobs (modules: notifications, audit)

| SQL function | Server function / route | Act. | Notes |
|---|---|---|---|
| `notify_users(p_kind, p_brand, p_title, p_body, p_link, p_ref_type, p_ref_id, p_dedupe_key, p_recipients uuid[])` | — (called by other functions) | — | single writer; checks recipients' action and brand scope |
| `resolve_notifications(p_ref_type, p_ref_id)` | — | — | |
| `notification_lead_days(p_user, p_kind)` | — | — | |
| `generate_due_notifications()` | `pg_cron` daily/hourly | — | discovers `notify_scan_*` |
| `notify_scan_approvals()`, `notify_scan_content()`, `notify_scan_invitations()`, `notify_scan_publications()` | — | — | one per module |
| `notifications_cleanup()` | `pg_cron` | — | 90-day cleanup |
| `audit_cleanup()` | `pg_cron` | — | retention policy |
| — | `listNotifications`, `markRead`, `markAllRead`, `snoozeNotification`, `savePreferences` | approved | |
| — | server route `/api/cron/email-outbox` | `CRON_SECRET` | sends `email_outbox` rows |

## 10. Rules

1. A server function calls **at most one** write RPC per user action (atomicity lives in SQL).
2. Every function that writes a business fact calls `audit_write` and, where listed, `notify_users` in the same transaction.
3. Public (`anon`) functions are exactly: `site_published_page`, `site_published_settings`, `site_published_sitemap`, `site_contact_submit`. Everything else revokes `anon`.
4. Portal functions are exactly the `portal_*` set of section 5. External roles call nothing else.
5. New function → new row here with action, audit, notification and errors; mirror in `check:consistency` where applicable.

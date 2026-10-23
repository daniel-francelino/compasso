import type { NestedValueOf } from "@/lib/shared/utils";

export const AuditAction = {
  Invitation: {
    Created: "invitation.created",
    Revoked: "invitation.revoked",
    Accepted: "invitation.accepted",
  },
  Client: {
    Created: "client.created",
    Updated: "client.updated",
    OwnerChanged: "client.owner_changed",
    Archived: "client.archived",
    Reactivated: "client.reactivated",
    Deleted: "client.deleted",
  },
  Contact: {
    Created: "contact.created",
    Updated: "contact.updated",
    Deleted: "contact.deleted",
  },
  Brand: {
    Created: "brand.created",
    Updated: "brand.updated",
    TimezoneChanged: "brand.timezone_changed",
    Archived: "brand.archived",
    Reactivated: "brand.reactivated",
    Deleted: "brand.deleted",
    MemberAdded: "brand.member_added",
    MemberRevoked: "brand.member_revoked",
    MemberCanDecideChanged: "brand.member_can_decide_changed",
  },
  Channel: {
    Created: "channel.created",
    Updated: "channel.updated",
    Archived: "channel.archived",
    Reactivated: "channel.reactivated",
    Deleted: "channel.deleted",
  },
  Content: {
    Created: "content.created",
    Updated: "content.updated",
    Submitted: "content.submitted",
    Reopened: "content.reopened",
    Cancelled: "content.cancelled",
    Published: "content.published",
    Deleted: "content.deleted",
  },
  ContentChannel: {
    Added: "content_channel.added",
    Removed: "content_channel.removed",
    Rescheduled: "content_channel.rescheduled",
    PublishedManually: "content_channel.published_manually",
    Cancelled: "content_channel.cancelled",
  },
  CalendarNote: {
    Created: "calendar_note.created",
    Updated: "calendar_note.updated",
    Archived: "calendar_note.archived",
    Converted: "calendar_note.converted",
  },
  Variant: {
    Created: "variant.created",
    Updated: "variant.updated",
    Submitted: "variant.submitted",
    Reopened: "variant.reopened",
    Rescheduled: "variant.rescheduled",
    Cancelled: "variant.cancelled",
    PublishedManually: "variant.published_manually",
  },
  Comment: {
    Created: "comment.created",
    Edited: "comment.edited",
    Deleted: "comment.deleted",
  },
  Approval: {
    Requested: "approval.requested",
    Decided: "approval.decided",
    Superseded: "approval.superseded",
    ApprovedByTeam: "approval.approved_by_team",
    Cancelled: "approval.cancelled",
    ApproverReassigned: "approval.approver_reassigned",
    ReminderSent: "approval.reminder_sent",
  },
  Media: {
    Published: "media.published",
    Unpublished: "media.unpublished",
    DeletedPermanently: "media.deleted_permanently",
    VersionReplaced: "media.version_replaced",
    ShareCreated: "media.share_created",
    ShareRevoked: "media.share_revoked",
  },
  Site: {
    PagePublished: "site.page_published",
    PageUnpublished: "site.page_unpublished",
    RolledBack: "site.rolled_back",
    CaseStudyAuthorized: "site.case_study_authorized",
    CaseStudyWithdrawn: "site.case_study_withdrawn",
    SettingsChanged: "site.settings_changed",
  },
  Settings: {
    PolicyChanged: "settings.policy_changed",
  },
  Organization: {
    Updated: "organization.updated",
  },
  Audit: {
    Exported: "audit.exported",
  },
} as const;

export type AuditActionKey = NestedValueOf<typeof AuditAction>;

export const AUDIT_ACTION_KEYS: readonly AuditActionKey[] = Object.values(AuditAction).flatMap(
  (domain) => Object.values(domain),
);

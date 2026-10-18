import type { ValueOf } from "@/lib/shared/utils";

export const ProfileStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
  Suspended: "suspended",
} as const;
export type ProfileStatus = ValueOf<typeof ProfileStatus>;

export const ProfileKind = {
  Internal: "internal",
  External: "external",
} as const;
export type ProfileKind = ValueOf<typeof ProfileKind>;

export const AuditActorKind = {
  Internal: "internal",
  External: "external",
  System: "system",
} as const;
export type AuditActorKind = ValueOf<typeof AuditActorKind>;

export const Space = {
  Marketing: "marketing",
  Cms: "cms",
  Site: "site",
  Portal: "portal",
  Shared: "shared",
} as const;
export type Space = ValueOf<typeof Space>;

export const InvitationStatus = {
  Pending: "pending",
  Accepted: "accepted",
  Revoked: "revoked",
  Expired: "expired",
} as const;
export type InvitationStatus = ValueOf<typeof InvitationStatus>;

export const BrandMemberStatus = {
  Active: "active",
  Revoked: "revoked",
} as const;
export type BrandMemberStatus = ValueOf<typeof BrandMemberStatus>;

export const Platform = {
  Instagram: "instagram",
  Facebook: "facebook",
  Linkedin: "linkedin",
  Tiktok: "tiktok",
  Youtube: "youtube",
  X: "x",
  Pinterest: "pinterest",
  Threads: "threads",
  Email: "email",
  Blog: "blog",
  Other: "other",
} as const;
export type Platform = ValueOf<typeof Platform>;

export const NotificationSeverity = {
  Info: "info",
  Warning: "warning",
  Urgent: "urgent",
} as const;
export type NotificationSeverity = ValueOf<typeof NotificationSeverity>;

export const NotificationStatus = {
  Active: "active",
  Resolved: "resolved",
} as const;
export type NotificationStatus = ValueOf<typeof NotificationStatus>;

export const EmailStatus = {
  Queued: "queued",
  Sent: "sent",
  Failed: "failed",
} as const;
export type EmailStatus = ValueOf<typeof EmailStatus>;

export const SettingKey = {
  Approvals: "policies.approvals",
  Calendar: "policies.calendar",
  Uploads: "policies.uploads",
  Urls: "policies.urls",
  Retention: "policies.retention",
  Invitations: "policies.invitations",
  Security: "policies.security",
  Email: "policies.email",
} as const;
export type SettingKey = ValueOf<typeof SettingKey>;

export const MediaScope = {
  Site: "site",
  Brand: "brand",
} as const;
export type MediaScope = ValueOf<typeof MediaScope>;

export const MediaVersionStatus = {
  Pending: "pending",
  Processing: "processing",
  Available: "available",
  Failed: "failed",
} as const;
export type MediaVersionStatus = ValueOf<typeof MediaVersionStatus>;

export const EditorialStatus = {
  Draft: "draft",
  InProduction: "in_production",
  InternalReview: "internal_review",
  AwaitingApproval: "awaiting_approval",
  ChangesRequested: "changes_requested",
  Approved: "approved",
  Cancelled: "cancelled",
} as const;
export type EditorialStatus = ValueOf<typeof EditorialStatus>;

export const PublicationStatus = {
  Unplanned: "unplanned",
  Planned: "planned",
  PublishedManually: "published_manually",
  Cancelled: "cancelled",
} as const;
export type PublicationStatus = ValueOf<typeof PublicationStatus>;

export const ContentFormat = {
  Image: "image",
  Carousel: "carousel",
  Video: "video",
  Text: "text",
  Story: "story",
  Reel: "reel",
  Article: "article",
  Other: "other",
} as const;
export type ContentFormat = ValueOf<typeof ContentFormat>;

export const ApprovalRequestStatus = {
  Pending: "pending",
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Superseded: "superseded",
  Cancelled: "cancelled",
} as const;
export type ApprovalRequestStatus = ValueOf<typeof ApprovalRequestStatus>;

export const ApprovalOutcome = {
  Approved: "approved",
  ChangesRequested: "changes_requested",
} as const;
export type ApprovalOutcome = ValueOf<typeof ApprovalOutcome>;

export const CommentVisibility = {
  Internal: "internal",
  External: "external",
} as const;
export type CommentVisibility = ValueOf<typeof CommentVisibility>;

export const DashboardReason = {
  ApprovalOverdue: "approval_overdue",
  ChangesRequested: "changes_requested",
  ProductionOverdue: "production_overdue",
  PlannedDatePassed: "planned_date_passed",
  ApproverWithoutAccess: "approver_without_access",
} as const;
export type DashboardReason = ValueOf<typeof DashboardReason>;

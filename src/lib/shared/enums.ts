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

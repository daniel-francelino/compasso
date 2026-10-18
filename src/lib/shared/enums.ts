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

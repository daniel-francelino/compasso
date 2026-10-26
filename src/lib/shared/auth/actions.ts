import type { NestedValueOf } from "@/lib/shared/utils";

export const Action = {
  Clients: {
    View: "clients.view",
    Create: "clients.create",
    Update: "clients.update",
    Delete: "clients.delete",
  },
  Brands: {
    View: "brands.view",
    Create: "brands.create",
    Update: "brands.update",
    Delete: "brands.delete",
    ManageMembers: "brands.manage_members",
  },
  Channels: {
    View: "channels.view",
    Create: "channels.create",
    Update: "channels.update",
    Delete: "channels.delete",
    Connect: "channels.connect",
  },
  Metrics: {
    View: "metrics.view",
    Report: "metrics.report",
    PortalView: "metrics.portal_view",
  },
  Content: {
    View: "content.view",
    Create: "content.create",
    Update: "content.update",
    Delete: "content.delete",
    Submit: "content.submit",
    Cancel: "content.cancel",
    Reopen: "content.reopen",
    PublishManual: "content.publish_manual",
  },
  Approvals: {
    View: "approvals.view",
    Decide: "approvals.decide",
    Override: "approvals.override",
  },
  Comments: {
    CreateInternal: "comments.create_internal",
    CreateExternal: "comments.create_external",
  },
  Portal: {
    View: "portal.view",
  },
  Calendar: {
    View: "calendar.view",
    Manage: "calendar.manage",
  },
  Media: {
    View: "media.view",
    Upload: "media.upload",
    Update: "media.update",
    Delete: "media.delete",
    Publish: "media.publish",
    Share: "media.share",
  },
  Site: {
    View: "site.view",
    Edit: "site.edit",
    Settings: "site.settings",
    Structure: "site.structure",
    Publish: "site.publish",
  },
  Notifications: {
    Configure: "notifications.configure",
  },
  Audit: {
    View: "audit.view",
  },
  Invitations: {
    Create: "invitations.create",
  },
  Users: {
    View: "users.view",
    Approve: "users.approve",
    Manage: "users.manage",
  },
  Roles: {
    Manage: "roles.manage",
  },
  Settings: {
    Manage: "settings.manage",
  },
} as const;

export type ActionKey = NestedValueOf<typeof Action>;

export const ACTION_KEYS: readonly ActionKey[] = Object.values(Action).flatMap((module) =>
  Object.values(module),
);

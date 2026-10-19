import type { ListRequest } from "@/lib/shared/list-search";

type Filters = Partial<ListRequest> & Record<string, unknown>;

export const QueryKey = {
  Auth: {
    state: () => ["auth", "state"] as const,
  },
  Users: {
    all: () => ["users"] as const,
    list: (filters: Filters) => ["users", "list", filters] as const,
    invitations: (filters: Filters) => ["users", "invitations", filters] as const,
  },
  Roles: {
    all: () => ["roles"] as const,
    list: () => ["roles", "list"] as const,
    detail: (id: string) => ["roles", "detail", id] as const,
    assignable: () => ["roles", "assignable"] as const,
  },
  Organization: {
    settings: () => ["organization", "settings"] as const,
  },
  Audit: {
    list: (filters: Filters) => ["audit", "list", filters] as const,
  },
  Clients: {
    all: () => ["clients"] as const,
    list: (filters: Filters) => ["clients", "list", filters] as const,
    detail: (id: string) => ["clients", "detail", id] as const,
    options: (search: string) => ["clients", "options", search] as const,
    owners: () => ["clients", "owners"] as const,
  },
  Brands: {
    all: () => ["brands"] as const,
    list: (filters: Filters) => ["brands", "list", filters] as const,
    detail: (id: string) => ["brands", "detail", id] as const,
    members: (id: string) => ["brands", "members", id] as const,
    candidates: (id: string, search: string) =>
      ["brands", "members", id, "candidates", search] as const,
    options: () => ["brands", "options"] as const,
  },
  Channels: {
    all: (brandId: string) => ["channels", brandId] as const,
    list: (brandId: string, filters: Filters) => ["channels", brandId, filters] as const,
  },
  Content: {
    all: () => ["content"] as const,
    list: (filters: Filters) => ["content", "list", filters] as const,
    board: (filters: Filters) => ["content", "board", filters] as const,
    item: (id: string) => ["content", "item", id] as const,
    comments: (itemId: string) => ["content", "comments", itemId] as const,
    approvers: (brandId: string) => ["content", "approvers", brandId] as const,
    assignees: (brandId: string) => ["content", "assignees", brandId] as const,
  },
  Approvals: {
    all: () => ["approvals"] as const,
    list: (filters: Filters) => ["approvals", "list", filters] as const,
    detail: (id: string) => ["approvals", "detail", id] as const,
  },
  Portal: {
    all: () => ["portal"] as const,
    brands: () => ["portal", "brands"] as const,
    brand: (brandId: string) => ["portal", "brand", brandId] as const,
    pending: (brandId: string) => ["portal", "pending", brandId] as const,
    approvals: (brandId: string, filters: Filters) =>
      ["portal", "approvals", brandId, filters] as const,
    approval: (id: string) => ["portal", "approval", id] as const,
    comments: (itemId: string) => ["portal", "comments", itemId] as const,
    calendar: (brandId: string, filters: Filters) =>
      ["portal", "calendar", brandId, filters] as const,
    urls: (revisionId: string, variant: string, versionIds: readonly string[]) =>
      ["portal", "urls", revisionId, variant, versionIds] as const,
  },
  Calendar: {
    all: () => ["calendar"] as const,
    entries: (filters: Filters) => ["calendar", "entries", filters] as const,
    zone: () => ["calendar", "zone"] as const,
    note: (id: string) => ["calendar", "note", id] as const,
  },
  Site: {
    all: () => ["site"] as const,
    overview: () => ["site", "overview"] as const,
    pages: () => ["site", "pages"] as const,
    pageOptions: () => ["site", "page-options"] as const,
    page: (id: string) => ["site", "page", id] as const,
    preview: (id: string) => ["site", "preview", id] as const,
    check: (id: string) => ["site", "check", id] as const,
    revisions: (id: string) => ["site", "revisions", id] as const,
    entries: (kind: string) => ["site", "entries", kind] as const,
    settings: () => ["site", "settings"] as const,
    redirects: () => ["site", "redirects"] as const,
    messages: (filters: Filters) => ["site", "messages", filters] as const,
    authorization: (id: string) => ["site", "authorization", id] as const,
  },
  Dashboard: {
    all: () => ["dashboard"] as const,
    attention: (brand: string | undefined) => ["dashboard", "attention", brand ?? null] as const,
    pending: (brand: string | undefined) => ["dashboard", "pending", brand ?? null] as const,
    counts: (brand: string | undefined) => ["dashboard", "counts", brand ?? null] as const,
    mine: () => ["dashboard", "mine"] as const,
  },
  Share: {
    all: () => ["share"] as const,
    open: (token: string, grant: string | null) => ["share", "open", token, grant] as const,
  },
  Media: {
    all: () => ["media"] as const,
    list: (filters: Filters) => ["media", "list", filters] as const,
    detail: (id: string) => ["media", "detail", id] as const,
    collections: (scope: string, brandId: string | undefined) =>
      ["media", "collections", scope, brandId ?? null] as const,
    storage: () => ["media", "storage"] as const,
    check: () => ["media", "check"] as const,
    shares: (kind: string, targetId: string) => ["media", "shares", kind, targetId] as const,
    shareTargets: () => ["media", "shares", "targets"] as const,
    signed: (versionIds: readonly string[], variant: string) =>
      ["media", "signed", versionIds, variant] as const,
  },
  Notifications: {
    all: () => ["notifications"] as const,
    list: (filters: Filters) => ["notifications", "list", filters] as const,
    unread: () => ["notifications", "unread"] as const,
    preferences: () => ["notifications", "preferences"] as const,
    defaults: () => ["notifications", "defaults"] as const,
  },
} as const;

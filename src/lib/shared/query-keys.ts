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
    detail: () => ["organization"] as const,
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
  Media: {
    all: () => ["media"] as const,
    list: (filters: Filters) => ["media", "list", filters] as const,
    detail: (id: string) => ["media", "detail", id] as const,
    collections: (scope: string, brandId: string | undefined) =>
      ["media", "collections", scope, brandId ?? null] as const,
    storage: () => ["media", "storage"] as const,
    check: () => ["media", "check"] as const,
  },
  Notifications: {
    all: () => ["notifications"] as const,
    list: (filters: Filters) => ["notifications", "list", filters] as const,
    unread: () => ["notifications", "unread"] as const,
    preferences: () => ["notifications", "preferences"] as const,
    defaults: () => ["notifications", "defaults"] as const,
  },
} as const;

export const QueryKey = {
  Auth: {
    state: () => ["auth", "state"] as const,
  },
} as const;

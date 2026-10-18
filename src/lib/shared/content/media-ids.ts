const MEDIA_ID =
  /"(?:mediaVersionId|ogImage)":"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g;

export const mediaIdsIn = (...values: unknown[]): string[] => {
  const ids = new Set<string>();
  for (const value of values) {
    for (const match of JSON.stringify(value ?? null).matchAll(MEDIA_ID)) {
      if (match[1] !== undefined) ids.add(match[1]);
    }
  }
  return [...ids];
};

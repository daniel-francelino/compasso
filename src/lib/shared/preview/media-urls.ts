export const mediaUnavailable = (
  urls: Record<string, string> | undefined,
  versionId: string,
): boolean => urls !== undefined && urls[versionId] === undefined;

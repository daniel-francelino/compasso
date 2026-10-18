export const PUBLIC_SMALL = 400;
export const PUBLIC_LARGE = 1600;

const prefixOf = (checksum: string): string => checksum.slice(0, 32);

export const publicKeys = (checksum: string): { small: string; large: string } => ({
  small: `site/${prefixOf(checksum)}-${PUBLIC_SMALL}.webp`,
  large: `site/${prefixOf(checksum)}-${PUBLIC_LARGE}.webp`,
});

export const publicUrls = (checksum: string, baseUrl: string): { small: string; large: string } => {
  const keys = publicKeys(checksum);
  const base = baseUrl.replace(/\/+$/, "");
  return { small: `${base}/${keys.small}`, large: `${base}/${keys.large}` };
};

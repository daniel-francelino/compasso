const staticPath = /^assets\/|\.[a-z0-9]{1,8}$/i;

export const isStaticAssetPath = (slug: string): boolean => staticPath.test(slug);

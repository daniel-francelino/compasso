export const createRateLimiter = (maxPerWindow: number, windowMs: number) => {
  const attempts = new Map<string, number[]>();
  return (key: string, now: number = Date.now()): boolean => {
    const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= maxPerWindow) {
      attempts.set(key, recent);
      return false;
    }
    attempts.set(key, [...recent, now]);
    return true;
  };
};

import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;
const SEPARATOR = ".";

export type OAuthState = { channelId: string; userId: string };

const signature = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const signState = (state: OAuthState, secret: string, now: number = Date.now()): string => {
  const payload = [state.channelId, state.userId, String(now + STATE_TTL_MS)].join(SEPARATOR);
  return `${Buffer.from(payload).toString("base64url")}${SEPARATOR}${signature(payload, secret)}`;
};

export const verifyState = (
  value: string,
  secret: string,
  now: number = Date.now(),
): OAuthState | null => {
  const [encoded, received] = value.split(SEPARATOR);
  if (encoded === undefined || received === undefined) return null;
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(received);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const [channelId, userId, expiresAt] = payload.split(SEPARATOR);
  if (channelId === undefined || userId === undefined || Number(expiresAt) < now) return null;
  return { channelId, userId };
};

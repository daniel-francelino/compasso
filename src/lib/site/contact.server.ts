import { logError } from "@/lib/shared/logger";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const attempts = new Map<string, number[]>();

export const withinRateLimit = (key: string, now: number = Date.now()): boolean => {
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    attempts.set(key, recent);
    return false;
  }
  attempts.set(key, [...recent, now]);
  return true;
};

export const turnstileConfigured = (): boolean =>
  (process.env["TURNSTILE_SECRET"] ?? "") !== "" &&
  (process.env["VITE_TURNSTILE_SITE_KEY"] ?? "") !== "";

export const turnstileSiteKey = (): string | null => {
  const key = process.env["VITE_TURNSTILE_SITE_KEY"] ?? "";
  return key === "" ? null : key;
};

export type TurnstileOutcome = "passed" | "failed" | "unavailable";

export const verifyTurnstile = async (token: string, ip: string): Promise<TurnstileOutcome> => {
  const secret = process.env["TURNSTILE_SECRET"] ?? "";
  if (secret === "") return "unavailable";
  if (token === "") return "failed";
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "") body.set("remoteip", ip);
    const response = await fetch(VERIFY_URL, { method: "POST", body });
    if (!response.ok) return "unavailable";
    const result = (await response.json()) as { success?: boolean };
    return result.success === true ? "passed" : "failed";
  } catch (error) {
    logError("site: the anti-bot check could not be reached", error);
    return "unavailable";
  }
};

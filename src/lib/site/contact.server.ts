import { logError } from "@/lib/shared/logger";
import { createRateLimiter } from "@/lib/shared/rate-limit.server";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const withinRateLimit = createRateLimiter(5, 10 * 60 * 1000);

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

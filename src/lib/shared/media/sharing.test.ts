import { describe, expect, it } from "vitest";
import { ShareKind } from "@/lib/shared/enums";
import { createShareSchema, openSharedSchema, shareTokenSchema } from "@/lib/shared/media/schemas";
import { createRateLimiter } from "@/lib/shared/rate-limit.server";

const base = {
  kind: ShareKind.Asset,
  targetId: "00000000-0000-0000-0000-000000000001",
  label: "Foto do cliente",
  expiresAt: null,
  maxDownloads: null,
  allowDownload: true,
};

describe("share schemas", () => {
  it("accepts a minimal link and trims the name", () => {
    const parsed = createShareSchema.parse({ ...base, label: "  Foto  " });
    expect(parsed.label).toBe("Foto");
  });

  it("refuses an empty name, a short password and a download limit of zero", () => {
    expect(createShareSchema.safeParse({ ...base, label: " " }).success).toBe(false);
    expect(createShareSchema.safeParse({ ...base, password: "curta" }).success).toBe(false);
    expect(createShareSchema.safeParse({ ...base, maxDownloads: 0 }).success).toBe(false);
    expect(createShareSchema.safeParse({ ...base, maxDownloads: 10001 }).success).toBe(false);
  });

  it("only takes secrets of 64 hexadecimal characters", () => {
    const secret = "a".repeat(64);
    expect(shareTokenSchema.safeParse(secret).success).toBe(true);
    expect(shareTokenSchema.safeParse("a".repeat(63)).success).toBe(false);
    expect(shareTokenSchema.safeParse(`${"a".repeat(63)}z`).success).toBe(false);
    expect(openSharedSchema.safeParse({ token: secret, grant: null }).success).toBe(true);
    expect(openSharedSchema.safeParse({ token: secret, grant: "short" }).success).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows the configured attempts per window and then refuses until it passes", () => {
    const allow = createRateLimiter(3, 1000);
    expect([1, 2, 3].map((n) => allow("ip", n))).toEqual([true, true, true]);
    expect(allow("ip", 4)).toBe(false);
    expect(allow("other", 4)).toBe(true);
    expect(allow("ip", 1500)).toBe(true);
  });
});

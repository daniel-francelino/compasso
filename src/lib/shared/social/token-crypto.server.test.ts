import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/shared/social/token-crypto.server";

const key = randomBytes(32).toString("base64");

describe("token crypto", () => {
  it("round-trips a token", () => {
    const stored = encryptToken("IGAAtoken123", key);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("IGAAtoken123");
    expect(decryptToken(stored ?? "", key)).toBe("IGAAtoken123");
  });

  it("uses a new nonce each time", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("refuses a wrong key", () => {
    const stored = encryptToken("secret", key) ?? "";
    expect(decryptToken(stored, randomBytes(32).toString("base64"))).toBeNull();
  });

  it("refuses a tampered payload", () => {
    const stored = encryptToken("secret", key) ?? "";
    const parts = stored.split(":");
    const payload = Buffer.from(parts[2] ?? "", "base64");
    payload[0] = (payload[0] ?? 0) ^ 1;
    const tampered = [parts[0], parts[1], payload.toString("base64")].join(":");
    expect(decryptToken(tampered, key)).toBeNull();
  });

  it("refuses a key that is not 32 bytes", () => {
    expect(encryptToken("secret", Buffer.from("short").toString("base64"))).toBeNull();
  });

  it("refuses text that is not a stored token", () => {
    expect(decryptToken("plain", key)).toBeNull();
    expect(decryptToken("v2:a:b", key)).toBeNull();
  });
});

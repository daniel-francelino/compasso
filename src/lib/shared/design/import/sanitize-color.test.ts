import { describe, expect, it } from "vitest";
import { sanitizeColorName } from "@/lib/shared/design/import/sanitize";

describe("sanitizeColorName", () => {
  it("cuts by code points and then keeps the UTF-16 length within 40", () => {
    const emoji = String.fromCodePoint(0x1f600);
    const cut = sanitizeColorName(emoji.repeat(100));
    expect(cut.length).toBeGreaterThan(0);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(Array.from(cut)).toHaveLength(20);
    expect(Array.from(cut).every((point) => point === emoji)).toBe(true);
  });

  it("removes line breaks and control characters", () => {
    expect(sanitizeColorName(`a${String.fromCharCode(10)}b${String.fromCharCode(7)}c`)).toBe("abc");
  });
});

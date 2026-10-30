import { describe, expect, it } from "vitest";
import { stableJson } from "@/lib/shared/stable-json";

describe("stableJson", () => {
  it("ignores the order of the keys at any depth", () => {
    expect(stableJson({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe(
      stableJson({ a: { c: [{ x: 2, y: 1 }], d: 2 }, b: 1 }),
    );
  });

  it("keeps the order of the arrays and tells values apart", () => {
    expect(stableJson([1, 2])).not.toBe(stableJson([2, 1]));
    expect(stableJson({ a: null })).not.toBe(stableJson({ a: 0 }));
  });
});

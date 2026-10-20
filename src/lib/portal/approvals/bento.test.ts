import { describe, expect, it } from "vitest";
import {
  columnCountFor,
  columnWidthFor,
  packBento,
  parseRatio,
} from "@/lib/portal/approvals/bento";

describe("bento layout", () => {
  it("reads a ratio and falls back to square", () => {
    expect(parseRatio("4 / 5")).toBeCloseTo(0.8);
    expect(parseRatio("16 / 9")).toBeCloseTo(16 / 9);
    expect(parseRatio("nope")).toBe(1);
  });

  it("chooses the column count from the width", () => {
    expect(columnCountFor(0)).toBe(1);
    expect(columnCountFor(360)).toBe(1);
    expect(columnCountFor(720)).toBe(2);
    expect(columnCountFor(1400)).toBe(3);
    expect(columnWidthFor(720, 2)).toBeCloseTo(354);
  });

  it("places each item in the shortest column and keeps the order inside a column", () => {
    const heights: Record<string, number> = { a: 500, b: 100, c: 100, d: 100, e: 100 };
    const lanes = packBento(["a", "b", "c", "d", "e"], 2, (item) => heights[item] ?? 0);
    expect(lanes).toEqual([["a"], ["b", "c", "d", "e"]]);
  });

  it("uses one column when asked for none", () => {
    expect(packBento([1, 2, 3], 0, () => 10)).toEqual([[1, 2, 3]]);
  });
});

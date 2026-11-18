import { describe, expect, it } from "vitest";
import { collapseHistory, historyOf, pushHistory } from "@/lib/shared/design/history";

describe("collapseHistory", () => {
  it("turns many steps after a base into one", () => {
    const base = pushHistory(historyOf(1), 2, 100);
    let live = pushHistory(base, 3, 100);
    live = pushHistory(live, 4, 100);
    const merged = collapseHistory(live, base, 100);
    expect(merged.past).toEqual([1, 2]);
    expect(merged.present).toBe(4);
    expect(merged.future).toEqual([]);
  });

  it("returns the base when nothing changed", () => {
    const base = historyOf(1);
    expect(collapseHistory(base, base, 100)).toBe(base);
  });

  it("respects the history limit", () => {
    const base = pushHistory(pushHistory(historyOf(1), 2, 100), 3, 100);
    const merged = collapseHistory(pushHistory(base, 4, 100), base, 2);
    expect(merged.past).toEqual([2, 3]);
  });
});

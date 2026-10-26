import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  eachDay,
  endOfMonth,
  startOfMonth,
  todayIn,
} from "@/lib/shared/metrics/days";

describe("days", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("counts the days between two dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-10-05", "2026-10-01")).toBe(-4);
  });

  it("lists every day of a range, both ends included", () => {
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(eachDay("2026-10-02", "2026-10-01")).toEqual([]);
  });

  it("finds the first and last day of a month", () => {
    expect(startOfMonth("2026-10-17")).toBe("2026-10-01");
    expect(endOfMonth("2026-10-17")).toBe("2026-10-31");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("reads today in the zone of the brand", () => {
    const instant = new Date("2026-10-27T01:30:00Z");
    expect(todayIn("America/Sao_Paulo", instant)).toBe("2026-10-26");
    expect(todayIn("UTC", instant)).toBe("2026-10-27");
  });
});

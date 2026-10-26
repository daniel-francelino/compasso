import { describe, expect, it } from "vitest";
import { PeriodPreset, isFullMonth, periodLabel, presetRange } from "@/lib/shared/metrics/period";

describe("presetRange", () => {
  it("ends yesterday for the rolling presets", () => {
    expect(presetRange(PeriodPreset.Last7, "2026-10-26")).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
    });
    expect(presetRange(PeriodPreset.Last30, "2026-10-26")).toEqual({
      from: "2026-09-26",
      to: "2026-10-25",
    });
  });

  it("covers the current month up to today", () => {
    expect(presetRange(PeriodPreset.ThisMonth, "2026-10-26")).toEqual({
      from: "2026-10-01",
      to: "2026-10-26",
    });
  });

  it("covers the whole previous month, including across years", () => {
    expect(presetRange(PeriodPreset.LastMonth, "2026-10-26")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(presetRange(PeriodPreset.LastMonth, "2026-01-05")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("has no range for a free period", () => {
    expect(presetRange(PeriodPreset.Custom, "2026-10-26")).toBeNull();
  });
});

describe("periodLabel", () => {
  it("names a full month", () => {
    expect(isFullMonth({ from: "2026-10-01", to: "2026-10-31" })).toBe(true);
    expect(periodLabel({ from: "2026-10-01", to: "2026-10-31" })).toBe("Em outubro de 2026");
  });

  it("gives the two dates for any other range", () => {
    expect(isFullMonth({ from: "2026-10-01", to: "2026-10-30" })).toBe(false);
    expect(periodLabel({ from: "2026-10-05", to: "2026-10-20" })).toBe(
      "Entre 05/10/2026 e 20/10/2026",
    );
  });
});

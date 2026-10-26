import { describe, expect, it } from "vitest";
import {
  addDaysToDate,
  formatBytes,
  formatDate,
  formatDateOnly,
  formatInZone,
  formatCompact,
  formatNumber,
  formatPercent,
  instantToLocalInput,
  localInputToInstant,
  todayInZone,
} from "@/lib/shared/format";

describe("formatDate", () => {
  it("formats in pt-BR in the given time zone", () => {
    expect(formatDate("2026-03-01T01:30:00Z", "America/Sao_Paulo")).toBe("28/02/2026");
    expect(formatDate("2026-03-01T01:30:00Z", "UTC")).toBe("01/03/2026");
  });
});

describe("formatDateOnly", () => {
  it("does not shift a date-only value by time zone", () => {
    expect(formatDateOnly("2026-10-18")).toBe("18/10/2026");
  });

  it("returns an unexpected value untouched", () => {
    expect(formatDateOnly("soon")).toBe("soon");
  });
});

describe("formatInZone", () => {
  it("formats the instant in the requested zone without appending an offset by default", () => {
    const text = formatInZone("2026-07-01T15:00:00Z", "America/Sao_Paulo");
    expect(text).toContain("01/07/2026");
    expect(text).toContain("12:00");
    expect(text).not.toMatch(/GMT|UTC|BRT/);
  });

  it("can include the zone when an offset distinguishes repeated local times", () => {
    const text = formatInZone("2026-07-01T15:00:00Z", "America/Sao_Paulo", {
      includeZone: true,
    });
    expect(text).toMatch(/GMT-3|BRT/);
  });

  it("follows daylight saving of the zone", () => {
    const winter = formatInZone("2026-01-15T12:00:00Z", "America/New_York");
    const summer = formatInZone("2026-07-15T12:00:00Z", "America/New_York");
    expect(winter).toContain("07:00");
    expect(summer).toContain("08:00");
  });
});

describe("formatCompact and formatPercent", () => {
  it("shortens large numbers in pt-BR", () => {
    expect(formatCompact(1500).replaceAll(String.fromCharCode(160), " ")).toBe("1,5 mil");
    expect(formatCompact(950)).toBe("950");
  });

  it("formats a ratio as a percent", () => {
    expect(formatPercent(0.1834)).toBe("18%");
    expect(formatPercent(0.1834, 1)).toBe("18,3%");
  });
});

describe("formatNumber and formatBytes", () => {
  it("uses the pt-BR separators", () => {
    expect(formatNumber(1234.5, 1)).toBe("1.234,5");
  });

  it("scales bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
  });
});

describe("zone-aware local time", () => {
  it("converts a local input to the right instant and back", () => {
    const instant = localInputToInstant("2026-07-01T10:00", "America/Sao_Paulo");
    expect(instant?.toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(instantToLocalInput(instant ?? new Date(), "America/Sao_Paulo")).toBe(
      "2026-07-01T10:00",
    );
  });

  it("follows daylight saving time", () => {
    expect(localInputToInstant("2026-01-15T09:00", "America/New_York")?.toISOString()).toBe(
      "2026-01-15T14:00:00.000Z",
    );
    expect(localInputToInstant("2026-07-15T09:00", "America/New_York")?.toISOString()).toBe(
      "2026-07-15T13:00:00.000Z",
    );
  });

  it("refuses a time that does not exist", () => {
    expect(localInputToInstant("2026-03-08T02:30", "America/New_York")).toBeNull();
  });

  it("refuses malformed input", () => {
    expect(localInputToInstant("tomorrow", "UTC")).toBeNull();
  });

  it("reads today's date in a zone", () => {
    expect(todayInZone("America/Sao_Paulo", new Date("2026-03-01T01:30:00Z"))).toBe("2026-02-28");
    expect(todayInZone("UTC", new Date("2026-03-01T01:30:00Z"))).toBe("2026-03-01");
  });
});

describe("addDaysToDate", () => {
  it("moves a date-only value across months without time zone shifts", () => {
    expect(addDaysToDate("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDaysToDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});

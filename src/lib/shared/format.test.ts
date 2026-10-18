import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatDate,
  formatDateOnly,
  formatInZone,
  formatNumber,
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
  it("shows the time and the zone", () => {
    const text = formatInZone("2026-07-01T15:00:00Z", "America/Sao_Paulo");
    expect(text).toContain("01/07/2026");
    expect(text).toContain("12:00");
    expect(text).toMatch(/GMT-3|BRT/);
  });

  it("follows daylight saving of the zone", () => {
    const winter = formatInZone("2026-01-15T12:00:00Z", "America/New_York");
    const summer = formatInZone("2026-07-15T12:00:00Z", "America/New_York");
    expect(winter).toContain("07:00");
    expect(summer).toContain("08:00");
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

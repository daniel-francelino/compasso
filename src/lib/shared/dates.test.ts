import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  addDaysToDate,
  addMonthsToDate,
  daysBetweenDates,
  eachDate,
  endOfMonthDate,
  instantToLocalInput,
  isOlderThan,
  localInputOccurrences,
  localInputToInstant,
  parseDateOnly,
  parseDateValue,
  parseInstant,
  plusDays,
  plusMinutes,
  startOfDayInstant,
  startOfMonthDate,
  startOfWeekDate,
  toDateValue,
  todayInZone,
  tomorrowAtHour,
  weekdayIndex,
} from "@/lib/shared/dates";

describe("date-only values", () => {
  it("adds days across month and year ends", () => {
    expect(addDaysToDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToDate("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("adds months from the first day", () => {
    expect(addMonthsToDate("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonthsToDate("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("returns an unexpected value untouched", () => {
    expect(addDaysToDate("soon", 1)).toBe("soon");
    expect(parseDateOnly("2026-02-31")).toBeNull();
  });

  it("counts the days between two dates", () => {
    expect(daysBetweenDates("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetweenDates("2026-10-05", "2026-10-01")).toBe(-4);
  });

  it("lists every day of a range, both ends included", () => {
    expect(eachDate("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(eachDate("2026-10-02", "2026-10-01")).toEqual([]);
  });

  it("finds the first and last day of a month", () => {
    expect(startOfMonthDate("2026-10-17")).toBe("2026-10-01");
    expect(endOfMonthDate("2026-10-17")).toBe("2026-10-31");
    expect(endOfMonthDate("2028-02-10")).toBe("2028-02-29");
  });

  it("finds the week start and the weekday", () => {
    expect(weekdayIndex("2026-10-26")).toBe(1);
    expect(startOfWeekDate("2026-10-28", true)).toBe("2026-10-26");
    expect(startOfWeekDate("2026-10-28", false)).toBe("2026-10-25");
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

  it("lists both instants of a repeated local time", () => {
    const found = localInputOccurrences("2026-11-01T01:30", "America/New_York");
    expect(found.map((date) => date.toISOString())).toEqual([
      "2026-11-01T05:30:00.000Z",
      "2026-11-01T06:30:00.000Z",
    ]);
  });

  it("refuses malformed input", () => {
    expect(localInputToInstant("tomorrow", "UTC")).toBeNull();
    expect(localInputOccurrences("tomorrow", "UTC")).toEqual([]);
  });

  it("reads today's date in a zone", () => {
    const instant = new Date("2026-10-27T01:30:00Z");
    expect(todayInZone("America/Sao_Paulo", instant)).toBe("2026-10-26");
    expect(todayInZone("UTC", instant)).toBe("2026-10-27");
  });

  it("finds the start of a day in a zone", () => {
    expect(startOfDayInstant("2026-10-26", "America/Sao_Paulo").toISOString()).toBe(
      "2026-10-26T03:00:00.000Z",
    );
  });

  it("finds tomorrow at a given hour in a zone", () => {
    const next = tomorrowAtHour(9, "UTC");
    expect(next.getUTCHours()).toBe(9);
    expect(next.getTime()).toBeGreaterThan(Date.now());
    expect(next.getTime() - Date.now()).toBeLessThanOrEqual(2 * DAY_MS);
  });
});

describe("instants", () => {
  it("adds days and minutes", () => {
    const start = new Date("2026-10-26T12:00:00Z");
    expect(plusDays(start, 2).toISOString()).toBe("2026-10-28T12:00:00.000Z");
    expect(plusMinutes(start, 90).toISOString()).toBe("2026-10-26T13:30:00.000Z");
  });

  it("parses only valid instants", () => {
    expect(parseInstant("2026-10-26T12:00:00Z")?.toISOString()).toBe("2026-10-26T12:00:00.000Z");
    expect(parseInstant("nonsense")).toBeNull();
  });

  it("tells whether an instant is older than a span", () => {
    expect(isOlderThan(new Date(Date.now() - 5000), 1000)).toBe(true);
    expect(isOlderThan(new Date(Date.now() - 500), 60_000)).toBe(false);
  });
});

describe("picker values", () => {
  it("round-trips a date value through a local date", () => {
    const parsed = parseDateValue("2026-10-26");
    expect(parsed?.getHours()).toBe(0);
    expect(parsed === undefined ? "" : toDateValue(parsed)).toBe("2026-10-26");
  });

  it("refuses malformed or impossible values", () => {
    expect(parseDateValue("26/10/2026")).toBeUndefined();
    expect(parseDateValue("2026-02-31")).toBeUndefined();
  });
});

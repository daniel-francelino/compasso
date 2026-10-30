import { describe, expect, it } from "vitest";
import {
  MAX_PER_CHANNEL_PER_DAY,
  MIN_MINUTES_BETWEEN,
  calendarAlerts,
} from "@/lib/shared/calendar/alerts";
import { entryDay, entryKey, entryTimeLabel, groupByDay } from "@/lib/shared/calendar/entries";
import { rangeInstants, rangeTitle, shiftAnchor, visibleRange } from "@/lib/shared/calendar/range";
import { LocalTimeProblem, moveToDay, resolveLocalTime } from "@/lib/shared/calendar/reschedule";
import type { CalendarEntry } from "@/lib/shared/calendar/types";
import {
  CalendarAlert,
  CalendarEntryKind,
  CalendarView,
  ContentFormat,
  EditorialStatus,
  Platform,
  PublicationStatus,
} from "@/lib/shared/enums";

const entry = (patch: Partial<CalendarEntry> = {}): CalendarEntry => ({
  kind: CalendarEntryKind.Publication,
  itemId: "item-1",
  channelRowId: "row-1",
  noteId: null,
  description: null,
  repeat: null,
  convertedItemId: null,
  eventType: null,
  allDay: true,
  endDate: null,
  startsAt: null,
  endsAt: null,
  timezone: null,
  location: null,
  clientVisible: false,
  internalNotes: null,
  noteVersion: null,
  requestId: null,
  title: "Lançamento",
  brandId: "brand-1",
  brandName: "Café Aurora",
  brandTimezone: "America/Sao_Paulo",
  channelId: "channel-1",
  platform: Platform.Instagram,
  profileName: "aurora.cafe",
  format: ContentFormat.Image,
  editorialStatus: EditorialStatus.Approved,
  publicationStatus: PublicationStatus.Planned,
  plannedTimezone: "America/Sao_Paulo",
  at: "2026-10-20T13:00:00Z",
  date: null,
  version: 1,
  itemVersion: 1,
  assigneeName: null,
  channelArchived: false,
  ...patch,
});

describe("visibleRange", () => {
  it("starts the week on Monday by default and on Sunday when asked", () => {
    const monday = visibleRange(CalendarView.Week, "2026-10-18");
    expect([monday.start, monday.end, monday.days.length]).toEqual(["2026-10-12", "2026-10-19", 7]);
    const sunday = visibleRange(CalendarView.Week, "2026-10-18", false);
    expect([sunday.start, sunday.end]).toEqual(["2026-10-18", "2026-10-25"]);
  });

  it("covers whole weeks around the month", () => {
    const month = visibleRange(CalendarView.Month, "2026-10-18");
    expect([month.start, month.end, month.days.length]).toEqual(["2026-09-28", "2026-11-02", 35]);
    expect(month.days.length).toBeLessThanOrEqual(42);
  });

  it("never exceeds the 100 days the database accepts", () => {
    for (const month of ["2026-02-10", "2026-03-10", "2026-08-31"]) {
      expect(visibleRange(CalendarView.Month, month).days.length).toBeLessThanOrEqual(42);
    }
  });
});

describe("shiftAnchor", () => {
  it("moves by week or by month", () => {
    expect(shiftAnchor(CalendarView.Week, "2026-10-18", 1)).toBe("2026-10-25");
    expect(shiftAnchor(CalendarView.Month, "2026-10-18", 1)).toBe("2026-11-01");
    expect(shiftAnchor(CalendarView.Month, "2026-01-31", -1)).toBe("2025-12-01");
  });
});

describe("rangeInstants", () => {
  it("asks for the visible days plus one day of margin on each side", () => {
    const range = visibleRange(CalendarView.Week, "2026-10-18");
    const { from, to } = rangeInstants(range, "America/Sao_Paulo");
    expect(from.toISOString()).toBe("2026-10-11T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-20T03:00:00.000Z");
  });

  it("stays valid when the first day starts at a daylight-saving gap", () => {
    const range = visibleRange(CalendarView.Week, "2026-03-29");
    const { from, to } = rangeInstants(range, "Europe/Lisbon");
    expect(to.getTime()).toBeGreaterThan(from.getTime());
    expect(to.getTime() - from.getTime()).toBeLessThanOrEqual(100 * 86400000);
  });
});

describe("rangeTitle", () => {
  it("names the month or the week", () => {
    expect(
      rangeTitle(CalendarView.Month, visibleRange(CalendarView.Month, "2026-10-18"), "2026-10-18"),
    ).toBe("outubro de 2026");
    const week = rangeTitle(
      CalendarView.Week,
      visibleRange(CalendarView.Week, "2026-10-18"),
      "2026-10-18",
    );
    expect(week).toContain("12");
    expect(week).toContain("18");
    expect(week).toContain("2026");
  });
});

describe("entries", () => {
  it("places the same instant on the local day of the zone being shown", () => {
    const late = entry({ at: "2026-10-18T01:00:00Z" });
    expect(entryDay(late, "America/Sao_Paulo")).toBe("2026-10-17");
    expect(entryDay(late, "UTC")).toBe("2026-10-18");
    expect(entryDay(late, "Europe/Lisbon")).toBe("2026-10-18");
  });

  it("keeps the local date of a deadline in every zone", () => {
    const deadline = entry({
      kind: CalendarEntryKind.ProductionDeadline,
      at: null,
      date: "2026-10-20",
    });
    expect(entryDay(deadline, "America/Sao_Paulo")).toBe("2026-10-20");
    expect(entryDay(deadline, "Pacific/Auckland")).toBe("2026-10-20");
  });

  it("shows the own zone only when it differs from the one on the screen", () => {
    expect(entryTimeLabel(entry(), "America/Sao_Paulo")).toBe("10:00");
    expect(entryTimeLabel(entry({ plannedTimezone: "Europe/Lisbon" }), "America/Sao_Paulo")).toBe(
      "10:00 · Europe/Lisbon",
    );
    expect(entryTimeLabel(entry({ at: null, date: "2026-10-20" }), "UTC")).toBe("o dia todo");
  });

  it("groups by day with deadlines first and times in order", () => {
    const groups = groupByDay(
      [
        entry({ channelRowId: "late", at: "2026-10-20T20:00:00Z" }),
        entry({ channelRowId: "early", at: "2026-10-20T12:00:00Z" }),
        entry({
          kind: CalendarEntryKind.ApprovalDeadline,
          channelRowId: "due",
          at: null,
          date: "2026-10-20",
        }),
      ],
      "America/Sao_Paulo",
    );
    expect((groups.get("2026-10-20") ?? []).map((item) => item.channelRowId)).toEqual([
      "due",
      "early",
      "late",
    ]);
  });

  it("gives each entry a key that tells a channel row's date apart from its deadline", () => {
    expect(entryKey(entry())).not.toBe(entryKey(entry({ kind: CalendarEntryKind.Published })));
  });
});

describe("calendarAlerts", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  it("warns when a channel has more entries in a day than the limit", () => {
    const crowded = Array.from({ length: MAX_PER_CHANNEL_PER_DAY + 1 }, (_, index) =>
      entry({ channelRowId: `v${index}`, at: `2026-10-20T${10 + index * 2}:00:00Z` }),
    );
    const alerts = calendarAlerts(crowded, "America/Sao_Paulo", now);
    expect(alerts.get(entryKey(crowded[0] as CalendarEntry))).toContain(CalendarAlert.TooManyOnDay);
    const fewer = calendarAlerts(
      crowded.slice(0, MAX_PER_CHANNEL_PER_DAY),
      "America/Sao_Paulo",
      now,
    );
    expect([...fewer.values()].flat()).not.toContain(CalendarAlert.TooManyOnDay);
  });

  it("warns about two publications of one channel that are too close", () => {
    const first = entry({ channelRowId: "a", at: "2026-10-20T13:00:00Z" });
    const second = entry({ channelRowId: "b", at: `2026-10-20T13:${MIN_MINUTES_BETWEEN - 1}:00Z` });
    const far = entry({
      channelRowId: "c",
      at: `2026-10-20T13:${MIN_MINUTES_BETWEEN}:00Z`,
      channelId: "other",
    });
    const alerts = calendarAlerts([first, second, far], "America/Sao_Paulo", now);
    expect(alerts.get(entryKey(first))).toContain(CalendarAlert.TooClose);
    expect(alerts.get(entryKey(second))).toContain(CalendarAlert.TooClose);
    expect(alerts.get(entryKey(far)) ?? []).not.toContain(CalendarAlert.TooClose);
  });

  it("warns about a publication that is not approved yet and one whose date passed", () => {
    const pending = entry({ channelRowId: "p", editorialStatus: EditorialStatus.AwaitingApproval });
    const past = entry({ channelRowId: "q", at: "2026-10-10T13:00:00Z" });
    const alerts = calendarAlerts([pending, past], "America/Sao_Paulo", now);
    expect(alerts.get(entryKey(pending))).toContain(CalendarAlert.NotApprovedYet);
    expect(alerts.get(entryKey(past))).toContain(CalendarAlert.DatePassed);
    expect(alerts.get(entryKey(pending))).not.toContain(CalendarAlert.DatePassed);
  });

  it("never warns about deadlines or published entries", () => {
    const published = entry({
      kind: CalendarEntryKind.Published,
      publicationStatus: PublicationStatus.PublishedManually,
    });
    expect(calendarAlerts([published], "UTC", now).size).toBe(0);
  });
});

describe("daylight saving", () => {
  it("refuses a local time that does not exist in Lisbon and accepts it in Sao Paulo", () => {
    expect(resolveLocalTime("2026-03-29T01:30", "Europe/Lisbon")).toEqual({
      ok: false,
      problem: LocalTimeProblem.Nonexistent,
    });
    const sao = resolveLocalTime("2026-03-29T01:30", "America/Sao_Paulo");
    expect(sao.ok).toBe(true);
  });

  it("asks which occurrence when a local time happens twice in Lisbon", () => {
    const result = resolveLocalTime("2026-10-25T01:30", "Europe/Lisbon");
    expect(result.ok).toBe(false);
    if (result.ok || result.problem !== LocalTimeProblem.Ambiguous)
      throw new Error("expected ambiguous");
    expect(result.options.map((date) => date.toISOString())).toEqual([
      "2026-10-25T00:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ]);
  });

  it("converts an ordinary time before and after the change", () => {
    const summer = resolveLocalTime("2026-07-01T10:00", "Europe/Lisbon");
    const winter = resolveLocalTime("2026-12-01T10:00", "Europe/Lisbon");
    expect(summer.ok && summer.instant.toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(winter.ok && winter.instant.toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });

  it("never has an ambiguous or missing time in a zone without daylight saving", () => {
    for (const day of ["2026-03-29", "2026-10-25", "2026-11-01"]) {
      for (const hour of ["00", "01", "02", "03"]) {
        expect(resolveLocalTime(`${day}T${hour}:30`, "America/Sao_Paulo").ok).toBe(true);
      }
    }
  });

  it("keeps the local time of day when moving an entry to another day", () => {
    const moved = moveToDay("2026-10-20T13:00:00Z", "2026-10-25", "Europe/Lisbon");
    expect(moved.ok && moved.instant.toISOString()).toBe("2026-10-25T14:00:00.000Z");
    const saoPaulo = moveToDay("2026-10-20T13:00:00Z", "2026-10-25", "America/Sao_Paulo");
    expect(saoPaulo.ok && saoPaulo.instant.toISOString()).toBe("2026-10-25T13:00:00.000Z");
  });

  it("reports an ambiguous result when the moved time falls in the repeated hour", () => {
    const moved = moveToDay("2026-10-20T00:30:00Z", "2026-10-25", "Europe/Lisbon");
    expect(moved.ok).toBe(false);
  });
});

import { entryDay, entryKey } from "@/lib/shared/calendar/entries";
import type { CalendarEntry } from "@/lib/shared/calendar/types";
import { CalendarAlert, CalendarEntryKind, EditorialStatus } from "@/lib/shared/enums";
import { MINUTE_MS, toMs } from "@/lib/shared/dates";

export const MAX_PER_CHANNEL_PER_DAY = 3;
export const MIN_MINUTES_BETWEEN = 30;

export const calendarAlerts = (
  entries: CalendarEntry[],
  zone: string,
  now: Date,
): Map<string, CalendarAlert[]> => {
  const planned = entries.filter(
    (entry) => entry.kind === CalendarEntryKind.Publication && entry.at !== null,
  );
  const result = new Map<string, CalendarAlert[]>();
  const add = (entry: CalendarEntry, alert: CalendarAlert) => {
    const key = entryKey(entry);
    result.set(key, [...(result.get(key) ?? []), alert]);
  };

  const perDay = new Map<string, CalendarEntry[]>();
  for (const entry of planned) {
    const key = `${entry.channelId}|${entryDay(entry, zone)}`;
    perDay.set(key, [...(perDay.get(key) ?? []), entry]);
  }
  for (const group of perDay.values()) {
    if (group.length > MAX_PER_CHANNEL_PER_DAY) {
      for (const entry of group) add(entry, CalendarAlert.TooManyOnDay);
    }
  }

  for (const entry of planned) {
    const time = toMs(entry.at ?? "");
    const close = planned.some(
      (other) =>
        other !== entry &&
        other.channelId === entry.channelId &&
        Math.abs(toMs(other.at ?? "") - time) < MIN_MINUTES_BETWEEN * MINUTE_MS,
    );
    if (close) add(entry, CalendarAlert.TooClose);
    if (entry.editorialStatus !== EditorialStatus.Approved)
      add(entry, CalendarAlert.NotApprovedYet);
    if (time < toMs(now)) add(entry, CalendarAlert.DatePassed);
  }
  return result;
};

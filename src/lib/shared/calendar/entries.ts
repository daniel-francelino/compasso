import type { CalendarEntry } from "@/lib/shared/calendar/types";
import { CalendarEntryKind } from "@/lib/shared/enums";
import { instantToLocalInput } from "@/lib/shared/format";

const isDeadline = (entry: CalendarEntry): boolean =>
  entry.kind === CalendarEntryKind.ApprovalDeadline ||
  entry.kind === CalendarEntryKind.ProductionDeadline;

export const entryKey = (entry: CalendarEntry): string =>
  `${entry.kind}:${entry.channelRowId ?? entry.noteId ?? entry.itemId ?? ""}:${entry.date ?? entry.at ?? ""}`;

export const entryDay = (entry: CalendarEntry, zone: string): string | null => {
  if (entry.date !== null) return entry.date;
  if (entry.at === null) return null;
  return instantToLocalInput(entry.at, zone).slice(0, 10);
};

export const entryTime = (entry: CalendarEntry, zone: string): string | null => {
  if (entry.kind === CalendarEntryKind.Event) {
    return entry.allDay || entry.startsAt === null
      ? null
      : instantToLocalInput(entry.startsAt, entry.timezone ?? zone).slice(11);
  }
  return entry.at === null ? null : instantToLocalInput(entry.at, zone).slice(11);
};

export const entryTimeLabel = (entry: CalendarEntry, zone: string): string => {
  const time = entryTime(entry, zone);
  if (time === null) return "o dia todo";
  const own = entry.plannedTimezone;
  return own !== null && own !== zone ? `${time} · ${own.replaceAll("_", " ")}` : time;
};

export const groupByDay = (
  entries: CalendarEntry[],
  zone: string,
): Map<string, CalendarEntry[]> => {
  const groups = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const day = entryDay(entry, zone);
    if (day === null) continue;
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  for (const [day, list] of groups) {
    groups.set(
      day,
      [...list].sort((a, b) => {
        if (isDeadline(a) !== isDeadline(b)) return isDeadline(a) ? -1 : 1;
        return (entryTime(a, zone) ?? "").localeCompare(entryTime(b, zone) ?? "");
      }),
    );
  }
  return groups;
};

export const isMovable = (entry: CalendarEntry): boolean =>
  entry.kind === CalendarEntryKind.Publication ||
  entry.kind === CalendarEntryKind.ProductionDeadline;

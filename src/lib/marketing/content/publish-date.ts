import { moveToDay, resolveLocalTime } from "@/lib/shared/calendar/reschedule";
import { instantToLocalInput, toIso } from "@/lib/shared/dates";

export const DEFAULT_PUBLISH_HOUR = "09:00";

type RowDates = { plannedAt: string | null; plannedTimezone: string | null; published: boolean };

export const plannedOnDay = (day: string | null, zone: string): string | null => {
  if (day === null) return null;
  const resolved = resolveLocalTime(`${day}T${DEFAULT_PUBLISH_HOUR}`, zone);
  return resolved.ok ? toIso(resolved.instant) : null;
};

const localDayOf = (instant: string, zone: string): string =>
  instantToLocalInput(instant, zone).slice(0, 10);

export const followPublishDate = <T extends RowDates>(
  rows: T[],
  previous: string | null,
  next: string | null,
  zone: string,
): T[] => {
  if (next === null) return rows;
  return rows.map((row) => {
    if (row.published) return row;
    if (row.plannedAt === null) {
      const plannedAt = plannedOnDay(next, zone);
      return plannedAt === null ? row : { ...row, plannedAt, plannedTimezone: zone };
    }
    const rowZone = row.plannedTimezone ?? zone;
    if (previous === null || localDayOf(row.plannedAt, rowZone) !== previous) return row;
    const moved = moveToDay(row.plannedAt, next, rowZone);
    return moved.ok ? { ...row, plannedAt: toIso(moved.instant) } : row;
  });
};

import type { VisibleRange } from "@/lib/shared/calendar/types";
import { CalendarView } from "@/lib/shared/enums";
import { formatDayMonth, formatMonthYear } from "@/lib/shared/format";
import {
  addDaysToDate,
  addMonthsToDate,
  endOfMonthDate,
  plusDays,
  startOfDayInstant,
  startOfMonthDate,
  startOfWeekDate,
} from "@/lib/shared/dates";

const MAX_DAYS = 100;

const daysBetween = (start: string, end: string): string[] => {
  const days: string[] = [];
  for (let day = start; day < end && days.length <= MAX_DAYS; day = addDaysToDate(day, 1)) {
    days.push(day);
  }
  return days;
};

export const visibleRange = (
  view: CalendarView,
  anchor: string,
  mondayFirst = true,
): VisibleRange => {
  if (view === CalendarView.Week) {
    const start = startOfWeekDate(anchor, mondayFirst);
    const end = addDaysToDate(start, 7);
    return { start, end, days: daysBetween(start, end) };
  }
  const start = startOfWeekDate(startOfMonthDate(anchor), mondayFirst);
  const end = addDaysToDate(startOfWeekDate(endOfMonthDate(anchor), mondayFirst), 7);
  return { start, end, days: daysBetween(start, end) };
};

export const shiftAnchor = (view: CalendarView, anchor: string, direction: 1 | -1): string =>
  view === CalendarView.Week
    ? addDaysToDate(anchor, direction * 7)
    : addMonthsToDate(startOfMonthDate(anchor), direction);

export const rangeInstants = (range: VisibleRange, zone: string): { from: Date; to: Date } => ({
  from: plusDays(startOfDayInstant(range.start, zone), -1),
  to: plusDays(startOfDayInstant(range.end, zone), 1),
});

export const rangeTitle = (view: CalendarView, range: VisibleRange, anchor: string): string => {
  if (view !== CalendarView.Week) return formatMonthYear(anchor);
  const last = addDaysToDate(range.end, -1);
  return `${formatDayMonth(range.start)} a ${formatDayMonth(last)} de ${last.slice(0, 4)}`;
};

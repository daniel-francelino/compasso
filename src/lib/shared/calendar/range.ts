import type { VisibleRange } from "@/lib/shared/calendar/types";
import { CalendarView } from "@/lib/shared/enums";
import {
  addDaysToDate,
  formatDayMonth,
  formatMonthYear,
  localInputToInstant,
  weekdayIndex,
} from "@/lib/shared/format";

const DAY_MS = 86400000;
const MAX_DAYS = 100;

const startOfWeek = (date: string, mondayFirst: boolean): string => {
  const index = weekdayIndex(date);
  const back = mondayFirst ? (index + 6) % 7 : index;
  return addDaysToDate(date, -back);
};

const firstOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

const lastOfMonth = (date: string): string => addDaysToDate(addMonths(firstOfMonth(date), 1), -1);

const addMonths = (date: string, months: number): string => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + months;
  const moved = new Date(Date.UTC(year, month, 1));
  return moved.toISOString().slice(0, 10);
};

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
    const start = startOfWeek(anchor, mondayFirst);
    const end = addDaysToDate(start, 7);
    return { start, end, days: daysBetween(start, end) };
  }
  const start = startOfWeek(firstOfMonth(anchor), mondayFirst);
  const end = addDaysToDate(startOfWeek(lastOfMonth(anchor), mondayFirst), 7);
  return { start, end, days: daysBetween(start, end) };
};

export const shiftAnchor = (view: CalendarView, anchor: string, direction: 1 | -1): string =>
  view === CalendarView.Week
    ? addDaysToDate(anchor, direction * 7)
    : addMonths(firstOfMonth(anchor), direction);

const startOfDayInstant = (date: string, zone: string): Date => {
  for (const hour of ["00", "01", "02", "03"]) {
    const instant = localInputToInstant(`${date}T${hour}:00`, zone);
    if (instant !== null) return instant;
  }
  return new Date(`${date}T00:00:00Z`);
};

export const rangeInstants = (range: VisibleRange, zone: string): { from: Date; to: Date } => ({
  from: new Date(startOfDayInstant(range.start, zone).getTime() - DAY_MS),
  to: new Date(startOfDayInstant(range.end, zone).getTime() + DAY_MS),
});

export const rangeTitle = (view: CalendarView, range: VisibleRange, anchor: string): string => {
  if (view !== CalendarView.Week) return formatMonthYear(anchor);
  const last = addDaysToDate(range.end, -1);
  return `${formatDayMonth(range.start)} a ${formatDayMonth(last)} de ${last.slice(0, 4)}`;
};

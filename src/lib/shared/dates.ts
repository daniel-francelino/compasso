import { TZDate, tzOffset } from "@date-fns/tz";
import {
  addDays,
  addMilliseconds,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDay,
  isValid,
  parse,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

export type Instant = string | number | Date;

export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

const UTC = "UTC";
const DAY_PATTERN = "yyyy-MM-dd";
const LOCAL_INPUT_PATTERN = "yyyy-MM-dd'T'HH:mm";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MIDNIGHT_HOURS = [0, 1, 2, 3];

export const toDate = (value: Instant): Date => (value instanceof Date ? value : new Date(value));

export const toMs = (value: Instant): number => toDate(value).getTime();

export const toIso = (value: Instant): string => toDate(value).toISOString();

export const nowDate = (): Date => new Date();

export const nowMs = (): number => Date.now();

export const nowIso = (): string => toIso(nowDate());

export const parseInstant = (value: string): Date | null => {
  const parsed = new Date(value);
  return isValid(parsed) ? parsed : null;
};

export const plusMs = (value: Instant, ms: number): Date => addMilliseconds(toDate(value), ms);

export const plusMinutes = (value: Instant, minutes: number): Date =>
  addMinutes(toDate(value), minutes);

export const plusDays = (value: Instant, days: number): Date => plusMs(value, days * DAY_MS);

export const msBetween = (from: Instant, to: Instant): number => toMs(to) - toMs(from);

export const msSince = (value: Instant): number => nowMs() - toMs(value);

export const daysSince = (value: Instant): number =>
  Math.max(0, Math.floor(msSince(value) / DAY_MS));

export const isInPast = (value: Instant): boolean => toMs(value) < nowMs();

export const isInFuture = (value: Instant): boolean => toMs(value) > nowMs();

export const isOlderThan = (value: Instant, ms: number): boolean => msSince(value) > ms;

export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

const inZone = (value: Instant, timeZone: string): TZDate => new TZDate(toMs(value), timeZone);

export const todayInZone = (timeZone: string, now: Instant = nowDate()): string =>
  format(inZone(now, timeZone), DAY_PATTERN);

export const instantToLocalInput = (value: Instant, timeZone: string): string =>
  format(inZone(value, timeZone), LOCAL_INPUT_PATTERN);

const naiveInstantMs = (match: RegExpExecArray): number =>
  new TZDate(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    UTC,
  ).getTime();

const offsetAt = (timeZone: string, instantMs: number): number =>
  tzOffset(timeZone, new Date(instantMs)) * MINUTE_MS;

export const localInputToInstant = (value: string, timeZone: string): Date | null => {
  const match = LOCAL_INPUT.exec(value);
  if (match === null) return null;
  const naive = naiveInstantMs(match);
  const first = naive - offsetAt(timeZone, naive);
  const result = new Date(naive - offsetAt(timeZone, first));
  return instantToLocalInput(result, timeZone) === value ? result : null;
};

export const localInputOccurrences = (value: string, timeZone: string): Date[] => {
  const match = LOCAL_INPUT.exec(value);
  if (match === null) return [];
  const naive = naiveInstantMs(match);
  const offsets = new Set([offsetAt(timeZone, naive - DAY_MS), offsetAt(timeZone, naive + DAY_MS)]);
  const found = new Map<number, Date>();
  for (const offset of offsets) {
    const candidate = new Date(naive - offset);
    if (instantToLocalInput(candidate, timeZone) === value)
      found.set(candidate.getTime(), candidate);
  }
  return [...found.values()].sort((a, b) => a.getTime() - b.getTime());
};

export const parseDateOnly = (date: string): Date | null => {
  const match = DATE_ONLY.exec(date);
  if (match === null) return null;
  const parsed = new TZDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]), UTC);
  return format(parsed, DAY_PATTERN) === date ? parsed : null;
};

const mapDate = (date: string, change: (parsed: Date) => Date): string => {
  const parsed = parseDateOnly(date);
  return parsed === null ? date : format(change(parsed), DAY_PATTERN);
};

export const addDaysToDate = (date: string, days: number): string =>
  mapDate(date, (parsed) => addDays(parsed, days));

export const addMonthsToDate = (date: string, months: number): string =>
  mapDate(date, (parsed) => addMonths(parsed, months));

export const startOfMonthDate = (date: string): string => mapDate(date, startOfMonth);

export const endOfMonthDate = (date: string): string => mapDate(date, endOfMonth);

export const startOfWeekDate = (date: string, mondayFirst: boolean): string =>
  mapDate(date, (parsed) => startOfWeek(parsed, { weekStartsOn: mondayFirst ? 1 : 0 }));

export const weekdayIndex = (date: string): number => {
  const parsed = parseDateOnly(date);
  return parsed === null ? 0 : getDay(parsed);
};

export const daysBetweenDates = (from: string, to: string): number => {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  return start === null || end === null ? 0 : differenceInCalendarDays(end, start);
};

export const eachDate = (from: string, to: string): string[] => {
  const count = daysBetweenDates(from, to) + 1;
  return count > 0 ? Array.from({ length: count }, (_, index) => addDaysToDate(from, index)) : [];
};

export const startOfDayInstant = (date: string, timeZone: string): Date => {
  for (const hour of MIDNIGHT_HOURS) {
    const instant = localInputToInstant(`${date}T${String(hour).padStart(2, "0")}:00`, timeZone);
    if (instant !== null) return instant;
  }
  return parseDateOnly(date) ?? nowDate();
};

export const tomorrowAtHour = (hour: number, timeZone: string = browserTimeZone()): Date => {
  const today = inZone(nowDate(), timeZone);
  return new TZDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
    hour,
    0,
    0,
    timeZone,
  );
};

export const parseDateValue = (value: string): Date | undefined => {
  if (!DATE_ONLY.test(value)) return undefined;
  const parsed = parse(value, DAY_PATTERN, nowDate());
  return isValid(parsed) ? parsed : undefined;
};

export const toDateValue = (date: Date): string => format(date, DAY_PATTERN);

export const monthStart = (year: number, monthIndex: number): Date =>
  setMonth(setYear(startOfYear(nowDate()), year), monthIndex);

export const hasPassed = (value: Instant, reference: number = nowMs()): boolean =>
  toMs(value) <= reference;

export const utcDayStartSeconds = (day: string): number => {
  const parsed = parseDateOnly(day);
  return parsed === null ? 0 : Math.floor(parsed.getTime() / 1000);
};

export const plusLocalDays = (date: Date, days: number): Date => addDays(date, days);

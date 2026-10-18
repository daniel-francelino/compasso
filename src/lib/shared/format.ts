const LOCALE = "pt-BR";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

type Instant = string | number | Date;

const toDate = (value: Instant): Date => (value instanceof Date ? value : new Date(value));

export function formatDate(value: Instant, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(toDate(value));
}

export function formatDateOnly(value: string): string {
  const match = DATE_ONLY.exec(value);
  if (match === null) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDateTime(value: Instant, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(toDate(value));
}

export function formatInZone(value: Instant, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(toDate(value));
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${formatNumber(value, unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const partsInZone = (instant: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
};

const offsetMinutes = (instantMs: number, timeZone: string): number => {
  const p = partsInZone(new Date(instantMs), timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60000);
};

export function instantToLocalInput(value: Instant, timeZone: string): string {
  const p = partsInZone(toDate(value), timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function localInputToInstant(value: string, timeZone: string): Date | null {
  const match = LOCAL_INPUT.exec(value);
  if (match === null) return null;
  const naive = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  const first = naive - offsetMinutes(naive, timeZone) * 60000;
  const result = new Date(naive - offsetMinutes(first, timeZone) * 60000);
  return instantToLocalInput(result, timeZone) === value ? result : null;
}

export function todayInZone(timeZone: string, now: Date = new Date()): string {
  const p = partsInZone(now, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDaysToDate(date: string, days: number): string {
  const match = DATE_ONLY.exec(date);
  if (match === null) return date;
  const moved = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return moved.toISOString().slice(0, 10);
}

const DAY_MS = 86400000;

export function localInputOccurrences(value: string, timeZone: string): Date[] {
  const match = LOCAL_INPUT.exec(value);
  if (match === null) return [];
  const naive = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  const offsets = new Set([
    offsetMinutes(naive - DAY_MS, timeZone),
    offsetMinutes(naive + DAY_MS, timeZone),
  ]);
  const found = new Map<number, Date>();
  for (const offset of offsets) {
    const candidate = new Date(naive - offset * 60000);
    if (instantToLocalInput(candidate, timeZone) === value)
      found.set(candidate.getTime(), candidate);
  }
  return [...found.values()].sort((a, b) => a.getTime() - b.getTime());
}

export function formatMonthYear(date: string): string {
  const match = DATE_ONLY.exec(date);
  if (match === null) return date;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

export function formatWeekdayShort(date: string): string {
  const match = DATE_ONLY.exec(date);
  if (match === null) return date;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))))
    .replace(".", "");
}

export function formatDayMonth(date: string): string {
  const match = DATE_ONLY.exec(date);
  if (match === null) return date;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))))
    .replace(".", "");
}

export function weekdayIndex(date: string): number {
  const match = DATE_ONLY.exec(date);
  if (match === null) return 0;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

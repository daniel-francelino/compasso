import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { type Instant, parseDateOnly, toDate, toMs } from "@/lib/shared/dates";

export const LOCALE = "pt-BR";
export const DATE_LOCALE = ptBR;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PATTERN = "dd/MM/yyyy";
const DATE_TIME_PATTERN = "dd/MM/yyyy HH:mm";
const DATE_TIME_ZONE_PATTERN = "dd/MM/yyyy HH:mm z";

const zoned = (value: Instant, timeZone?: string): Date =>
  timeZone === undefined ? toDate(value) : new TZDate(toMs(value), timeZone);

export function formatDate(value: Instant, timeZone?: string): string {
  return format(zoned(value, timeZone), DATE_PATTERN);
}

export function formatDateOnly(value: string): string {
  const match = DATE_ONLY.exec(value);
  if (match === null) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDateTime(value: Instant, timeZone?: string): string {
  return format(zoned(value, timeZone), DATE_TIME_PATTERN);
}

export function formatInZone(
  value: Instant,
  timeZone: string,
  options: { includeZone?: boolean } = {},
): string {
  return format(
    zoned(value, timeZone),
    options.includeZone ? DATE_TIME_ZONE_PATTERN : DATE_TIME_PATTERN,
  );
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
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

const formatDay = (date: string, pattern: string): string => {
  const parsed = parseDateOnly(date);
  return parsed === null ? date : format(parsed, pattern, { locale: DATE_LOCALE });
};

export function formatMonthYear(date: string): string {
  return formatDay(date, "MMMM 'de' yyyy");
}

export function formatWeekdayShort(date: string): string {
  return formatDay(date, "EEE");
}

export function formatDayMonth(date: string): string {
  return formatDay(date, "d 'de' MMM");
}

export function formatLongDate(value: Instant): string {
  return format(toDate(value), "d 'de' MMMM 'de' yyyy", { locale: DATE_LOCALE });
}

export function formatMediumDate(value: Instant): string {
  return format(toDate(value), "d 'de' MMM 'de' yyyy", { locale: DATE_LOCALE });
}

export function formatMonthShort(value: Instant): string {
  return format(toDate(value), "MMM", { locale: DATE_LOCALE });
}

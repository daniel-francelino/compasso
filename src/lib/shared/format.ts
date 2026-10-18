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

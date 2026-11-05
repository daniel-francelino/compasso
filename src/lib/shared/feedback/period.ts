import { addMonthsToDate, startOfMonthDate } from "@/lib/shared/dates";
import { formatMonthYear } from "@/lib/shared/format";

const PERIOD_PARAM = /^(\d{4})-(\d{2})$/;

export const periodFromParam = (value: string | undefined): string | null => {
  if (value === undefined) return null;
  const match = PERIOD_PARAM.exec(value);
  if (match === null) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${value}-01` : null;
};

export const periodToParam = (period: string): string => period.slice(0, 7);

export const previousClosedMonth = (today: string): string =>
  startOfMonthDate(addMonthsToDate(today, -1));

export const shiftPeriod = (period: string, months: number): string =>
  startOfMonthDate(addMonthsToDate(period, months));

export const periodMonthName = (period: string): string =>
  formatMonthYear(period).split(" de ")[0] ?? "";

export const periodLabel = (period: string): string => {
  const text = formatMonthYear(period);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

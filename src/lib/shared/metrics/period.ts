import { formatDateOnly, formatMonthYear } from "@/lib/shared/format";
import { addDaysToDate, endOfMonthDate, startOfMonthDate } from "@/lib/shared/dates";

export const PeriodPreset = {
  Last7: "last7",
  Last30: "last30",
  Last90: "last90",
  ThisMonth: "this_month",
  LastMonth: "last_month",
  Custom: "custom",
} as const;
export type PeriodPreset = (typeof PeriodPreset)[keyof typeof PeriodPreset];

export const periodPresetLabels: Record<PeriodPreset, string> = {
  [PeriodPreset.Last7]: "Últimos 7 dias",
  [PeriodPreset.Last30]: "Últimos 30 dias",
  [PeriodPreset.Last90]: "Últimos 90 dias",
  [PeriodPreset.ThisMonth]: "Este mês",
  [PeriodPreset.LastMonth]: "Mês passado",
  [PeriodPreset.Custom]: "Período livre",
};

export type DateRange = { from: string; to: string };

const LAST_DAYS = { [PeriodPreset.Last7]: 7, [PeriodPreset.Last30]: 30, [PeriodPreset.Last90]: 90 };

export const presetRange = (preset: PeriodPreset, today: string): DateRange | null => {
  const yesterday = addDaysToDate(today, -1);
  if (preset === PeriodPreset.ThisMonth) return { from: startOfMonthDate(today), to: today };
  if (preset === PeriodPreset.LastMonth) {
    const lastDay = addDaysToDate(startOfMonthDate(today), -1);
    return { from: startOfMonthDate(lastDay), to: lastDay };
  }
  if (preset === PeriodPreset.Custom) return null;
  return { from: addDaysToDate(yesterday, 1 - LAST_DAYS[preset]), to: yesterday };
};

export const isFullMonth = (range: DateRange): boolean =>
  range.from === startOfMonthDate(range.from) && range.to === endOfMonthDate(range.from);

export const periodLabel = (range: DateRange): string =>
  isFullMonth(range)
    ? `Em ${formatMonthYear(range.from)}`
    : `Entre ${formatDateOnly(range.from)} e ${formatDateOnly(range.to)}`;

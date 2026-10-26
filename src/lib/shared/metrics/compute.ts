import { z } from "zod";
import { MetricKey } from "@/lib/shared/enums";

export const totalSchema = z.object({
  sum: z.number(),
  avg: z.number(),
  days: z.number().int(),
  first: z.number(),
  last: z.number(),
});

export type MetricTotal = z.infer<typeof totalSchema>;

export const pointSchema = z.object({ start: z.string(), value: z.number() });

export type MetricPoint = z.infer<typeof pointSchema>;

export const overviewSchema = z.object({
  timezone: z.string(),
  from: z.string(),
  to: z.string(),
  previous_from: z.string().nullable(),
  previous_to: z.string().nullable(),
  granularity: z.string(),
  first_day: z.string().nullable(),
  last_day: z.string().nullable(),
  totals: z.record(z.string(), totalSchema),
  previous_totals: z.record(z.string(), totalSchema).nullable(),
  series: z.record(z.string(), z.array(pointSchema)),
  previous_series: z.record(z.string(), z.array(pointSchema)).nullable(),
  posts_published: z.number().int(),
  previous_posts_published: z.number().int().nullable(),
});

export type Overview = z.infer<typeof overviewSchema>;

export const Trend = { Up: "up", Down: "down", Flat: "flat", None: "none" } as const;
export type Trend = (typeof Trend)[keyof typeof Trend];

export type Delta = {
  absolute: number;
  percent: number | null;
  trend: Trend;
};

export const FLAT_THRESHOLD = 0.005;

export const deltaOf = (current: number | undefined, previous: number | undefined): Delta => {
  if (current === undefined || previous === undefined) {
    return { absolute: 0, percent: null, trend: Trend.None };
  }
  const absolute = current - previous;
  const percent = previous === 0 ? null : absolute / previous;
  const small = percent !== null && Math.abs(percent) < FLAT_THRESHOLD;
  if (absolute === 0 || small) return { absolute, percent, trend: Trend.Flat };
  return { absolute, percent, trend: absolute > 0 ? Trend.Up : Trend.Down };
};

export const followerGain = (total: MetricTotal | undefined): number | undefined =>
  total === undefined ? undefined : total.last - total.first;

export const engagementRate = (interactions: number | undefined, reach: number | undefined) =>
  interactions === undefined || reach === undefined || reach === 0 ? null : interactions / reach;

export const SUMMED_METRICS: readonly MetricKey[] = [
  MetricKey.Views,
  MetricKey.ProfileViews,
  MetricKey.AccountsEngaged,
  MetricKey.Interactions,
  MetricKey.Likes,
  MetricKey.Comments,
  MetricKey.Saves,
  MetricKey.Shares,
  MetricKey.ProfileLinkTaps,
  MetricKey.Follows,
  MetricKey.Unfollows,
];

export const hasEnoughData = (overview: Overview): boolean =>
  Object.values(overview.totals).some((total) => total.days > 0);

export const partialDays = (overview: Overview, today: string): boolean => overview.to >= today;

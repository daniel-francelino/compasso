import { z } from "zod";
import type { MetricCompare, MetricGranularity } from "@/lib/shared/enums";
import { overviewSchema } from "@/lib/shared/metrics/compute";
import {
  audienceRowSchema,
  breakdownRowSchema,
  markSchema,
  planSummarySchema,
  topPostSchema,
} from "@/lib/shared/metrics/dto";
import type { PostRanking } from "@/lib/shared/metrics/ranking";
import type { Analysis } from "@/lib/shared/metrics/report";
import { type Result, fail } from "@/lib/shared/server-utils";
import type { ServerSupabase } from "@/lib/shared/supabase/server-client.server";

export const TOP_POSTS = 5;

export type AnalysisParams = {
  brandId: string;
  channelId: string;
  from: string;
  to: string;
  compare: MetricCompare;
  granularity: MetricGranularity;
  rankBy: PostRanking;
};

const rowsOf = <T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T>[] | null => {
  const parsed = z.array(schema).safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const loadAnalysis = async (
  supabase: ServerSupabase,
  params: AnalysisParams,
): Promise<Result<{ analysis: Analysis }>> => {
  const scope = { p_brand: params.brandId, p_channel: params.channelId };
  const range = { p_from: params.from, p_to: params.to };
  const [overview, posts, formats, weekdays, hours, audience, plan, marks] = await Promise.all([
    supabase.rpc("metrics_overview", {
      ...scope,
      ...range,
      p_compare: params.compare,
      p_granularity: params.granularity,
    }),
    supabase.rpc("metrics_top_posts", {
      ...scope,
      ...range,
      p_by: params.rankBy,
      p_limit: TOP_POSTS,
    }),
    supabase.rpc("metrics_breakdown", {
      ...scope,
      ...range,
      p_dimension: "format",
      p_by: params.rankBy,
    }),
    supabase.rpc("metrics_breakdown", {
      ...scope,
      ...range,
      p_dimension: "weekday",
      p_by: params.rankBy,
    }),
    supabase.rpc("metrics_breakdown", {
      ...scope,
      ...range,
      p_dimension: "hour",
      p_by: params.rankBy,
    }),
    supabase.rpc("metrics_audience", scope),
    supabase.rpc("metrics_plan_summary", { ...scope, ...range }),
    supabase.rpc("metric_marks_list", { p_brand: params.brandId, ...range }),
  ]);

  const failed = [overview, posts, formats, weekdays, hours, audience, plan, marks].find(
    (reply) => reply.error,
  );
  if (failed?.error) return fail(failed.error);

  const parsed = {
    overview: overviewSchema.safeParse(overview.data),
    topPosts: rowsOf(topPostSchema, posts.data),
    formats: rowsOf(breakdownRowSchema, formats.data),
    weekdays: rowsOf(breakdownRowSchema, weekdays.data),
    hours: rowsOf(breakdownRowSchema, hours.data),
    audience: rowsOf(audienceRowSchema, audience.data),
    plan: planSummarySchema.safeParse(plan.data),
    marks: rowsOf(markSchema, marks.data),
  };
  if (
    !parsed.overview.success ||
    !parsed.plan.success ||
    parsed.topPosts === null ||
    parsed.formats === null ||
    parsed.weekdays === null ||
    parsed.hours === null ||
    parsed.audience === null ||
    parsed.marks === null
  ) {
    return fail({ message: "unknown" });
  }
  return {
    ok: true,
    analysis: {
      overview: parsed.overview.data,
      topPosts: parsed.topPosts,
      formats: parsed.formats,
      weekdays: parsed.weekdays,
      hours: parsed.hours,
      audience: parsed.audience,
      plan: parsed.plan.data,
      marks: parsed.marks,
    },
  };
};

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { FEEDBACK_PAGE_SIZE } from "@/lib/shared/feedback/limits";
import { feedbackFiltersSchema, feedbackSummaryFiltersSchema } from "@/lib/shared/feedback/schemas";
import { FeedbackCardState } from "@/lib/shared/feedback/types";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const score = z.number().int().nullable();

const rowSchema = z.object({
  id: z.string().uuid().nullable(),
  brand_id: z.string().uuid(),
  brand_name: z.string(),
  client_name: z.string(),
  respondent_id: z.string().uuid(),
  respondent_name: z.string(),
  period_month: z.string(),
  state: z.nativeEnum(FeedbackCardState),
  snooze_count: z.number().int(),
  score_overall: score,
  score_quality: score,
  score_communication: score,
  score_deadlines: score,
  score_results: score,
  highlight: z.string().nullable(),
  improvement: z.string().nullable(),
  answered_at: z.string().nullable(),
  timezone: z.string().nullable(),
  last_interaction_at: z.string().nullable(),
});

const listSchema = z.object({ total: z.number().int(), rows: z.array(rowSchema) });

const average = z.number().nullable();

const summarySchema = z.object({
  period_month: z.string(),
  answered: z.number().int(),
  expected: z.number().int(),
  pending: z.number().int(),
  attention: z.number().int(),
  average_overall: average,
  average_quality: average,
  average_communication: average,
  average_deadlines: average,
  average_results: average,
  previous_average_overall: average,
});

export type FeedbackCard = {
  id: string | null;
  brandId: string;
  brandName: string;
  clientName: string;
  respondentId: string;
  respondentName: string;
  periodMonth: string;
  state: FeedbackCardState;
  snoozeCount: number;
  scores: {
    overall: number | null;
    quality: number | null;
    communication: number | null;
    deadlines: number | null;
    results: number | null;
  };
  highlight: string | null;
  improvement: string | null;
  answeredAt: string | null;
  timezone: string | null;
  lastInteractionAt: string | null;
};

export type FeedbackSummary = {
  periodMonth: string;
  answered: number;
  expected: number;
  pending: number;
  attention: number;
  averageOverall: number | null;
  previousAverageOverall: number | null;
  dimensions: {
    quality: number | null;
    communication: number | null;
    deadlines: number | null;
    results: number | null;
  };
};

export const listFeedback = createServerFn({ method: "GET" })
  .validator(feedbackFiltersSchema)
  .handler(
    async ({
      data,
    }): Promise<Result<{ rows: FeedbackCard[]; total: number; pageSize: number }>> => {
      const caller = await requireActionServer(Action.Feedback.View);
      if (caller === null) return denied;
      const { data: raw, error } = await caller.supabase.rpc("feedback_list", {
        p_brand: data.brandId ?? null,
        p_period: data.periodMonth,
        p_status: data.status,
        p_attention: data.attention,
        p_page: data.page,
        p_page_size: FEEDBACK_PAGE_SIZE,
      });
      if (error) return fail(error);
      const parsed = parseOutput(listSchema, raw);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        total: parsed.total,
        pageSize: FEEDBACK_PAGE_SIZE,
        rows: parsed.rows.map((row) => ({
          id: row.id,
          brandId: row.brand_id,
          brandName: row.brand_name,
          clientName: row.client_name,
          respondentId: row.respondent_id,
          respondentName: row.respondent_name,
          periodMonth: row.period_month,
          state: row.state,
          snoozeCount: row.snooze_count,
          scores: {
            overall: row.score_overall,
            quality: row.score_quality,
            communication: row.score_communication,
            deadlines: row.score_deadlines,
            results: row.score_results,
          },
          highlight: row.highlight,
          improvement: row.improvement,
          answeredAt: row.answered_at,
          timezone: row.timezone,
          lastInteractionAt: row.last_interaction_at,
        })),
      };
    },
  );

export const getFeedbackSummary = createServerFn({ method: "GET" })
  .validator(feedbackSummaryFiltersSchema)
  .handler(async ({ data }): Promise<Result<{ summary: FeedbackSummary }>> => {
    const caller = await requireActionServer(Action.Feedback.View);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("feedback_summary", {
      p_brand: data.brandId ?? null,
      p_period: data.periodMonth,
    });
    if (error) return fail(error);
    const parsed = parseOutput(summarySchema, raw);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      summary: {
        periodMonth: parsed.period_month,
        answered: parsed.answered,
        expected: parsed.expected,
        pending: parsed.pending,
        attention: parsed.attention,
        averageOverall: parsed.average_overall,
        previousAverageOverall: parsed.previous_average_overall,
        dimensions: {
          quality: parsed.average_quality,
          communication: parsed.average_communication,
          deadlines: parsed.average_deadlines,
          results: parsed.average_results,
        },
      },
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import {
  feedbackBrandSchema,
  feedbackPeriodSchema,
  feedbackSubmitSchema,
} from "@/lib/shared/feedback/schemas";
import { FeedbackPromptState } from "@/lib/shared/feedback/types";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const promptSchema = z.object({
  state: z.nativeEnum(FeedbackPromptState),
  period_month: z.string().optional(),
  snooze_count: z.number().int().optional(),
});

export type PortalFeedbackPrompt = {
  state: FeedbackPromptState;
  periodMonth: string | null;
  snoozeCount: number;
};

export const getPortalFeedbackPrompt = createServerFn({ method: "GET" })
  .validator(feedbackBrandSchema)
  .handler(async ({ data }): Promise<Result<{ prompt: PortalFeedbackPrompt }>> => {
    const caller = await requireActionServer(Action.Feedback.Answer);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("portal_feedback_prompt", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(promptSchema, row);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      prompt: {
        state: parsed.state,
        periodMonth: parsed.period_month ?? null,
        snoozeCount: parsed.snooze_count ?? 0,
      },
    };
  });

export const submitPortalFeedback = createServerFn({ method: "POST" })
  .validator(feedbackSubmitSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Feedback.Answer);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("portal_feedback_submit", {
      p_brand: data.brandId,
      p_period: data.periodMonth,
      p_answers: data.answers,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const snoozePortalFeedback = createServerFn({ method: "POST" })
  .validator(feedbackPeriodSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Feedback.Answer);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("portal_feedback_snooze", {
      p_brand: data.brandId,
      p_period: data.periodMonth,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const declinePortalFeedback = createServerFn({ method: "POST" })
  .validator(feedbackPeriodSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Feedback.Answer);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("portal_feedback_decline", {
      p_brand: data.brandId,
      p_period: data.periodMonth,
    });
    if (error) return fail(error);
    return { ok: true };
  });

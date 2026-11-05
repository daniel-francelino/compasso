import { z } from "zod";
import {
  FEEDBACK_SCORE_MAX,
  FEEDBACK_SCORE_MIN,
  FEEDBACK_TEXT_MAX,
} from "@/lib/shared/feedback/limits";
import { FeedbackListStatus } from "@/lib/shared/feedback/types";

const score = z.number().int().min(FEEDBACK_SCORE_MIN).max(FEEDBACK_SCORE_MAX);
const optionalScore = score.nullable();
const comment = z.string().trim().max(FEEDBACK_TEXT_MAX, "O comentário é longo demais.");

export const feedbackAnswersSchema = z.object({
  overall: score,
  quality: optionalScore,
  communication: optionalScore,
  deadlines: optionalScore,
  results: optionalScore,
  highlight: comment,
  improvement: comment,
});

export type FeedbackAnswers = z.infer<typeof feedbackAnswersSchema>;

const periodMonth = z.string().regex(/^\d{4}-\d{2}-01$/);

export const feedbackBrandSchema = z.object({ brandId: z.string().uuid() });

export const feedbackPeriodSchema = z.object({
  brandId: z.string().uuid(),
  periodMonth,
});

export const feedbackSubmitSchema = feedbackPeriodSchema.extend({
  answers: feedbackAnswersSchema,
});

export const feedbackFiltersSchema = z.object({
  brandId: z.string().uuid().optional(),
  periodMonth,
  status: z.nativeEnum(FeedbackListStatus),
  attention: z.boolean(),
  page: z.number().int().min(1).max(10000),
});

export const feedbackSummaryFiltersSchema = z.object({
  brandId: z.string().uuid().optional(),
  periodMonth,
});

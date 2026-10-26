import { z } from "zod";
import { AudienceDimension, MetricMarkKind } from "@/lib/shared/enums";

export const postMetricsSchema = z.record(z.string(), z.number());

export const topPostSchema = z.object({
  external_media_id: z.string(),
  permalink: z.string().nullable(),
  media_type: z.string(),
  product_type: z.string().nullable(),
  posted_at: z.string(),
  caption_excerpt: z.string().nullable(),
  metrics: postMetricsSchema,
  age_bucket: z.string().nullable(),
  content_channel_id: z.string().nullable(),
  item_id: z.string().nullable(),
  item_title: z.string().nullable(),
});

export type TopPost = z.infer<typeof topPostSchema>;

export const breakdownRowSchema = z.object({
  key: z.string(),
  posts: z.number().int(),
  average: z.number(),
  total: z.number(),
});

export type BreakdownRow = z.infer<typeof breakdownRowSchema>;

export const audienceRowSchema = z.object({
  dimension: z.nativeEnum(AudienceDimension),
  captured_on: z.string(),
  breakdown: z.record(z.string(), z.union([z.number(), z.record(z.string(), z.number())])),
});

export type AudienceRow = z.infer<typeof audienceRowSchema>;

export const markSchema = z.object({
  id: z.string().uuid(),
  channel_id: z.string().uuid().nullable(),
  kind: z.nativeEnum(MetricMarkKind),
  label: z.string(),
  starts_on: z.string(),
  ends_on: z.string().nullable(),
  content_item_id: z.string().uuid().nullable(),
  version: z.number().int(),
});

export type Mark = z.infer<typeof markSchema>;

export const planSummarySchema = z.object({
  planned: z.number().int(),
  published: z.number().int(),
  automatic: z.number().int(),
  published_automatically: z.number().int(),
  failed: z.number().int(),
});

export type PlanSummary = z.infer<typeof planSummarySchema>;

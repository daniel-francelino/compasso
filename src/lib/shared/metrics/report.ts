import { z } from "zod";
import { MetricCompare } from "@/lib/shared/enums";
import {
  audienceRowSchema,
  breakdownRowSchema,
  markSchema,
  planSummarySchema,
  topPostSchema,
} from "@/lib/shared/metrics/dto";
import { overviewSchema } from "@/lib/shared/metrics/compute";
import { HighlightTone } from "@/lib/shared/metrics/highlights";

export const MetricBlockKind = {
  Summary: "summary",
  Followers: "followers",
  Reach: "reach",
  Interactions: "interactions",
  TopPosts: "top_posts",
  Formats: "formats",
  Schedule: "schedule",
  Audience: "audience",
  Plan: "plan",
  Marks: "marks",
} as const;
export type MetricBlockKind = (typeof MetricBlockKind)[keyof typeof MetricBlockKind];

export const metricBlockLabels: Record<MetricBlockKind, string> = {
  [MetricBlockKind.Summary]: "Resumo do período",
  [MetricBlockKind.Followers]: "Crescimento de seguidores",
  [MetricBlockKind.Reach]: "Alcance e visualizações",
  [MetricBlockKind.Interactions]: "Interações",
  [MetricBlockKind.TopPosts]: "Melhores posts",
  [MetricBlockKind.Formats]: "O que funciona: formatos",
  [MetricBlockKind.Schedule]: "O que funciona: dia e horário",
  [MetricBlockKind.Audience]: "Audiência",
  [MetricBlockKind.Plan]: "Planejado e publicado",
  [MetricBlockKind.Marks]: "Marcas e anotações",
};

export const defaultReportBlocks: MetricBlockKind[] = [
  MetricBlockKind.Summary,
  MetricBlockKind.Followers,
  MetricBlockKind.Reach,
  MetricBlockKind.TopPosts,
  MetricBlockKind.Formats,
  MetricBlockKind.Marks,
];

export const reportBlockSchema = z.object({
  kind: z.nativeEnum(MetricBlockKind),
  title: z.string().trim().max(140).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export type ReportBlock = z.infer<typeof reportBlockSchema>;

export const analysisSchema = z.object({
  overview: overviewSchema,
  topPosts: z.array(topPostSchema),
  formats: z.array(breakdownRowSchema),
  weekdays: z.array(breakdownRowSchema),
  hours: z.array(breakdownRowSchema),
  audience: z.array(audienceRowSchema),
  plan: planSummarySchema,
  marks: z.array(markSchema),
});

export type Analysis = z.infer<typeof analysisSchema>;

export const highlightSnapshotSchema = z.object({
  id: z.string(),
  text: z.string(),
  tone: z.nativeEnum(HighlightTone),
});

export const reportSnapshotSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  account: z.object({ username: z.string(), followers: z.number().int().nullable() }),
  periodLabel: z.string(),
  compare: z.nativeEnum(MetricCompare),
  summary: z.string().nullable(),
  highlights: z.array(highlightSnapshotSchema),
  analysis: analysisSchema,
});

export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;

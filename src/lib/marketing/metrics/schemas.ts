import { z } from "zod";
import { MetricCompare, MetricGranularity, MetricMarkKind } from "@/lib/shared/enums";
import { reportBlockSchema } from "@/lib/shared/metrics/report";
import { PostRanking } from "@/lib/shared/metrics/ranking";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

export const analysisSchemaInput = z.object({
  brandId: z.string().uuid(),
  channelId: z.string().uuid(),
  from: day,
  to: day,
  compare: z.nativeEnum(MetricCompare),
  granularity: z.nativeEnum(MetricGranularity),
  rankBy: z.nativeEnum(PostRanking),
});

export const metricsSearchSchema = z.object({
  channel: z.string().uuid().optional(),
  preset: z.string().max(20).optional(),
  from: day.optional(),
  to: day.optional(),
  compare: z.nativeEnum(MetricCompare).optional(),
  rankBy: z.nativeEnum(PostRanking).optional(),
  view: z.string().max(20).optional(),
});

export const brandOnlySchema = z.object({ brandId: z.string().uuid() });

export const saveMarkSchema = z
  .object({
    id: z.string().uuid().optional(),
    brandId: z.string().uuid(),
    channelId: z.string().uuid().optional(),
    kind: z.nativeEnum(MetricMarkKind, { errorMap: () => ({ message: "Escolha o tipo." }) }),
    label: z.string().trim().min(2, "Descreva a marca.").max(140, "O texto é longo demais."),
    startsOn: day,
    endsOn: z.union([day, z.literal("")]).optional(),
    contentItemId: z.string().uuid().optional(),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
    path: ["endsOn"],
    message: "A data final não pode ser antes da inicial.",
  });

export const markIdSchema = z.object({ id: z.string().uuid() });

export const saveReportSchema = z
  .object({
    id: z.string().uuid().optional(),
    brandId: z.string().uuid(),
    channelId: z.string().uuid({ message: "Escolha o canal." }),
    periodStart: day,
    periodEnd: day,
    compareMode: z.nativeEnum(MetricCompare),
    title: z.string().trim().min(2, "Dê um título.").max(140, "O título é longo demais."),
    message: z.string().trim().max(2000, "A mensagem é longa demais.").optional(),
    nextSteps: z.array(z.string().trim().min(1).max(200)).max(5, "No máximo 5 itens."),
    blocks: z.array(reportBlockSchema).min(1, "Escolha ao menos um bloco.").max(20),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    path: ["periodEnd"],
    message: "A data final não pode ser antes da inicial.",
  });

export type SaveReportInput = z.infer<typeof saveReportSchema>;

export const reportIdSchema = z.object({ reportId: z.string().uuid() });

export const publishReportSchema = z.object({
  reportId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
});

export const reportRowSchema = z.object({
  id: z.string().uuid(),
  brand_id: z.string().uuid(),
  channel_id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  compare_mode: z.nativeEnum(MetricCompare),
  title: z.string(),
  message: z.string().nullable(),
  next_steps: z.array(z.string()),
  blocks: z.array(reportBlockSchema),
  status: z.string(),
  version: z.number().int(),
  previous_report_id: z.string().uuid().nullable(),
  published_at: z.string().nullable(),
  updated_at: z.string(),
});

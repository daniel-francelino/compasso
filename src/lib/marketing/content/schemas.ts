import { z } from "zod";
import {
  ApprovalStage,
  CommentVisibility,
  ContentFormat,
  ContentObjective,
  EditorialStatus,
} from "@/lib/shared/enums";
import { BRIEFING_FIELD_MAX } from "@/lib/marketing/content/briefing-fields";
import { listRequestSchema } from "@/lib/shared/list-search";
import { richDocSchema } from "@/lib/shared/rich-text/types";

export const ContentStatusFilter = { Active: "active", Cancelled: "cancelled" } as const;

export const ContentSort = { Deadline: "deadline", Updated: "updated", Title: "title" } as const;

export const MAX_CONTENT_CHANNELS = 20;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");
const reasonSchema = z
  .string()
  .trim()
  .min(3, "Informe o motivo (ao menos 3 letras).")
  .max(500, "O motivo é longo demais.");

export const listContentSchema = listRequestSchema.extend({
  brandId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  editorial: z.nativeEnum(EditorialStatus).optional(),
  publication: z.string().max(30).optional(),
  tag: z.string().trim().max(40).optional(),
});

export const boardSchema = z.object({
  brandId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().max(100).default(""),
});

export const mediaRefSchema = z.object({
  mediaVersionId: z.string().uuid(),
  altText: z.string().trim().max(300, "O texto alternativo é longo demais.").optional(),
});

export type MediaRef = z.infer<typeof mediaRefSchema>;

export const channelRowSchema = z.object({
  id: z.string().uuid().optional(),
  channelId: z.string().uuid({ message: "Escolha o canal." }),
  format: z.nativeEnum(ContentFormat, { errorMap: () => ({ message: "Escolha o formato." }) }),
  caption: z.string().max(5000, "A legenda é longa demais.").default(""),
  plannedAt: z.string().datetime({ offset: true }).nullable().optional(),
  plannedTimezone: z.string().trim().max(60).nullable().optional(),
});

export type ChannelRowInput = z.infer<typeof channelRowSchema>;

const briefingFieldSchema = z.string().trim().max(BRIEFING_FIELD_MAX, "O texto é longo demais.");

const briefingFieldsSchema = z.object({
  audience: briefingFieldSchema,
  keyMessage: briefingFieldSchema,
  creativeDirection: briefingFieldSchema,
  constraints: briefingFieldSchema,
});

export const saveContentSchema = z
  .object({
    id: z.string().uuid().optional(),
    brandId: z.string().uuid({ message: "Escolha a marca." }),
    title: z
      .string()
      .trim()
      .min(2, "O título precisa ter ao menos 2 letras.")
      .max(140, "O título é longo demais."),
    objectiveKind: z.nativeEnum(ContentObjective).nullable().optional(),
    objective: z.string().trim().max(2000, "O objetivo é longo demais.").optional(),
    briefing: richDocSchema.nullable().optional(),
    briefingFields: briefingFieldsSchema.optional(),
    internalNotes: z.string().trim().max(4000, "As notas são longas demais.").optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    productionDueDate: dateOnly.nullable().optional(),
    planSummary: richDocSchema.nullable().optional(),
    planMedia: z.array(mediaRefSchema).max(10, "No máximo 10 arquivos no planejamento."),
    caption: z.string().max(5000, "A legenda é longa demais.").default(""),
    callToAction: z.string().trim().max(300, "A chamada para ação é longa demais.").optional(),
    media: z.array(mediaRefSchema).max(20, "No máximo 20 arquivos."),
    channels: z.array(channelRowSchema).max(MAX_CONTENT_CHANNELS, "No máximo 20 canais."),
    sourceNote: z.string().uuid().optional(),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((value) => value.id === undefined || value.expectedVersion !== undefined, {
    message: "Recarregue a página para continuar.",
    path: ["expectedVersion"],
  });

export type SaveContentInput = z.infer<typeof saveContentSchema>;

export const idSchema = z.object({ id: z.string().uuid() });

export const cancelSchema = z.object({ id: z.string().uuid(), reason: reasonSchema });

export const reopenSchema = cancelSchema.extend({ scope: z.nativeEnum(ApprovalStage) });

export const approveOnBehalfSchema = z.object({
  id: z.string().uuid(),
  stage: z.nativeEnum(ApprovalStage),
  reason: z.string().trim().max(500, "O motivo é longo demais.").optional(),
  expectedVersion: z.number().int().min(1),
});

export const moveContentSchema = z.object({
  id: z.string().uuid(),
  to: z.nativeEnum(EditorialStatus),
  expectedVersion: z.number().int().min(1),
});

export const publishContentSchema = z.object({
  id: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
});

export const submitSchema = z.object({
  id: z.string().uuid(),
  dueDate: dateOnly.nullable().optional(),
  message: z.string().trim().max(1000, "A mensagem é longa demais.").optional(),
  expectedVersion: z.number().int().min(1),
});

export type SubmitInput = z.infer<typeof submitSchema>;

export const publishSchema = z.object({
  id: z.string().uuid(),
  publishedAt: z.string().datetime({ offset: true, message: "Informe a data e a hora." }),
  url: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .url("Informe um link válido.")
        .startsWith("https://", "O link precisa começar com https://"),
    ])
    .optional(),
  evidenceVersionId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(1000, "A nota é longa demais.").optional(),
});

export type PublishInput = z.infer<typeof publishSchema>;

export const commentSchema = z.object({
  itemId: z.string().uuid(),
  visibility: z.nativeEnum(CommentVisibility),
  body: z.string().trim().min(1, "Escreva o comentário.").max(4000, "O comentário é longo demais."),
});

export const commentIdSchema = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

export const brandIdSchema = z.object({ brandId: z.string().uuid() });

export const itemIdSchema = z.object({ itemId: z.string().uuid() });

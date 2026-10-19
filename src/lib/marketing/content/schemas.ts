import { z } from "zod";
import { CommentVisibility, ContentFormat, EditorialStatus } from "@/lib/shared/enums";
import { listRequestSchema } from "@/lib/shared/list-search";
import { richDocSchema } from "@/lib/shared/rich-text/types";

export const ContentStatusFilter = { Active: "active", Cancelled: "cancelled" } as const;

export const ContentSort = { Deadline: "deadline", Updated: "updated", Title: "title" } as const;

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

export const saveItemSchema = z.object({
  id: z.string().uuid().optional(),
  brandId: z.string().uuid({ message: "Escolha a marca." }),
  title: z
    .string()
    .trim()
    .min(2, "O título precisa ter ao menos 2 letras.")
    .max(140, "O título é longo demais."),
  objective: z.string().trim().max(2000, "O objetivo é longo demais.").optional(),
  briefing: richDocSchema.nullable().optional(),
  internalNotes: z.string().trim().max(4000, "As notas são longas demais.").optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  productionDueDate: dateOnly.nullable().optional(),
  expectedVersion: z.number().int().min(1).optional(),
});

export type SaveItemInput = z.infer<typeof saveItemSchema>;

export const idSchema = z.object({ id: z.string().uuid() });

export const cancelSchema = z.object({ id: z.string().uuid(), reason: reasonSchema });

export const mediaRefSchema = z.object({
  mediaVersionId: z.string().uuid(),
  altText: z.string().trim().max(300, "O texto alternativo é longo demais.").optional(),
});

export type MediaRef = z.infer<typeof mediaRefSchema>;

export const saveVariantSchema = z
  .object({
    id: z.string().uuid().optional(),
    contentItemId: z.string().uuid(),
    channelId: z.string().uuid({ message: "Escolha o canal." }),
    format: z.nativeEnum(ContentFormat, { errorMap: () => ({ message: "Escolha o formato." }) }),
    caption: z.string().max(5000, "A legenda é longa demais.").default(""),
    callToAction: z.string().trim().max(300, "A chamada para ação é longa demais.").optional(),
    plannedAt: z.string().datetime({ offset: true }).nullable().optional(),
    plannedTimezone: z.string().trim().max(60).nullable().optional(),
    approvalDueDate: dateOnly.nullable().optional(),
    media: z.array(mediaRefSchema).max(20, "No máximo 20 arquivos."),
    expectedVersion: z.number().int().min(1).optional(),
  })
  .refine((value) => value.id === undefined || value.expectedVersion !== undefined, {
    message: "Recarregue a página para continuar.",
    path: ["expectedVersion"],
  });

export type SaveVariantInput = z.infer<typeof saveVariantSchema>;

export const moveVariantSchema = z.object({
  id: z.string().uuid(),
  to: z.nativeEnum(EditorialStatus),
  expectedVersion: z.number().int().min(1),
});

export const submitSchema = z.object({
  id: z.string().uuid(),
  approverId: z.string().uuid({ message: "Escolha quem vai aprovar." }),
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
  variantId: z.string().uuid(),
  visibility: z.nativeEnum(CommentVisibility),
  body: z.string().trim().min(1, "Escreva o comentário.").max(4000, "O comentário é longo demais."),
});

export const commentIdSchema = z.object({ id: z.string().uuid(), variantId: z.string().uuid() });

export const brandIdSchema = z.object({ brandId: z.string().uuid() });

export const variantIdSchema = z.object({ variantId: z.string().uuid() });

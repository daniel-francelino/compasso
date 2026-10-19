import { z } from "zod";
import { listRequestSchema } from "@/lib/shared/list-search";

export const ClientStatusFilter = { Active: "active", Archived: "archived" } as const;
export const CLIENT_TAG_LIMIT = 20;
export const CLIENT_TAG_LENGTH = 40;

export const listClientsSchema = listRequestSchema.extend({
  ownerId: z.string().uuid().optional(),
  tag: z.string().trim().max(40).optional(),
});

export const saveClientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter ao menos 2 letras.")
    .max(120, "O nome é longo demais."),
  ownerUserId: z.string().uuid().nullable().optional(),
  internalNotes: z.string().trim().max(5000, "As notas são longas demais.").optional(),
  tags: z.array(z.string().trim().min(1).max(CLIENT_TAG_LENGTH)).max(CLIENT_TAG_LIMIT),
  expectedVersion: z.number().int().min(1).optional(),
});

export type SaveClientInput = z.infer<typeof saveClientSchema>;

export const clientIdSchema = z.object({ id: z.string().uuid() });

export const archiveClientSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
  archiveBrands: z.boolean().default(false),
});

export const similarClientsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  excludeId: z.string().uuid().optional(),
});

export const saveContactSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome.").max(120, "O nome é longo demais."),
  email: z
    .union([z.literal(""), z.string().trim().email("Informe um e-mail válido.").max(254)])
    .optional(),
  phone: z.string().trim().max(40, "O telefone é longo demais.").optional(),
  roleTitle: z.string().trim().max(80, "O cargo é longo demais.").optional(),
  isPrimary: z.boolean(),
});

export type SaveContactInput = z.infer<typeof saveContactSchema>;

export const contactIdSchema = z.object({ id: z.string().uuid() });

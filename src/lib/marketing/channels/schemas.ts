import { z } from "zod";
import { Platform } from "@/lib/shared/enums";

export const ChannelStatusFilter = { Active: "active", Archived: "archived" } as const;

export const listChannelsSchema = z.object({
  brandId: z.string().uuid(),
  status: z.string().max(40).optional(),
  platform: z.nativeEnum(Platform).optional(),
});

export const saveChannelSchema = z.object({
  id: z.string().uuid().optional(),
  brandId: z.string().uuid(),
  platform: z.nativeEnum(Platform, { errorMap: () => ({ message: "Escolha a plataforma." }) }),
  profileName: z
    .string()
    .trim()
    .min(1, "Informe o nome do perfil.")
    .max(120, "O nome é longo demais."),
  profileUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .url("Informe um link válido.")
        .startsWith("https://", "O link precisa começar com https://"),
    ])
    .optional(),
  externalId: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  expectedVersion: z.number().int().min(1).optional(),
});

export type SaveChannelInput = z.infer<typeof saveChannelSchema>;

export const channelIdSchema = z.object({ id: z.string().uuid() });

export const archiveChannelSchema = z.object({ id: z.string().uuid(), archived: z.boolean() });

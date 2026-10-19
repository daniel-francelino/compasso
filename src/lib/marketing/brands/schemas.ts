import { z } from "zod";
import { BrandMemberStatus, Platform, ProfileKind } from "@/lib/shared/enums";
import { listRequestSchema } from "@/lib/shared/list-search";

export const BrandStatusFilter = { Active: "active", Archived: "archived" } as const;

export const listBrandsSchema = listRequestSchema.extend({
  clientId: z.string().uuid().optional(),
  platform: z.nativeEnum(Platform).optional(),
});

export const visualIdentitySchema = z.object({
  colors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(12)
    .default([]),
  fonts: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  guidelinesUrl: z.union([z.literal(""), z.string().url().startsWith("https://")]).default(""),
});

export type VisualIdentity = z.infer<typeof visualIdentitySchema>;

export const saveBrandSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid("Escolha o cliente."),
  name: z
    .string()
    .trim()
    .min(2, "O nome precisa ter ao menos 2 letras.")
    .max(120, "O nome é longo demais."),
  description: z.string().trim().max(2000).optional(),
  targetAudience: z.string().trim().max(2000).optional(),
  toneOfVoice: z.string().trim().max(2000).optional(),
  objectives: z.string().trim().max(2000).optional(),
  referencesNotes: z.string().trim().max(4000).optional(),
  visualIdentity: visualIdentitySchema.optional(),
  timezone: z.string().trim().min(1, "Escolha o fuso horário.").max(60),
  expectedVersion: z.number().int().min(1).optional(),
});

export type SaveBrandInput = z.infer<typeof saveBrandSchema>;

export const brandIdSchema = z.object({ id: z.string().uuid() });

export const setBrandLogoSchema = z.object({
  brandId: z.string().uuid(),
  versionId: z.string().uuid().nullable(),
});

export const archiveBrandSchema = z.object({ id: z.string().uuid(), archived: z.boolean() });

export const setMemberSchema = z.object({
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  kind: z.nativeEnum(ProfileKind),
  canDecide: z.boolean(),
  status: z.nativeEnum(BrandMemberStatus),
});

export const memberCandidatesSchema = z.object({
  brandId: z.string().uuid(),
  search: z.string().max(100).default(""),
});

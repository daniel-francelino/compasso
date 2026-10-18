import { z } from "zod";
import { jsonSchema } from "@/lib/shared/content/published";
import { settingsSchemas } from "@/lib/shared/content/schemas";
import {
  ContactMessageStatus,
  SiteEntryKind,
  SitePageKind,
  SiteSettingsGroup,
} from "@/lib/shared/enums";

export const pageIdSchema = z.object({ pageId: z.string().uuid() });

const slugField = z
  .string()
  .trim()
  .max(120)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/,
    "Use letras minúsculas, números e hífens (separe níveis com /).",
  );

export const createPageSchema = z.object({
  kind: z.nativeEnum(SitePageKind),
  slug: slugField,
  title: z.string().trim().min(1, "Informe o título.").max(120),
});

export const savePageSchema = z.object({
  pageId: z.string().uuid(),
  slug: slugField.or(z.literal("")),
  kind: z.nativeEnum(SitePageKind),
  draft: z.record(jsonSchema),
  expectedVersion: z.number().int().min(1),
});

export const publishPageSchema = z.object({
  pageId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});

export const rollbackSchema = z.object({
  pageId: z.string().uuid(),
  revisionId: z.string().uuid(),
});

export const entryKindSchema = z.object({ kind: z.nativeEnum(SiteEntryKind) });

export const saveEntrySchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.nativeEnum(SiteEntryKind),
  content: z.record(jsonSchema),
  sortOrder: z.number().int().min(0).max(10000),
  visible: z.boolean(),
  version: z.number().int().min(1).optional(),
});

export const entryIdSchema = z.object({ id: z.string().uuid() });

export const saveSettingsSchema = z.object({
  group: z.nativeEnum(SiteSettingsGroup),
  value: z.record(jsonSchema),
  expectedVersion: z.number().int().min(1),
});

export const publishSettingsSchema = z.object({ expectedVersion: z.number().int().min(1) });

export const redirectSchema = z.object({
  from: z
    .string()
    .trim()
    .regex(/^\/[^ ]*$/, "Comece o endereço com /."),
  to: z
    .string()
    .trim()
    .regex(/^(\/[^ ]*|https:\/\/[^ ]+)$/, "Informe um endereço com / ou https://."),
  permanent: z.boolean(),
});

export const authorizeSchema = z.object({
  pageId: z.string().uuid(),
  brandId: z.string().uuid(),
  consentNote: z.string().trim().min(5, "Descreva o consentimento.").max(1000),
});

export const messagesQuerySchema = z.object({
  status: z.nativeEnum(ContactMessageStatus).optional(),
  page: z.number().int().min(1).max(10000).default(1),
});

export const updateMessageSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(ContactMessageStatus),
  note: z.string().trim().max(1000).optional(),
});

export const groupSchemaOf = (group: SiteSettingsGroup) => settingsSchemas[group];

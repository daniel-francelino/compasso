import { z } from "zod";
import { MediaScope } from "@/lib/shared/enums";
import { listRequestSchema } from "@/lib/shared/list-search";
import { MEDIA_MIME_TYPES, MediaKind } from "@/lib/shared/media/limits";

export const MediaStatusFilter = { Active: "active", Trash: "trash" } as const;

export const MediaSort = {
  Newest: "newest",
  Oldest: "oldest",
  Name: "name",
  Size: "size",
} as const;

export const MediaVariant = { Thumb: "thumb", Display: "display", Original: "original" } as const;
export type MediaVariant = (typeof MediaVariant)[keyof typeof MediaVariant];

export const requestUploadSchema = z.object({
  scope: z.nativeEnum(MediaScope),
  brandId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  filename: z.string().trim().min(1).max(200),
  size: z.number().int().positive(),
  mime: z
    .string()
    .max(100)
    .refine((value) => (MEDIA_MIME_TYPES as readonly string[]).includes(value), {
      message: "Este tipo de arquivo não é aceito.",
    }),
  idempotencyKey: z.string().min(8).max(100),
});

export const confirmUploadSchema = z.object({
  versionId: z.string().uuid(),
  width: z.number().int().min(1).max(100000).optional(),
  height: z.number().int().min(1).max(100000).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
});

export const abortUploadSchema = z.object({ versionId: z.string().uuid() });

export const listMediaSchema = listRequestSchema.extend({
  scope: z.nativeEnum(MediaScope).optional(),
  brandId: z.string().uuid().optional(),
  kind: z.nativeEnum(MediaKind).optional(),
  collectionId: z.string().uuid().optional(),
  order: z.nativeEnum(MediaSort).default(MediaSort.Newest),
});

export const assetIdSchema = z.object({ id: z.string().uuid() });

export const updateMediaSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().trim().min(1, "Informe o nome.").max(200, "O nome é longo demais."),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  expectedVersion: z.number().int().min(1),
});

export const trashMediaSchema = z.object({ id: z.string().uuid(), trashed: z.boolean() });

export const replaceVersionSchema = z.object({
  assetId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const signMediaSchema = z.object({
  versionIds: z.array(z.string().uuid()).min(1).max(60),
  variant: z.nativeEnum(MediaVariant),
  downloadName: z.string().max(200).optional(),
});

export const listCollectionsSchema = z.object({
  scope: z.nativeEnum(MediaScope),
  brandId: z.string().uuid().optional(),
});

export const saveCollectionSchema = z.object({
  id: z.string().uuid().optional(),
  scope: z.nativeEnum(MediaScope),
  brandId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Informe o nome da pasta.").max(80, "O nome é longo demais."),
});

export const collectionIdSchema = z.object({ id: z.string().uuid() });

export const moveToCollectionSchema = z.object({
  collectionId: z.string().uuid().nullable(),
  assetIds: z.array(z.string().uuid()).min(1).max(200),
});

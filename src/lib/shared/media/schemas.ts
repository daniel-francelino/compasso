import { z } from "zod";
import { MediaScope, ShareKind, SharePasswordAction } from "@/lib/shared/enums";
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
  kinds: z.array(z.nativeEnum(MediaKind)).min(1).max(3).optional(),
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

export const shareLabelSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do link.")
  .max(80, "O nome é longo demais.");
export const shareMessageSchema = z.string().trim().max(500, "A mensagem é longa demais.");
export const sharePasswordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(128, "A senha é longa demais.");

const shareOptionsShape = {
  label: shareLabelSchema,
  message: shareMessageSchema.optional(),
  expiresAt: z.string().datetime().nullable(),
  maxDownloads: z.number().int().min(1).max(10000).nullable(),
  allowDownload: z.boolean(),
};

export const createShareSchema = z.object({
  kind: z.nativeEnum(ShareKind),
  targetId: z.string().uuid(),
  ...shareOptionsShape,
  password: sharePasswordSchema.optional(),
  includeSubcollections: z.boolean().optional(),
  followLatest: z.boolean().optional(),
});

export const updateShareSchema = z.object({
  id: z.string().uuid(),
  ...shareOptionsShape,
  passwordAction: z.nativeEnum(SharePasswordAction),
  password: sharePasswordSchema.optional(),
});

export const shareIdSchema = z.object({ id: z.string().uuid() });

export const listSharesSchema = z.object({
  kind: z.nativeEnum(ShareKind),
  targetId: z.string().uuid(),
});

export const shareTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const openSharedSchema = z.object({
  token: shareTokenSchema,
  grant: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});

export const unlockSharedSchema = z.object({
  token: shareTokenSchema,
  password: z.string().min(1, "Informe a senha.").max(128),
});

export const sharedFileSchema = z.object({
  token: shareTokenSchema,
  grant: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  assetId: z.string().uuid(),
  download: z.boolean(),
});

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { PublicShareState } from "@/lib/shared/enums";
import { INTERNAL_URL_SECONDS } from "@/lib/shared/media/limits";
import { openSharedSchema, sharedFileSchema, unlockSharedSchema } from "@/lib/shared/media/schemas";
import { createRateLimiter } from "@/lib/shared/rate-limit.server";
import { type Result, fail, parseOutput } from "@/lib/shared/server-utils";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import { anonClient } from "@/lib/shared/supabase/anon.server";

export type SharedFile = {
  assetId: string;
  title: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
};

export type SharedView = {
  state: PublicShareState;
  label: string;
  message: string | null;
  allowDownload: boolean;
  files: SharedFile[];
};

const withinUnlockLimit = createRateLimiter(10, 10 * 60 * 1000);

const clientIp = (): string =>
  (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";

const openSchema = z.object({
  state: z.nativeEnum(PublicShareState),
  label: z.string().optional(),
  message: z.string().nullable().optional(),
  allow_download: z.boolean().optional(),
  files: z
    .array(
      z.object({
        asset_id: z.string().uuid(),
        title: z.string(),
        filename: z.string(),
        mime: z.string(),
        size_bytes: z.number(),
        width: z.number().nullable(),
        height: z.number().nullable(),
        has_preview: z.boolean(),
      }),
    )
    .optional(),
});

const unlockSchema = z.object({
  state: z.nativeEnum(PublicShareState),
  grant: z.string().nullable().optional(),
});

const fileSchema = z.object({
  state: z.nativeEnum(PublicShareState),
  thumb_key: z.string().nullable().optional(),
  display_key: z.string().nullable().optional(),
  storage_key: z.string().optional(),
  filename: z.string().optional(),
});

const SHARED_PREVIEW_SECONDS = 300;

export const openSharedMedia = createServerFn({ method: "GET" })
  .validator(openSharedSchema)
  .handler(async ({ data }): Promise<Result<SharedView>> => {
    const { data: row, error } = await anonClient().rpc("media_share_public_open", {
      p_token: data.token,
      p_grant: data.grant,
    });
    if (error) return fail(error);
    const parsed = parseOutput(openSchema, row);
    if (!parsed.ok) return parsed;
    const base = {
      state: parsed.state,
      label: parsed.label ?? "",
      message: parsed.message ?? null,
      allowDownload: parsed.allow_download ?? false,
    };
    if (parsed.state !== PublicShareState.Ok) return { ok: true, ...base, files: [] };

    const storage = serverStorage();
    const files = parsed.files ?? [];
    const previews = new Map<string, string | null>();
    if (storage !== null) {
      await Promise.all(
        files
          .filter((file) => file.has_preview)
          .slice(0, 60)
          .map(async (file) => {
            const { data: view } = await anonClient().rpc("media_share_public_file", {
              p_token: data.token,
              p_grant: data.grant,
              p_asset: file.asset_id,
              p_mode: "view",
            });
            const key = fileSchema.safeParse(view);
            const thumb = key.success ? key.data.thumb_key : null;
            if (!thumb) return;
            const signed = await storage.signUrls([thumb], SHARED_PREVIEW_SECONDS);
            previews.set(file.asset_id, signed.get(thumb) ?? null);
          }),
      );
    }
    return {
      ok: true,
      ...base,
      files: files.map((file) => ({
        assetId: file.asset_id,
        title: file.title,
        filename: file.filename,
        mime: file.mime,
        sizeBytes: file.size_bytes,
        width: file.width,
        height: file.height,
        previewUrl: previews.get(file.asset_id) ?? null,
      })),
    };
  });

export const unlockSharedMedia = createServerFn({ method: "POST" })
  .validator(unlockSharedSchema)
  .handler(async ({ data }): Promise<Result<{ state: PublicShareState; grant: string | null }>> => {
    const ip = clientIp();
    if (!withinUnlockLimit(ip === "" ? "unknown" : ip)) {
      return { ok: true, state: PublicShareState.Locked, grant: null };
    }
    const { data: row, error } = await anonClient().rpc("media_share_public_unlock", {
      p_token: data.token,
      p_password: data.password,
    });
    if (error) return fail(error);
    const parsed = parseOutput(unlockSchema, row);
    if (!parsed.ok) return parsed;
    return { ok: true, state: parsed.state, grant: parsed.grant ?? null };
  });

export const getSharedFileUrl = createServerFn({ method: "POST" })
  .validator(sharedFileSchema)
  .handler(async ({ data }): Promise<Result<{ state: PublicShareState; url: string | null }>> => {
    const { data: row, error } = await anonClient().rpc("media_share_public_file", {
      p_token: data.token,
      p_grant: data.grant,
      p_asset: data.assetId,
      p_mode: data.download ? "download" : "view",
    });
    if (error) return fail(error);
    const parsed = parseOutput(fileSchema, row);
    if (!parsed.ok) return parsed;
    if (parsed.state !== PublicShareState.Ok) {
      return { ok: true, state: parsed.state, url: null };
    }
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });
    const key = data.download ? parsed.storage_key : (parsed.display_key ?? parsed.storage_key);
    if (key === undefined) return { ok: true, state: PublicShareState.NotFound, url: null };
    const signed = await storage.signUrls(
      [key],
      INTERNAL_URL_SECONDS,
      data.download ? parsed.filename : undefined,
    );
    return { ok: true, state: PublicShareState.Ok, url: signed.get(key) ?? null };
  });

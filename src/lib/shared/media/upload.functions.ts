import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer, requireApprovedServer } from "@/lib/shared/auth/server-guards.server";
import { MediaScope } from "@/lib/shared/enums";
import {
  abortUploadSchema,
  confirmUploadSchema,
  requestUploadSchema,
} from "@/lib/shared/media/schemas";
import { validateUploadedVersion } from "@/lib/shared/media/validate-upload.server";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import type { UploadTarget } from "@/lib/shared/storage/types";

const requestedSchema = z.object({
  asset_id: z.string().uuid(),
  version_id: z.string().uuid(),
  storage_key: z.string(),
  thumb_key: z.string().nullable(),
  display_key: z.string().nullable(),
  kind: z.string(),
});

const confirmedSchema = z.object({ asset_id: z.string().uuid(), version_id: z.string().uuid() });
const failedSchema = z.object({ keys: z.array(z.string()) });

export type UploadPlan = {
  assetId: string;
  versionId: string;
  kind: string;
  original: UploadTarget;
  thumb: UploadTarget | null;
  display: UploadTarget | null;
};

export const requestUpload = createServerFn({ method: "POST" })
  .validator(requestUploadSchema)
  .handler(async ({ data }): Promise<Result<UploadPlan>> => {
    const caller =
      data.scope === MediaScope.Profile
        ? await requireApprovedServer()
        : await requireActionServer(Action.Media.Upload);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const { data: row, error } = await caller.supabase.rpc("media_request_upload", {
      p_scope: data.scope,
      p_brand: data.brandId ?? null,
      p_filename: data.filename,
      p_size: data.size,
      p_mime: data.mime,
      p_idempotency_key: data.idempotencyKey,
      p_asset: data.assetId ?? null,
    });
    if (error) return fail(error);
    const requested = parseOutput(requestedSchema, row);
    if (!requested.ok) return requested;

    const [original, thumb, display] = await Promise.all([
      storage.createUploadTarget(requested.storage_key),
      requested.thumb_key === null ? null : storage.createUploadTarget(requested.thumb_key),
      requested.display_key === null ? null : storage.createUploadTarget(requested.display_key),
    ]);
    const missing =
      original === null ||
      (requested.thumb_key !== null && thumb === null) ||
      (requested.display_key !== null && display === null);
    if (missing) {
      await caller.supabase.rpc("media_mark_failed", {
        p_version: requested.version_id,
        p_reason: "storage_unavailable",
      });
      return fail({ message: "storage_unavailable" });
    }
    return {
      ok: true,
      assetId: requested.asset_id,
      versionId: requested.version_id,
      kind: requested.kind,
      original,
      thumb,
      display,
    };
  });

const discard = async (
  caller: NonNullable<Awaited<ReturnType<typeof requireActionServer>>>,
  versionId: string,
  reason: string,
) => {
  const storage = serverStorage();
  const { data } = await caller.supabase.rpc("media_mark_failed", {
    p_version: versionId,
    p_reason: reason,
  });
  const keys = failedSchema.safeParse(data);
  if (storage !== null && keys.success) await storage.remove(keys.data.keys);
};

export const confirmUpload = createServerFn({ method: "POST" })
  .validator(confirmUploadSchema)
  .handler(async ({ data }): Promise<Result<{ assetId: string; versionId: string }>> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const { data: version, error: readError } = await caller.supabase
      .from("media_versions")
      .select("storage_key, thumb_key, display_key, mime_type, size_bytes, status")
      .eq("id", data.versionId)
      .maybeSingle();
    if (readError) return fail(readError);
    if (version === null) return fail({ message: "not_found" });

    const validation = await validateUploadedVersion(storage, {
      storageKey: version.storage_key,
      thumbKey: version.thumb_key,
      displayKey: version.display_key,
      mimeType: version.mime_type,
      sizeBytes: version.size_bytes,
    });
    if (!validation.ok) {
      await discard(caller, data.versionId, validation.code);
      return fail({ message: validation.code });
    }

    const { data: row, error } = await caller.supabase.rpc("media_confirm_upload", {
      p_version: data.versionId,
      p_checksum: validation.checksum,
      p_width: validation.width ?? data.width ?? null,
      p_height: validation.height ?? data.height ?? null,
      p_duration: data.durationMs ?? null,
      p_derivative_bytes: validation.derivativeBytes,
    });
    if (error) {
      await discard(caller, data.versionId, error.message);
      return fail(error);
    }
    const confirmed = parseOutput(confirmedSchema, row);
    return confirmed.ok
      ? { ok: true, assetId: confirmed.asset_id, versionId: confirmed.version_id }
      : confirmed;
  });

export const abortUpload = createServerFn({ method: "POST" })
  .validator(abortUploadSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireApprovedServer();
    if (caller === null) return denied;
    await discard(caller, data.versionId, "aborted");
    return { ok: true };
  });

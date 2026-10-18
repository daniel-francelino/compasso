import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { publicKeys } from "@/lib/shared/content/media-urls";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";

const versionSchema = z.object({ versionId: z.string().uuid() });

const publishedSchema = z.object({
  checksum: z.string(),
  thumb_key: z.string(),
  display_key: z.string(),
});

const withdrawnSchema = z.object({ checksum: z.string().nullable() });

export const publishMedia = createServerFn({ method: "POST" })
  .validator(versionSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Publish);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });
    const { data: row, error } = await caller.supabase.rpc("media_publish_derivative", {
      p_version: data.versionId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(publishedSchema, row);
    if (!parsed.ok) return parsed;
    const keys = publicKeys(parsed.checksum);
    const small = await storage.copyToPublic(parsed.thumb_key, keys.small);
    const large = small.ok ? await storage.copyToPublic(parsed.display_key, keys.large) : small;
    if (large.ok) return { ok: true };
    await caller.supabase.rpc("media_withdraw_derivative", { p_version: data.versionId });
    return fail({ message: "storage_unavailable" });
  });

export const withdrawMedia = createServerFn({ method: "POST" })
  .validator(versionSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Publish);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });
    const { data: row, error } = await caller.supabase.rpc("media_withdraw_derivative", {
      p_version: data.versionId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(withdrawnSchema, row);
    if (!parsed.ok) return parsed;
    if (parsed.checksum === null) return { ok: true };
    const { count } = await caller.supabase
      .from("media_versions")
      .select("id", { count: "exact", head: true })
      .eq("checksum", parsed.checksum)
      .not("public_published_at", "is", null);
    if ((count ?? 0) > 0) return { ok: true };
    const keys = publicKeys(parsed.checksum);
    const removed = await storage.removePublic([keys.small, keys.large]);
    return removed.ok ? { ok: true } : fail({ message: "storage_unavailable" });
  });

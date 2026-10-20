import { z } from "zod";
import { logError } from "@/lib/shared/logger";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const keysSchema = z.object({ keys: z.array(z.string()) });
const purgeSchema = z.array(z.object({ id: z.string().uuid(), keys: z.array(z.string()) }));

export const cleanupExpiredUploads = async (): Promise<{ expiredObjects: number; ok: boolean }> => {
  const storage = serverStorage();
  const { data, error } = await adminClient().rpc("media_expire_sessions");
  if (error) {
    logError("media cleanup: expire sessions failed", error.code);
    return { expiredObjects: 0, ok: false };
  }
  const keys = keysSchema.safeParse(data);
  if (!keys.success) return { expiredObjects: 0, ok: false };
  if (storage === null || keys.data.keys.length === 0) {
    return { expiredObjects: 0, ok: storage !== null };
  }
  const removed = await storage.remove(keys.data.keys);
  return { expiredObjects: keys.data.keys.length, ok: removed.ok };
};

export const purgePublishedMedia = async (): Promise<{ purged: number; ok: boolean }> => {
  const storage = serverStorage();
  if (storage === null) return { purged: 0, ok: false };
  const client = adminClient();
  const { data, error } = await client.rpc("media_purge_pending");
  if (error) {
    logError("media purge: listing failed", error.code);
    return { purged: 0, ok: false };
  }
  const pending = purgeSchema.safeParse(data);
  if (!pending.success) return { purged: 0, ok: false };
  if (pending.data.length === 0) return { purged: 0, ok: true };
  const removed = await storage.remove(pending.data.flatMap((item) => item.keys));
  if (!removed.ok) return { purged: 0, ok: false };
  const { data: confirmed, error: confirmError } = await client.rpc("media_purge_confirm", {
    p_ids: pending.data.map((item) => item.id),
  });
  if (confirmError) {
    logError("media purge: confirmation failed", confirmError.code);
    return { purged: 0, ok: false };
  }
  return { purged: typeof confirmed === "number" ? confirmed : 0, ok: true };
};

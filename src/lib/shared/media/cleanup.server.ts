import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { logError } from "@/lib/shared/logger";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const keysSchema = z.object({ keys: z.array(z.string()) });

export const isAuthorizedCron = (header: string | null): boolean => {
  const secret = process.env["CRON_SECRET"];
  if (!secret || header === null) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

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

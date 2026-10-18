import { z } from "zod";
import { logError } from "@/lib/shared/logger";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const summarySchema = z.object({
  scanners: z.number().int(),
  failed: z.number().int(),
  deleted: z.number().int(),
});

export type DueNotificationsResult = {
  ok: boolean;
  scanners: number;
  failed: number;
  deleted: number;
};

export const runDueNotifications = async (): Promise<DueNotificationsResult> => {
  const { data, error } = await adminClient().rpc("generate_due_notifications");
  const parsed = summarySchema.safeParse(data);
  if (error || !parsed.success) {
    logError("due notifications: the scheduled scan failed", error?.code ?? "invalid_output");
    return { ok: false, scanners: 0, failed: 0, deleted: 0 };
  }
  return { ok: parsed.data.failed === 0, ...parsed.data };
};

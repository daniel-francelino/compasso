import { z } from "zod";
import { instagramConfig } from "@/lib/shared/env.server";
import {
  markConnectionLost,
  readConnectionSecret,
} from "@/lib/shared/jobs/connection-token.server";
import { logError } from "@/lib/shared/logger";
import { refreshToken } from "@/lib/shared/social/instagram.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { encryptToken } from "@/lib/shared/social/token-crypto.server";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const RENEW_WITHIN_DAYS = 15;
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;
const WARN_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

const dueSchema = z.array(
  z.object({
    channel_id: z.string().uuid(),
    token_expires_at: z.string(),
    last_refreshed_at: z.string().nullable(),
  }),
);

export type RenewalResult = { ok: boolean; skipped: boolean; renewed: number; failed: number };

export const runChannelRenewal = async (): Promise<RenewalResult> => {
  const config = instagramConfig();
  if (config === null) return { ok: true, skipped: true, renewed: 0, failed: 0 };
  const admin = adminClient();
  const { data, error } = await admin.rpc("channel_connections_to_renew", {
    p_within_days: RENEW_WITHIN_DAYS,
  });
  const due = dueSchema.safeParse(data);
  if (error || !due.success) {
    logError("channel renewal: could not list connections", error?.code ?? "invalid_output");
    return { ok: false, skipped: false, renewed: 0, failed: 0 };
  }

  const result: RenewalResult = { ok: true, skipped: false, renewed: 0, failed: 0 };
  for (const connection of due.data) {
    const refreshedAt = connection.last_refreshed_at ? Date.parse(connection.last_refreshed_at) : 0;
    if (Date.now() - refreshedAt < MIN_TOKEN_AGE_MS) continue;
    const secret = await readConnectionSecret(admin, config, connection.channel_id);
    if (!secret.ok) {
      await markConnectionLost(admin, connection.channel_id);
      result.failed += 1;
      continue;
    }
    const refreshed = await refreshToken(secret.secret.token);
    const sealed = refreshed.ok ? encryptToken(refreshed.data.token, config.tokenKey) : null;
    if (refreshed.ok && sealed !== null) {
      await admin.rpc("channel_connection_renewed", {
        p_channel: connection.channel_id,
        p_token_encrypted: sealed,
        p_expires_at: refreshed.data.expiresAt.toISOString(),
      });
      result.renewed += 1;
      continue;
    }
    result.failed += 1;
    if (!refreshed.ok && refreshed.code === PublishErrorCode.ConnectionExpired) {
      await markConnectionLost(admin, connection.channel_id);
      continue;
    }
    const expiresIn = Date.parse(connection.token_expires_at) - Date.now();
    if (expiresIn < WARN_WITHIN_MS) {
      await admin.rpc("channel_connection_failed", {
        p_channel: connection.channel_id,
        p_status: "expiring",
        p_code: PublishErrorCode.Unavailable,
      });
    }
  }
  result.ok = result.failed === 0;
  return result;
};

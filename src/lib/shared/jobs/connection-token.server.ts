import { z } from "zod";
import type { InstagramConfig } from "@/lib/shared/env.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { decryptToken } from "@/lib/shared/social/token-crypto.server";
import type { adminClient } from "@/lib/shared/supabase/admin.server";

export type AdminClient = ReturnType<typeof adminClient>;

const secretSchema = z.object({
  channel_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  external_account_id: z.string().min(1),
  token_encrypted: z.string().min(1),
  token_expires_at: z.string(),
  status: z.string(),
  collect_metrics: z.boolean(),
});

export type ConnectionSecret = {
  channelId: string;
  brandId: string;
  accountId: string;
  token: string;
  expiresAt: string;
  collectMetrics: boolean;
};

export type SecretResult =
  { ok: true; secret: ConnectionSecret } | { ok: false; code: PublishErrorCode };

export const readConnectionSecret = async (
  admin: AdminClient,
  config: InstagramConfig,
  channelId: string,
): Promise<SecretResult> => {
  const { data, error } = await admin.rpc("channel_connection_secret", { p_channel: channelId });
  const parsed = secretSchema.safeParse(data);
  if (error || !parsed.success) return { ok: false, code: PublishErrorCode.ConnectionMissing };
  const token = decryptToken(parsed.data.token_encrypted, config.tokenKey);
  if (token === null) return { ok: false, code: PublishErrorCode.ConnectionExpired };
  return {
    ok: true,
    secret: {
      channelId: parsed.data.channel_id,
      brandId: parsed.data.brand_id,
      accountId: parsed.data.external_account_id,
      token,
      expiresAt: parsed.data.token_expires_at,
      collectMetrics: parsed.data.collect_metrics,
    },
  };
};

export const markConnectionLost = async (admin: AdminClient, channelId: string): Promise<void> => {
  await admin.rpc("channel_connection_failed", {
    p_channel: channelId,
    p_status: "expired",
    p_code: PublishErrorCode.ConnectionExpired,
  });
};

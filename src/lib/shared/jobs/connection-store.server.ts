import { z } from "zod";
import { type Result, fail, parseOutput } from "@/lib/shared/server-utils";
import { adminClient } from "@/lib/shared/supabase/admin.server";
import { toIso } from "@/lib/shared/dates";

const storedSchema = z.object({ channel_id: z.string().uuid(), brand_id: z.string().uuid() });

export type StoredConnection = {
  channelId: string;
  actorId: string;
  accountId: string;
  username: string;
  displayName: string | null;
  accountType: string | null;
  followersCount: number | null;
  tokenEncrypted: string;
  expiresAt: Date;
  scopes: string[];
};

export const storeConnection = async (
  input: StoredConnection,
): Promise<Result<{ channelId: string; brandId: string }>> => {
  const { data, error } = await adminClient().rpc("channel_connection_store", {
    p_channel: input.channelId,
    p_actor: input.actorId,
    p_account: {
      external_account_id: input.accountId,
      username: input.username,
      display_name: input.displayName,
      account_type: input.accountType,
      followers_count: input.followersCount,
    },
    p_token_encrypted: input.tokenEncrypted,
    p_expires_at: toIso(input.expiresAt),
    p_scopes: input.scopes,
  });
  if (error) return fail(error);
  const parsed = parseOutput(storedSchema, data);
  return parsed.ok ? { ok: true, channelId: parsed.channel_id, brandId: parsed.brand_id } : parsed;
};

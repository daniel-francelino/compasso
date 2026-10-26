import { instagramConfig } from "@/lib/shared/env.server";
import {
  markConnectionLost,
  readConnectionSecret,
} from "@/lib/shared/jobs/connection-token.server";
import { type Result, invalid } from "@/lib/shared/server-utils";
import { getProfile } from "@/lib/shared/social/instagram.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const NOT_CONFIGURED = "A integração com o Instagram ainda não foi configurada.";
const LOST = "A conexão não está mais válida. Reconecte o canal.";
const FAILED = "Não foi possível falar com o Instagram agora. Tente de novo em instantes.";

export const probeConnection = async (
  channelId: string,
): Promise<Result<{ username: string; followers: number | null }>> => {
  const config = instagramConfig();
  if (config === null) return invalid(NOT_CONFIGURED);
  const admin = adminClient();
  const secret = await readConnectionSecret(admin, config, channelId);
  if (!secret.ok) {
    await markConnectionLost(admin, channelId);
    return invalid(LOST);
  }
  const profile = await getProfile(secret.secret.token);
  if (profile.ok) {
    return { ok: true, username: profile.data.username, followers: profile.data.followersCount };
  }
  if (profile.code !== PublishErrorCode.ConnectionExpired) return invalid(FAILED);
  await markConnectionLost(admin, channelId);
  return invalid(LOST);
};

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { instagramConfig } from "@/lib/shared/env.server";
import {
  markConnectionLost,
  readConnectionSecret,
} from "@/lib/shared/jobs/connection-token.server";
import { type Result, denied, fail, invalid } from "@/lib/shared/server-utils";
import { getProfile } from "@/lib/shared/social/instagram.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { adminClient } from "@/lib/shared/supabase/admin.server";

const testSchema = z.object({ brandId: z.string().uuid(), channelId: z.string().uuid() });

const listedSchema = z.array(z.object({ channel_id: z.string() }));

const NOT_CONFIGURED = "A integração com o Instagram ainda não foi configurada.";
const LOST = "A conexão não está mais válida. Reconecte o canal.";
const FAILED = "Não foi possível falar com o Instagram agora. Tente de novo em instantes.";

export const testChannelConnection = createServerFn({ method: "POST" })
  .validator(testSchema)
  .handler(async ({ data }): Promise<Result<{ username: string; followers: number | null }>> => {
    const caller = await requireActionServer(Action.Channels.Connect);
    if (caller === null) return denied;
    const config = instagramConfig();
    if (config === null) return invalid(NOT_CONFIGURED);

    const { data: listed, error } = await caller.supabase.rpc("channel_connection_list", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const known = listedSchema.safeParse(listed);
    if (!known.success || !known.data.some((row) => row.channel_id === data.channelId)) {
      return fail({ message: "not_found" });
    }

    const admin = adminClient();
    const secret = await readConnectionSecret(admin, config, data.channelId);
    if (!secret.ok) {
      await markConnectionLost(admin, data.channelId);
      return invalid(LOST);
    }
    const profile = await getProfile(secret.secret.token);
    if (profile.ok) {
      return { ok: true, username: profile.data.username, followers: profile.data.followersCount };
    }
    if (profile.code !== PublishErrorCode.ConnectionExpired) return invalid(FAILED);
    await markConnectionLost(admin, data.channelId);
    return invalid(LOST);
  });

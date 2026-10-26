import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  type ChannelConnection,
  brandIdSchema,
  completeConnectionSchema,
  connectionRowSchema,
  connectionSettingsSchema,
  disconnectSchema,
  startConnectionSchema,
  testConnectionSchema,
  toConnection,
} from "@/lib/marketing/channels/connection-schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { instagramConfig } from "@/lib/shared/env.server";
import { AppRoute } from "@/lib/shared/routes";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";
import { probeConnection } from "@/lib/shared/jobs/connection-test.server";
import { siteOrigin } from "@/lib/shared/site-url.server";
import {
  exchangeCode,
  getProfile,
  instagramAuthorizeUrl,
} from "@/lib/shared/social/instagram.server";
import { signState, verifyState } from "@/lib/shared/social/oauth-state.server";
import { encryptToken } from "@/lib/shared/social/token-crypto.server";

const NOT_CONFIGURED = "A integração com o Instagram ainda não foi configurada.";
const EXPIRED_LINK = "Este pedido de conexão expirou. Tente conectar de novo.";
const REFUSED = "O Instagram não autorizou a conexão. Tente de novo.";

const listSchema = z.object({ connections: z.array(connectionRowSchema) });
const listedSchema = z.array(z.object({ channel_id: z.string() }));

export const listChannelConnections = createServerFn({ method: "GET" })
  .validator(brandIdSchema)
  .handler(async ({ data }): Promise<Result<{ connections: ChannelConnection[] }>> => {
    const caller = await requireActionServer(Action.Channels.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("channel_connection_list", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(listSchema, { connections: rows });
    return parsed.ok ? { ok: true, connections: parsed.connections.map(toConnection) } : parsed;
  });

export const startInstagramConnection = createServerFn({ method: "POST" })
  .validator(startConnectionSchema)
  .handler(async ({ data }): Promise<Result<{ url: string }>> => {
    const caller = await requireActionServer(Action.Channels.Connect);
    if (caller === null) return denied;
    const config = instagramConfig();
    if (config === null) return invalid(NOT_CONFIGURED);
    const state = signState({ channelId: data.channelId, userId: caller.userId }, config.appSecret);
    const redirectUri = `${siteOrigin()}${AppRoute.InstagramCallback}`;
    return { ok: true, url: instagramAuthorizeUrl(config, redirectUri, state) };
  });

export const completeInstagramConnection = createServerFn({ method: "POST" })
  .validator(completeConnectionSchema)
  .handler(async ({ data }): Promise<Result<{ channelId: string; brandId: string }>> => {
    const caller = await requireActionServer(Action.Channels.Connect);
    if (caller === null) return denied;
    const config = instagramConfig();
    if (config === null) return invalid(NOT_CONFIGURED);
    const state = verifyState(data.state, config.appSecret);
    if (state === null || state.userId !== caller.userId) return invalid(EXPIRED_LINK);

    const redirectUri = `${siteOrigin()}${AppRoute.InstagramCallback}`;
    const exchanged = await exchangeCode(config, redirectUri, data.code);
    if (!exchanged.ok) return invalid(REFUSED);
    const profile = await getProfile(exchanged.data.token);
    if (!profile.ok) return invalid(REFUSED);
    const sealed = encryptToken(exchanged.data.token, config.tokenKey);
    if (sealed === null) return invalid(NOT_CONFIGURED);

    const { data: row, error } = await caller.supabase.rpc("channel_connection_connect", {
      p_channel: state.channelId,
      p_account: {
        external_account_id: profile.data.accountId,
        username: profile.data.username,
        display_name: profile.data.displayName,
        account_type: profile.data.accountType,
        followers_count: profile.data.followersCount,
      },
      p_token_encrypted: sealed,
      p_expires_at: exchanged.data.expiresAt.toISOString(),
      p_scopes: exchanged.data.scopes,
    });
    if (error) return fail(error);
    const parsed = parseOutput(connectionRowSchema, row);
    return parsed.ok
      ? { ok: true, channelId: parsed.channel_id, brandId: parsed.brand_id }
      : parsed;
  });

export const saveConnectionSettings = createServerFn({ method: "POST" })
  .validator(connectionSettingsSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Channels.Connect);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("channel_connection_settings", {
      p_channel: data.channelId,
      p_auto_publish_default: data.autoPublishDefault,
      p_collect_metrics: data.collectMetrics,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .validator(disconnectSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Channels.Connect);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("channel_connection_disconnect", {
      p_channel: data.channelId,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const testChannelConnection = createServerFn({ method: "POST" })
  .validator(testConnectionSchema)
  .handler(async ({ data }): Promise<Result<{ username: string; followers: number | null }>> => {
    const caller = await requireActionServer(Action.Channels.Connect);
    if (caller === null) return denied;
    const { data: listed, error } = await caller.supabase.rpc("channel_connection_list", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const known = listedSchema.safeParse(listed);
    if (!known.success || !known.data.some((row) => row.channel_id === data.channelId)) {
      return fail({ message: "not_found" });
    }
    return probeConnection(data.channelId);
  });

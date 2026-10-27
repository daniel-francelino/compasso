import { z } from "zod";
import type { InstagramConfig } from "@/lib/shared/env.server";
import { INSTAGRAM_SCOPES } from "@/lib/shared/social/scopes";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";
import { GRAPH_BASE, type MetaResult, graphGet, graphPost } from "@/lib/shared/social/graph.server";
import { nowDate, plusMs } from "@/lib/shared/dates";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const CODE_EXCHANGE_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";

export const instagramAuthorizeUrl = (
  config: InstagramConfig,
  redirectUri: string,
  state: string,
): string => {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
};

const shortTokenSchema = z.union([
  z.object({
    access_token: z.string().min(1),
    user_id: z.union([z.string(), z.number()]).optional(),
    permissions: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  z.object({
    data: z
      .array(
        z.object({
          access_token: z.string().min(1),
          user_id: z.union([z.string(), z.number()]).optional(),
          permissions: z.union([z.string(), z.array(z.string())]).optional(),
        }),
      )
      .min(1),
  }),
]);

const longTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

const profileSchema = z.object({
  user_id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  username: z.string().min(1),
  name: z.string().optional(),
  account_type: z.string().optional(),
  followers_count: z.number().int().nonnegative().optional(),
});

export type InstagramToken = { token: string; expiresAt: Date };

export type InstagramProfile = {
  accountId: string;
  username: string;
  displayName: string | null;
  accountType: string | null;
  followersCount: number | null;
};

export type ExchangedCode = InstagramToken & { scopes: string[] };

const scopesOf = (value: string | string[] | undefined): string[] => {
  if (value === undefined) return [];
  return typeof value === "string" ? value.split(",").map((item) => item.trim()) : value;
};

const expiryOf = (seconds: number): Date => plusMs(nowDate(), seconds * 1000);

export const exchangeCode = async (
  config: InstagramConfig,
  redirectUri: string,
  code: string,
): Promise<MetaResult<ExchangedCode>> => {
  const short = await graphPost(
    CODE_EXCHANGE_URL,
    {
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    },
    shortTokenSchema,
  );
  if (!short.ok) return short;
  const first = "data" in short.data ? short.data.data[0] : short.data;
  if (first === undefined)
    return { ok: false, code: PublishErrorCode.Rejected, provider: "empty", transient: false };
  const long = await graphGet(
    LONG_LIVED_URL,
    first.access_token,
    { grant_type: "ig_exchange_token", client_secret: config.appSecret },
    longTokenSchema,
  );
  if (!long.ok) return long;
  return {
    ok: true,
    data: {
      token: long.data.access_token,
      expiresAt: expiryOf(long.data.expires_in),
      scopes: scopesOf(first.permissions),
    },
  };
};

export const refreshToken = async (token: string): Promise<MetaResult<InstagramToken>> => {
  const result = await graphGet(
    REFRESH_URL,
    token,
    { grant_type: "ig_refresh_token" },
    longTokenSchema,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: { token: result.data.access_token, expiresAt: expiryOf(result.data.expires_in) },
  };
};

export const getProfile = async (token: string): Promise<MetaResult<InstagramProfile>> => {
  const result = await graphGet(
    `${GRAPH_BASE}/me`,
    token,
    { fields: "user_id,username,name,account_type,followers_count" },
    profileSchema,
  );
  if (!result.ok) return result;
  const accountId = String(result.data.user_id ?? result.data.id ?? "");
  return {
    ok: true,
    data: {
      accountId,
      username: result.data.username,
      displayName: result.data.name ?? null,
      accountType: result.data.account_type ?? null,
      followersCount: result.data.followers_count ?? null,
    },
  };
};

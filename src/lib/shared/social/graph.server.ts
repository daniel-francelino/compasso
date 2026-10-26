import type { z } from "zod";
import { logError } from "@/lib/shared/logger";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";

export const INSTAGRAM_API_VERSION = "v23.0";
export const GRAPH_BASE = `https://graph.instagram.com/${INSTAGRAM_API_VERSION}`;

export type MetaFailure = {
  ok: false;
  code: PublishErrorCode;
  provider: string;
  transient: boolean;
};

export type MetaResult<T> = { ok: true; data: T } | MetaFailure;

export type MetaErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number };
};

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const TOKEN_CODES = new Set([102, 190]);
const MEDIA_DOWNLOAD_CODES = new Set([9004, 9007]);
const MAX_POSTS_SUBCODE = 2207042;
const PROVIDER_LIMIT = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;

const failure = (code: PublishErrorCode, provider: string, transient: boolean): MetaFailure => ({
  ok: false,
  code,
  provider: provider.slice(0, PROVIDER_LIMIT),
  transient,
});

export const classifyFailure = (status: number, body: unknown): MetaFailure => {
  const error = (body as MetaErrorBody | null)?.error;
  const code = error?.code;
  const subcode = error?.error_subcode;
  const provider = `${code ?? status}/${subcode ?? 0} ${error?.message ?? ""}`.trim();
  const isToken = code !== undefined && TOKEN_CODES.has(code);
  if (status === HTTP_UNAUTHORIZED || isToken) {
    return failure(PublishErrorCode.ConnectionExpired, provider, false);
  }
  if (subcode === MAX_POSTS_SUBCODE) return failure(PublishErrorCode.LimitReached, provider, false);
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) {
    return failure(PublishErrorCode.Unavailable, provider, true);
  }
  if (code !== undefined && MEDIA_DOWNLOAD_CODES.has(code)) {
    return failure(PublishErrorCode.MediaNotReady, provider, false);
  }
  if (status >= HTTP_SERVER_ERROR) return failure(PublishErrorCode.Unavailable, provider, true);
  return failure(PublishErrorCode.Rejected, provider, false);
};

const respond = async <T>(
  response: Response,
  path: string,
  schema: z.ZodType<T>,
): Promise<MetaResult<T>> => {
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) return classifyFailure(response.status, json);
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };
  logError("instagram: unexpected response shape", path);
  return failure(PublishErrorCode.Rejected, "invalid_response", false);
};

const networkFailure = (path: string, error: unknown): MetaFailure => {
  logError("instagram: request failed", path, error instanceof Error ? error.name : "unknown");
  return failure(PublishErrorCode.Unavailable, "network", true);
};

export const graphGet = async <T>(
  url: string,
  token: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<MetaResult<T>> => {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  target.searchParams.set("access_token", token);
  try {
    return await respond(await fetch(target, { method: "GET" }), target.pathname, schema);
  } catch (error) {
    return networkFailure(target.pathname, error);
  }
};

export const graphPost = async <T>(
  url: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<MetaResult<T>> => {
  const target = new URL(url);
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    return await respond(response, target.pathname, schema);
  } catch (error) {
    return networkFailure(target.pathname, error);
  }
};

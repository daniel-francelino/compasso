import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { MediaShareStatus, ShareKind } from "@/lib/shared/enums";
import {
  createShareSchema,
  listSharesSchema,
  shareIdSchema,
  updateShareSchema,
} from "@/lib/shared/media/schemas";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type ShareRow = {
  id: string;
  token: string;
  label: string;
  message: string | null;
  status: MediaShareStatus;
  allowDownload: boolean;
  expiresAt: string | null;
  hasPassword: boolean;
  maxDownloads: number | null;
  downloadCount: number;
  views: number;
  createdAt: string;
};

const createdSchema = z.object({ id: z.string().uuid(), token: z.string() });

const shareRowsSchema = z.object({
  shares: z.array(
    z.object({
      id: z.string().uuid(),
      token: z.string(),
      label: z.string(),
      message: z.string().nullable(),
      status: z.nativeEnum(MediaShareStatus),
      allow_download: z.boolean(),
      expires_at: z.string().nullable(),
      has_password: z.boolean(),
      max_downloads: z.number().nullable(),
      download_count: z.number(),
      views: z.number(),
      created_at: z.string(),
    }),
  ),
});

const targetsSchema = z.object({
  targets: z.array(z.object({ kind: z.nativeEnum(ShareKind), target_id: z.string().uuid() })),
});

export const createMediaShare = createServerFn({ method: "POST" })
  .validator(createShareSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; token: string }>> => {
    const caller = await requireActionServer(Action.Media.Share);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("media_share_create", {
      p_input: {
        kind: data.kind,
        target_id: data.targetId,
        label: data.label,
        message: data.message ?? null,
        expires_at: data.expiresAt,
        password: data.password ?? null,
        max_downloads: data.maxDownloads,
        allow_download: data.allowDownload,
        include_subcollections: data.includeSubcollections ?? true,
        follow_latest: data.followLatest ?? false,
      },
    });
    if (error) return fail(error);
    return parseOutput(createdSchema, row);
  });

export const updateMediaShare = createServerFn({ method: "POST" })
  .validator(updateShareSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Share);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("media_share_update", {
      p_input: {
        id: data.id,
        label: data.label,
        message: data.message ?? null,
        expires_at: data.expiresAt,
        max_downloads: data.maxDownloads,
        allow_download: data.allowDownload,
        password_action: data.passwordAction,
        password: data.password ?? null,
      },
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const revokeMediaShare = createServerFn({ method: "POST" })
  .validator(shareIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Share);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("media_share_revoke", { p_share: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const listMediaShares = createServerFn({ method: "GET" })
  .validator(listSharesSchema)
  .handler(async ({ data }): Promise<Result<{ shares: ShareRow[] }>> => {
    const caller = await requireActionServer(Action.Media.Share);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("media_share_list", {
      p_kind: data.kind,
      p_target: data.targetId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(shareRowsSchema, { shares: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      shares: parsed.shares.map((row) => ({
        id: row.id,
        token: row.token,
        label: row.label,
        message: row.message,
        status: row.status,
        allowDownload: row.allow_download,
        expiresAt: row.expires_at,
        hasPassword: row.has_password,
        maxDownloads: row.max_downloads,
        downloadCount: row.download_count,
        views: row.views,
        createdAt: row.created_at,
      })),
    };
  });

export const listShareTargets = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ targets: { kind: ShareKind; targetId: string }[] }>> => {
    const caller = await requireActionServer(Action.Media.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("media_share_targets");
    if (error) return fail(error);
    const parsed = parseOutput(targetsSchema, { targets: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      targets: parsed.targets.map((row) => ({ kind: row.kind, targetId: row.target_id })),
    };
  },
);

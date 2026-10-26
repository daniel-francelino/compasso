import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { AutoPublishState, PublicationStatus, PublishMode, PublishedVia } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

const itemSchema = z.object({ itemId: z.string().uuid() });

const modeSchema = z.object({
  rowId: z.string().uuid(),
  mode: z.nativeEnum(PublishMode),
  expectedVersion: z.number().int().min(1),
});

const nowSchema = z.object({
  rowId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
});

const infoSchema = z.object({
  rows: z.array(
    z.object({
      row_id: z.string().uuid(),
      channel_id: z.string().uuid(),
      version: z.number().int(),
      publication_status: z.nativeEnum(PublicationStatus),
      published_url: z.string().nullable(),
      publish_mode: z.nativeEnum(PublishMode),
      auto_publish_state: z.nativeEnum(AutoPublishState).nullable(),
      published_via: z.nativeEnum(PublishedVia).nullable(),
      external_media_id: z.string().nullable(),
      attempt_count: z.number().int(),
      last_error_code: z.string().nullable(),
      connected: z.boolean(),
      last_attempt_at: z.string().nullable(),
    }),
  ),
});

export type PublishInfo = {
  rowId: string;
  channelId: string;
  version: number;
  publicationStatus: PublicationStatus;
  publishedUrl: string | null;
  mode: PublishMode;
  state: AutoPublishState | null;
  publishedVia: PublishedVia | null;
  attempts: number;
  lastErrorCode: string | null;
  connected: boolean;
  lastAttemptAt: string | null;
};

export const getPublishInfo = createServerFn({ method: "GET" })
  .validator(itemSchema)
  .handler(async ({ data }): Promise<Result<{ rows: PublishInfo[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("content_publish_info", {
      p_item: data.itemId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(infoSchema, { rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      rows: parsed.rows.map((row) => ({
        rowId: row.row_id,
        channelId: row.channel_id,
        version: row.version,
        publicationStatus: row.publication_status,
        publishedUrl: row.published_url,
        mode: row.publish_mode,
        state: row.auto_publish_state,
        publishedVia: row.published_via,
        attempts: row.attempt_count,
        lastErrorCode: row.last_error_code,
        connected: row.connected,
        lastAttemptAt: row.last_attempt_at,
      })),
    };
  });

export const setPublishMode = createServerFn({ method: "POST" })
  .validator(modeSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.PublishManual);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("channel_row_set_publish_mode", {
      p_row: data.rowId,
      p_mode: data.mode,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const publishNow = createServerFn({ method: "POST" })
  .validator(nowSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.PublishManual);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("channel_row_publish_now", {
      p_row: data.rowId,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return { ok: true };
  });

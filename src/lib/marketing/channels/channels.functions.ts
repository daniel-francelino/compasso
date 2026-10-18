import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { Platform } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import {
  ChannelStatusFilter,
  archiveChannelSchema,
  channelIdSchema,
  listChannelsSchema,
  saveChannelSchema,
} from "@/lib/marketing/channels/schemas";

export type ChannelRow = {
  id: string;
  platform: Platform;
  profileName: string;
  profileUrl: string | null;
  externalId: string | null;
  notes: string | null;
  version: number;
  archived: boolean;
};

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

export const listChannels = createServerFn({ method: "GET" })
  .validator(listChannelsSchema)
  .handler(async ({ data }): Promise<Result<{ channels: ChannelRow[] }>> => {
    const caller = await requireActionServer(Action.Channels.View);
    if (caller === null) return denied;

    let query = caller.supabase
      .from("channels")
      .select("id, platform, profile_name, profile_url, external_id, notes, version, archived_at")
      .eq("brand_id", data.brandId);
    query =
      data.status === ChannelStatusFilter.Archived
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);
    if (data.platform !== undefined) query = query.eq("platform", data.platform);

    const { data: rows, error } = await query.order("platform").order("profile_name");
    if (error) return fail(error);
    return {
      ok: true,
      channels: rows.map((row) => ({
        id: row.id,
        platform: row.platform as Platform,
        profileName: row.profile_name,
        profileUrl: row.profile_url,
        externalId: row.external_id,
        notes: row.notes,
        version: row.version,
        archived: row.archived_at !== null,
      })),
    };
  });

export const saveChannel = createServerFn({ method: "POST" })
  .validator(saveChannelSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(
      data.id === undefined ? Action.Channels.Create : Action.Channels.Update,
    );
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase.rpc("channel_save", {
      p_channel: {
        ...(data.id === undefined ? {} : { id: data.id }),
        brand_id: data.brandId,
        platform: data.platform,
        profile_name: data.profileName,
        profile_url: data.profileUrl ?? null,
        external_id: data.externalId ?? null,
        notes: data.notes ?? null,
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const setChannelArchived = createServerFn({ method: "POST" })
  .validator(archiveChannelSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Channels.Update);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("channel_set_archived", {
      p_channel: data.id,
      p_archived: data.archived,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .validator(channelIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Channels.Delete);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("channel_delete", { p_channel: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import {
  archiveContentTypeSchema,
  saveContentTypeSchema,
} from "@/lib/shared/content-types/schemas";
import type { ContentTypeColor } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type ContentTypeRow = {
  id: string;
  name: string;
  color: ContentTypeColor;
  emoji: string | null;
  archived: boolean;
};

export type ContentTypeCatalogRow = ContentTypeRow & { contentCount: number };

const CATALOG_LIMIT = 500;

const idSchema = z.object({ id: z.string().uuid() });

export const listContentTypes = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ types: ContentTypeRow[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("content_types")
      .select("id, name, color, emoji, archived_at")
      .is("archived_at", null)
      .order("name")
      .limit(CATALOG_LIMIT);
    if (error) return fail(error);
    return {
      ok: true,
      types: data.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color as ContentTypeColor,
        emoji: row.emoji,
        archived: false,
      })),
    };
  },
);

export const listContentTypeCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ types: ContentTypeCatalogRow[] }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("content_types")
      .select("id, name, color, emoji, archived_at, content_item_types(count)")
      .order("name")
      .limit(CATALOG_LIMIT);
    if (error) return fail(error);
    return {
      ok: true,
      types: data.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color as ContentTypeColor,
        emoji: row.emoji,
        archived: row.archived_at !== null,
        contentCount: row.content_item_types[0]?.count ?? 0,
      })),
    };
  },
);

export const saveContentType = createServerFn({ method: "POST" })
  .validator(saveContentTypeSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("content_type_save", {
      p_type: {
        id: data.id ?? null,
        name: data.name,
        color: data.color,
        emoji: data.emoji ?? null,
      },
    });
    if (error) return fail(error);
    return parseOutput(idSchema, row);
  });

export const archiveContentType = createServerFn({ method: "POST" })
  .validator(archiveContentTypeSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Settings.Manage);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("content_type_set_archived", {
      p_type: data.id,
      p_archived: data.archived,
    });
    if (error) return fail(error);
    return parseOutput(idSchema, row);
  });

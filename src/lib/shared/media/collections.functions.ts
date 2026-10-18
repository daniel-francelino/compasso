import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { MediaScope } from "@/lib/shared/enums";
import {
  collectionIdSchema,
  listCollectionsSchema,
  moveToCollectionSchema,
  saveCollectionSchema,
} from "@/lib/shared/media/schemas";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type CollectionRow = {
  id: string;
  name: string;
  parentId: string | null;
  itemCount: number;
};

const savedSchema = z.object({ id: z.string().uuid() });

export const listCollections = createServerFn({ method: "GET" })
  .validator(listCollectionsSchema)
  .handler(async ({ data }): Promise<Result<{ collections: CollectionRow[] }>> => {
    const caller = await requireActionServer(Action.Media.View);
    if (caller === null) return denied;

    const base = caller.supabase
      .from("media_collections")
      .select("id, name, parent_id, media_collection_items(count)")
      .eq("scope", data.scope);
    const { data: rows, error } = await (
      data.scope === MediaScope.Brand && data.brandId !== undefined
        ? base.eq("brand_id", data.brandId)
        : base
    ).order("name");
    if (error) return fail(error);
    return {
      ok: true,
      collections: rows.map((row) => ({
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
        itemCount: row.media_collection_items[0]?.count ?? 0,
      })),
    };
  });

export const saveCollection = createServerFn({ method: "POST" })
  .validator(saveCollectionSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Media.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("media_collection_save", {
      p_collection: {
        ...(data.id === undefined ? {} : { id: data.id }),
        scope: data.scope,
        brand_id: data.brandId ?? null,
        parent_id: data.parentId ?? null,
        name: data.name,
      },
    });
    if (error) return fail(error);
    return parseOutput(savedSchema, row);
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .validator(collectionIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Delete);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("media_collection_delete", {
      p_collection: data.id,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const moveToCollection = createServerFn({ method: "POST" })
  .validator(moveToCollectionSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Update);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("media_collection_move_items", {
      p_collection: data.collectionId,
      p_assets: data.assetIds,
    });
    if (error) return fail(error);
    return { ok: true };
  });

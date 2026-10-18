import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { CommentVisibility } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import { commentIdSchema, commentSchema, variantIdSchema } from "@/lib/marketing/content/schemas";
import { parseComments } from "@/lib/marketing/content/comments.server";
import type { CommentRow } from "@/lib/marketing/content/types";

const addedSchema = z.object({ id: z.string().uuid() });

export const listComments = createServerFn({ method: "GET" })
  .validator(variantIdSchema)
  .handler(async ({ data }): Promise<Result<{ comments: CommentRow[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("comment_list", {
      p_variant: data.variantId,
    });
    if (error) return fail(error);
    return parseComments(rows);
  });

export const addComment = createServerFn({ method: "POST" })
  .validator(commentSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(
      data.visibility === CommentVisibility.Internal
        ? Action.Comments.CreateInternal
        : Action.Comments.CreateExternal,
    );
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("comment_add", {
      p_variant: data.variantId,
      p_visibility: data.visibility,
      p_body: data.body,
    });
    if (error) return fail(error);
    const parsed = parseOutput(addedSchema, row);
    return parsed.ok ? { ok: true, id: parsed.id } : parsed;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .validator(commentIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("comment_delete", { p_comment: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

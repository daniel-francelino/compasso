import { z } from "zod";
import { CommentVisibility } from "@/lib/shared/enums";
import { type Result, parseOutput } from "@/lib/shared/server-utils";
import type { CommentRow } from "@/lib/marketing/content/types";

const listSchema = z.object({
  list: z.array(
    z.object({
      id: z.string().uuid(),
      visibility: z.nativeEnum(CommentVisibility),
      body: z.string(),
      created_at: z.string(),
      author_id: z.string().uuid(),
      author_name: z.string(),
      revision_no: z.number().int().nullable(),
      mine: z.boolean(),
    }),
  ),
});

export const parseComments = (rows: unknown): Result<{ comments: CommentRow[] }> => {
  const parsed = parseOutput(listSchema, { list: rows });
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    comments: parsed.list.map((row) => ({
      id: row.id,
      visibility: row.visibility,
      body: row.body,
      createdAt: row.created_at,
      authorId: row.author_id,
      authorName: row.author_name,
      revisionNo: row.revision_no,
      mine: row.mine,
    })),
  };
};

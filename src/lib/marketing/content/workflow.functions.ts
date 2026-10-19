import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import {
  brandIdSchema,
  cancelSchema,
  moveContentSchema,
  publishSchema,
  submitSchema,
} from "@/lib/marketing/content/schemas";

const movedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
const submittedSchema = z.object({
  request_id: z.string().uuid(),
  revision_id: z.string().uuid(),
  revision_no: z.number().int(),
  version: z.number().int(),
});
const approverOptionsSchema = z.object({
  approvers: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
  default_deadline_days: z.number().int(),
});

export const moveContent = createServerFn({ method: "POST" })
  .validator(moveContentSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Content.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("content_move", {
      p_item: data.id,
      p_to_status: data.to,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const saved = parseOutput(movedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const submitForApproval = createServerFn({ method: "POST" })
  .validator(submitSchema)
  .handler(
    async ({
      data,
    }): Promise<Result<{ requestId: string; revisionNo: number; version: number }>> => {
      const caller = await requireActionServer(Action.Content.Submit);
      if (caller === null) return denied;
      const { data: row, error } = await caller.supabase.rpc("submit_for_approval", {
        p_item: data.id,
        p_approver: data.approverId,
        p_due_date: data.dueDate ?? null,
        p_message: data.message ?? null,
        p_expected_version: data.expectedVersion,
      });
      if (error) return fail(error);
      const parsed = parseOutput(submittedSchema, row);
      if (!parsed.ok) return parsed;
      return {
        ok: true,
        requestId: parsed.request_id,
        revisionNo: parsed.revision_no,
        version: parsed.version,
      };
    },
  );

export const reopenContent = createServerFn({ method: "POST" })
  .validator(cancelSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Reopen);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("reopen_content", {
      p_item: data.id,
      p_reason: data.reason,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const cancelContentChannel = createServerFn({ method: "POST" })
  .validator(cancelSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Cancel);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("content_channel_cancel", {
      p_channel_row: data.id,
      p_reason: data.reason,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const markPublished = createServerFn({ method: "POST" })
  .validator(publishSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.PublishManual);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("mark_published", {
      p_channel_row: data.id,
      p_published_at: data.publishedAt,
      p_url: data.url === undefined || data.url === "" ? null : data.url,
      p_evidence_media_version: data.evidenceVersionId ?? null,
      p_note: data.note === undefined || data.note === "" ? null : data.note,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const listApproverOptions = createServerFn({ method: "GET" })
  .validator(brandIdSchema)
  .handler(
    async ({
      data,
    }): Promise<
      Result<{ approvers: { id: string; name: string }[]; defaultDeadlineDays: number }>
    > => {
      const caller = await requireActionServer(Action.Content.Submit);
      if (caller === null) return denied;
      const { data: row, error } = await caller.supabase.rpc("approver_options", {
        p_brand: data.brandId,
      });
      if (error) return fail(error);
      const parsed = parseOutput(approverOptionsSchema, row);
      return parsed.ok
        ? {
            ok: true,
            approvers: parsed.approvers,
            defaultDeadlineDays: parsed.default_deadline_days,
          }
        : parsed;
    },
  );

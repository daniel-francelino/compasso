import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type {
  ApprovalOutcome,
  ApprovalRequestStatus,
  ContentFormat,
  EditorialStatus,
  Platform,
  PublicationStatus,
} from "@/lib/shared/enums";
import { personNames } from "@/lib/shared/people.server";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";
import {
  brandIdSchema,
  cancelSchema,
  idSchema,
  moveVariantSchema,
  publishSchema,
  saveVariantSchema,
  submitSchema,
} from "@/lib/marketing/content/schemas";
import { REVISION_SELECT, loadMedia, toRevision } from "@/lib/marketing/content/revisions.server";
import type {
  RequestRow,
  RevisionRow,
  VariantDetail,
  VariantMedia,
} from "@/lib/marketing/content/types";

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
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
const workingMediaSchema = z.array(
  z.object({ media_version_id: z.string().uuid(), alt_text: z.string().nullable().optional() }),
);
const captionSchema = z.object({ text: z.string() });

const sameMedia = (left: VariantMedia[], right: VariantMedia[]): boolean =>
  left.length === right.length &&
  left.every(
    (item, index) =>
      item.mediaVersionId === right[index]?.mediaVersionId &&
      (item.altText ?? "") === (right[index]?.altText ?? ""),
  );

const instantOf = (value: string | null): number | null =>
  value === null ? null : new Date(value).getTime();

export const getVariant = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<Result<{ variant: VariantDetail }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { supabase } = caller;

    const { data: row, error } = await supabase
      .from("content_variants")
      .select(
        "id, version, brand_id, content_item_id, channel_id, format, editorial_status, publication_status, planned_at, planned_timezone, approval_due_date, caption, call_to_action, working_media, current_revision_id, approved_revision_id, published_at, published_url, published_note, channels(platform, profile_name, archived_at), content_items(title, cancelled_at, brands(name, timezone))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });

    const [revisionsResult, requestsResult] = await Promise.all([
      supabase
        .from("content_revisions")
        .select(REVISION_SELECT)
        .eq("variant_id", data.id)
        .order("revision_no", { ascending: false }),
      supabase
        .from("approval_requests")
        .select(
          "id, revision_id, status, approver_user_id, requested_by, requested_at, due_date, viewed_at, decided_at, cancelled_reason, approval_decisions(outcome, comment)",
        )
        .eq("variant_id", data.id)
        .order("requested_at", { ascending: false }),
    ]);
    if (revisionsResult.error) return fail(revisionsResult.error);
    if (requestsResult.error) return fail(requestsResult.error);

    const working = workingMediaSchema.safeParse(row.working_media);
    const workingMedia = await loadMedia(
      supabase,
      (working.success ? working.data : []).map((item) => ({
        id: item.media_version_id,
        alt: item.alt_text ?? null,
      })),
    );

    const built = await Promise.all(
      revisionsResult.data.map((revision) => toRevision(supabase, revision)),
    );
    const revisions = built.filter((revision): revision is RevisionRow => revision !== null);
    if (revisions.length !== built.length) return fail({ message: "unknown" });

    const names = await personNames(
      supabase,
      requestsResult.data.flatMap((request) => [request.approver_user_id, request.requested_by]),
    );
    const numberOf = new Map(revisions.map((revision) => [revision.id, revision.revisionNo]));
    const requests: RequestRow[] = requestsResult.data.map((request) => {
      const decision = request.approval_decisions[0];
      return {
        id: request.id,
        revisionId: request.revision_id,
        revisionNo: numberOf.get(request.revision_id) ?? 0,
        status: request.status as ApprovalRequestStatus,
        approverName: names.get(request.approver_user_id) ?? null,
        requestedByName:
          request.requested_by === null ? null : (names.get(request.requested_by) ?? null),
        requestedAt: request.requested_at,
        dueDate: request.due_date,
        viewedAt: request.viewed_at,
        decidedAt: request.decided_at,
        outcome: (decision?.outcome ?? null) as ApprovalOutcome | null,
        decisionComment: decision?.comment ?? null,
        cancelledReason: request.cancelled_reason,
      };
    });

    const current = revisions.find((revision) => revision.id === row.current_revision_id);
    const caption = captionSchema.safeParse(row.caption);
    const captionText = caption.success ? caption.data.text : "";
    const channel = row.channels;
    const hasUnsentChanges =
      current !== undefined &&
      (current.snapshot.caption !== captionText ||
        (current.snapshot.callToAction ?? "") !== (row.call_to_action ?? "") ||
        current.snapshot.format !== row.format ||
        current.snapshot.platform !== channel?.platform ||
        current.snapshot.profileName !== channel?.profile_name ||
        instantOf(current.snapshot.plannedAt) !== instantOf(row.planned_at) ||
        !sameMedia(current.media, workingMedia));

    return {
      ok: true,
      variant: {
        id: row.id,
        version: row.version,
        brandId: row.brand_id,
        brandName: row.content_items?.brands?.name ?? "",
        brandTimezone: row.content_items?.brands?.timezone ?? "America/Sao_Paulo",
        itemId: row.content_item_id,
        itemTitle: row.content_items?.title ?? "",
        itemCancelled: (row.content_items?.cancelled_at ?? null) !== null,
        channelId: row.channel_id,
        platform: (channel?.platform ?? "other") as Platform,
        profileName: channel?.profile_name ?? "",
        channelArchived: (channel?.archived_at ?? null) !== null,
        format: row.format as ContentFormat,
        editorialStatus: row.editorial_status as EditorialStatus,
        publicationStatus: row.publication_status as PublicationStatus,
        plannedAt: row.planned_at,
        plannedTimezone: row.planned_timezone,
        approvalDueDate: row.approval_due_date,
        caption: captionText,
        callToAction: row.call_to_action,
        media: workingMedia,
        currentRevisionId: row.current_revision_id,
        approvedRevisionId: row.approved_revision_id,
        nextRevisionNo: (revisions[0]?.revisionNo ?? 0) + 1,
        hasUnsentChanges,
        published:
          row.published_at === null
            ? null
            : { at: row.published_at, url: row.published_url, note: row.published_note },
        revisions,
        requests,
      },
    };
  });

export const saveVariant = createServerFn({ method: "POST" })
  .validator(saveVariantSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(
      data.id === undefined ? Action.Content.Create : Action.Content.Update,
    );
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("content_variant_save", {
      p_variant: {
        ...(data.id === undefined ? {} : { id: data.id }),
        content_item_id: data.contentItemId,
        channel_id: data.channelId,
        format: data.format,
        caption: { text: data.caption },
        call_to_action: data.callToAction ?? null,
        planned_at: data.plannedAt ?? null,
        planned_timezone: data.plannedTimezone ?? null,
        approval_due_date: data.approvalDueDate ?? null,
        working_media: data.media.map((item) => ({
          media_version_id: item.mediaVersionId,
          alt_text: item.altText ?? null,
        })),
      },
      ...(data.expectedVersion === undefined ? {} : { p_expected_version: data.expectedVersion }),
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const moveVariant = createServerFn({ method: "POST" })
  .validator(moveVariantSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Content.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("content_variant_move", {
      p_variant: data.id,
      p_to_status: data.to,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
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
        p_variant: data.id,
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

export const reopenVariant = createServerFn({ method: "POST" })
  .validator(cancelSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Reopen);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("reopen_variant", {
      p_variant: data.id,
      p_reason: data.reason,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const cancelVariant = createServerFn({ method: "POST" })
  .validator(cancelSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Cancel);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("content_variant_cancel", {
      p_variant: data.id,
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
      p_variant: data.id,
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

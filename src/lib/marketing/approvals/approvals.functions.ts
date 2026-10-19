import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { type Caller, requireActionServer } from "@/lib/shared/auth/server-guards.server";
import {
  type ApprovalOutcome,
  ApprovalRequestStatus,
  CommentVisibility,
  type Platform,
} from "@/lib/shared/enums";
import { todayInZone } from "@/lib/shared/format";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { personNames } from "@/lib/shared/people.server";
import {
  type Page,
  type Result,
  cleanSearch,
  denied,
  fail,
  pageOf,
  parseOutput,
  rangeOf,
} from "@/lib/shared/server-utils";
import {
  ApprovalFilter,
  cancelRequestSchema,
  listApprovalsSchema,
  reassignSchema,
  requestIdSchema,
} from "@/lib/marketing/approvals/schemas";
import { parseComments } from "@/lib/marketing/content/comments.server";
import {
  REVISION_SELECT,
  type RevisionQueryRow,
  toRevision,
} from "@/lib/marketing/content/revisions.server";
import type { CommentRow, RevisionRow } from "@/lib/marketing/content/types";

export type ApprovalRow = {
  id: string;
  status: ApprovalRequestStatus;
  title: string;
  brandId: string;
  brandName: string;
  itemId: string;
  channels: { platform: Platform; profileName: string }[];
  revisionNo: number;
  approverName: string | null;
  requestedAt: string;
  dueDate: string | null;
  overdue: boolean;
};

export type ApprovalDetail = {
  id: string;
  status: ApprovalRequestStatus;
  brandId: string;
  brandName: string;
  brandTimezone: string;
  itemId: string;
  approverId: string;
  approverName: string | null;
  requestedByName: string | null;
  requestedAt: string;
  dueDate: string | null;
  message: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  cancelledReason: string | null;
  outcome: ApprovalOutcome | null;
  decisionComment: string | null;
  decidedByName: string | null;
  isCurrent: boolean;
  overdue: boolean;
  revision: RevisionRow;
  comments: CommentRow[];
};

const reassignedSchema = z.object({ request_id: z.string().uuid() });

const snapshotChannelsSchema = z.object({
  channels: z.array(z.object({ platform: z.string(), profile_name: z.string() })),
});

const snapshotChannels = (snapshot: unknown): { platform: Platform; profileName: string }[] => {
  const parsed = snapshotChannelsSchema.safeParse(snapshot);
  if (!parsed.success) return [];
  return parsed.data.channels.map((channel) => ({
    platform: channel.platform as Platform,
    profileName: channel.profile_name,
  }));
};

const organizationZone = async (supabase: Caller["supabase"]): Promise<string> => {
  const { data } = await supabase.from("organizations").select("default_timezone").limit(1);
  return data?.[0]?.default_timezone ?? "America/Sao_Paulo";
};

export const listApprovals = createServerFn({ method: "GET" })
  .validator(listApprovalsSchema)
  .handler(async ({ data }): Promise<Result<Page<ApprovalRow>>> => {
    const caller = await requireActionServer(Action.Approvals.View);
    if (caller === null) return denied;
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    const search = cleanSearch(data.search);
    const today = todayInZone(await organizationZone(caller.supabase));

    let query = caller.supabase
      .from("approval_requests")
      .select(
        "id, status, brand_id, item_id, approver_user_id, requested_at, due_date, content_revisions(revision_no, snapshot), content_items!inner(title, brands(name))",
        { count: "exact" },
      );
    const filter = data.status ?? ApprovalFilter.Pending;
    query =
      filter === ApprovalFilter.Overdue
        ? query.eq("status", ApprovalRequestStatus.Pending).lt("due_date", today)
        : query.eq("status", filter);
    if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);
    if (data.approverId !== undefined) query = query.eq("approver_user_id", data.approverId);
    if (search !== "") query = query.ilike("content_items.title", `%${search}%`);

    const {
      data: rows,
      count,
      error,
    } = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("requested_at", { ascending: false })
      .range(from, to);
    if (error) return fail(error);

    const names = await personNames(
      caller.supabase,
      rows.map((row) => row.approver_user_id),
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      status: row.status as ApprovalRequestStatus,
      title: row.content_items?.title ?? "",
      brandId: row.brand_id,
      brandName: row.content_items?.brands?.name ?? "",
      itemId: row.item_id,
      channels: snapshotChannels(row.content_revisions?.snapshot),
      revisionNo: row.content_revisions?.revision_no ?? 0,
      approverName: names.get(row.approver_user_id) ?? null,
      requestedAt: row.requested_at,
      dueDate: row.due_date,
      overdue:
        row.status === ApprovalRequestStatus.Pending &&
        row.due_date !== null &&
        row.due_date < today,
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const getApprovalRequest = createServerFn({ method: "GET" })
  .validator(requestIdSchema)
  .handler(async ({ data }): Promise<Result<{ request: ApprovalDetail }>> => {
    const caller = await requireActionServer(Action.Approvals.View);
    if (caller === null) return denied;
    const { supabase } = caller;

    const { data: row, error } = await supabase
      .from("approval_requests")
      .select(
        "id, status, brand_id, item_id, revision_id, approver_user_id, requested_by, requested_at, due_date, message, viewed_at, decided_at, cancelled_reason, approval_decisions(outcome, comment, decided_by), content_items(current_revision_id, brands(name, timezone))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });

    const [revisionResult, commentsResult] = await Promise.all([
      supabase
        .from("content_revisions")
        .select(REVISION_SELECT)
        .eq("id", row.revision_id)
        .maybeSingle(),
      supabase.rpc("comment_list", { p_item: row.item_id }),
    ]);
    if (revisionResult.error) return fail(revisionResult.error);
    if (commentsResult.error) return fail(commentsResult.error);
    if (revisionResult.data === null) return fail({ message: "not_found" });
    const revision = await toRevision(supabase, revisionResult.data as RevisionQueryRow);
    if (revision === null) return fail({ message: "unknown" });

    const comments = parseComments(commentsResult.data);
    if (!comments.ok) return comments;
    const decision = row.approval_decisions[0];
    const names = await personNames(supabase, [
      row.approver_user_id,
      row.requested_by,
      decision?.decided_by,
    ]);
    const brand = row.content_items?.brands;
    const zone = brand?.timezone ?? (await organizationZone(supabase));
    const today = todayInZone(zone);

    return {
      ok: true,
      request: {
        id: row.id,
        status: row.status as ApprovalRequestStatus,
        brandId: row.brand_id,
        brandName: brand?.name ?? "",
        brandTimezone: zone,
        itemId: row.item_id,
        approverId: row.approver_user_id,
        approverName: names.get(row.approver_user_id) ?? null,
        requestedByName: row.requested_by === null ? null : (names.get(row.requested_by) ?? null),
        requestedAt: row.requested_at,
        dueDate: row.due_date,
        message: row.message,
        viewedAt: row.viewed_at,
        decidedAt: row.decided_at,
        cancelledReason: row.cancelled_reason,
        outcome: (decision?.outcome ?? null) as ApprovalOutcome | null,
        decisionComment: decision?.comment ?? null,
        decidedByName: decision === undefined ? null : (names.get(decision.decided_by) ?? null),
        isCurrent: row.content_items?.current_revision_id === row.revision_id,
        overdue:
          row.status === ApprovalRequestStatus.Pending &&
          row.due_date !== null &&
          row.due_date < today,
        revision,
        comments: comments.comments.filter(
          (comment) => comment.visibility === CommentVisibility.External,
        ),
      },
    };
  });

export const remindApprover = createServerFn({ method: "POST" })
  .validator(requestIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Submit);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("send_approval_reminder", { p_request: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const reassignApprover = createServerFn({ method: "POST" })
  .validator(reassignSchema)
  .handler(async ({ data }): Promise<Result<{ requestId: string }>> => {
    const caller = await requireActionServer(Action.Content.Submit);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("reassign_approver", {
      p_request: data.id,
      p_new_approver: data.approverId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(reassignedSchema, row);
    return parsed.ok ? { ok: true, requestId: parsed.request_id } : parsed;
  });

export const cancelApprovalRequest = createServerFn({ method: "POST" })
  .validator(cancelRequestSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Submit);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("cancel_request", {
      p_request: data.id,
      p_reason: data.reason,
    });
    if (error) return fail(error);
    return { ok: true };
  });

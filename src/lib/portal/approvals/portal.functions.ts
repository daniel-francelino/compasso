import { createServerFn } from "@tanstack/react-start";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { EXTERNAL_URL_SECONDS } from "@/lib/shared/media/limits";
import { MediaVariant } from "@/lib/shared/media/schemas";
import {
  type Page,
  type Result,
  denied,
  fail,
  pageOf,
  parseOutput,
} from "@/lib/shared/server-utils";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import {
  PORTAL_PAGE_SIZE,
  PortalApprovalFilter,
  decideSchema,
  portalBrandSchema,
  portalCommentSchema,
  portalListSchema,
  portalRequestSchema,
  portalVariantSchema,
  signPortalSchema,
} from "@/lib/portal/approvals/schemas";
import {
  portalApprovalSchema,
  portalBrandsSchema,
  portalCommentsSchema,
  portalMediaKeysSchema,
  portalPageSchema,
  portalPendingSchema,
  type PortalRequestRow,
} from "@/lib/portal/approvals/dto";
import type {
  PortalApproval,
  PortalBrand,
  PortalComment,
  PortalRequest,
} from "@/lib/portal/approvals/types";

const toRequest = (row: PortalRequestRow): PortalRequest => ({
  id: row.id,
  variantId: row.variant_id,
  status: row.status,
  title: row.title,
  format: row.format,
  platform: row.platform,
  profileName: row.profile_name,
  plannedAt: row.planned_at,
  plannedTimezone: row.planned_timezone,
  brandTimezone: row.brand_timezone,
  revisionNo: row.revision_no,
  dueDate: row.due_date,
  requestedAt: row.requested_at,
  decidedAt: row.decided_at,
  isMine: row.is_mine,
  approverName: row.approver_name,
});

const statusParam = (status: string | undefined): string | null =>
  status === undefined || status === PortalApprovalFilter.All ? null : status;

export const listPortalBrands = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ brands: PortalBrand[] }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase.rpc("portal_list_brands");
    if (error) return fail(error);
    const parsed = parseOutput(portalBrandsSchema, { list: data });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      brands: parsed.list.map((row) => ({
        id: row.id,
        name: row.name,
        pendingCount: row.pending_count,
      })),
    };
  },
);

export const listPortalPending = createServerFn({ method: "GET" })
  .validator(portalBrandSchema)
  .handler(async ({ data }): Promise<Result<{ requests: PortalRequest[] }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("portal_list_pending", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(portalPendingSchema, { list: rows });
    return parsed.ok ? { ok: true, requests: parsed.list.map(toRequest) } : parsed;
  });

export const listPortalApprovals = createServerFn({ method: "GET" })
  .validator(portalListSchema)
  .handler(async ({ data }): Promise<Result<Page<PortalRequest>>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("portal_list_approvals", {
      p_brand: data.brandId,
      p_status: statusParam(data.status),
      p_page: data.page,
      p_page_size: PORTAL_PAGE_SIZE,
    });
    if (error) return fail(error);
    const parsed = parseOutput(portalPageSchema, row);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      ...pageOf(parsed.rows.map(toRequest), parsed.total, {
        page: data.page,
        pageSize: PORTAL_PAGE_SIZE,
      }),
    };
  });

export const getPortalApproval = createServerFn({ method: "GET" })
  .validator(portalRequestSchema)
  .handler(async ({ data }): Promise<Result<{ approval: PortalApproval }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("portal_get_approval", {
      p_request: data.id,
    });
    if (error) return fail(error);
    const parsed = parseOutput(portalApprovalSchema, row);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      approval: {
        request: toRequest(parsed.request),
        brandId: parsed.brand_id,
        brandName: parsed.brand_name,
        message: parsed.message,
        caption: parsed.caption?.text ?? "",
        callToAction: parsed.call_to_action,
        revisionId: parsed.revision_id,
        isCurrent: parsed.is_current,
        currentRequestId: parsed.current_request_id,
        isDesignated: parsed.is_designated,
        canDecide: parsed.can_decide,
        media: parsed.media.map((item) => ({
          versionId: item.version_id,
          position: item.position,
          altText: item.alt_text,
          mimeType: item.mime_type,
          width: item.width,
          height: item.height,
          name: item.name,
          hasThumb: item.has_thumb,
          hasDisplay: item.has_display,
        })),
        decision:
          parsed.decision === null
            ? null
            : {
                outcome: parsed.decision.outcome,
                comment: parsed.decision.comment,
                decidedAt: parsed.decision.decided_at,
                decidedByName: parsed.decision.decided_by_name,
              },
        history: parsed.history.map((item) => ({
          requestId: item.request_id,
          revisionNo: item.revision_no,
          status: item.status,
          requestedAt: item.requested_at,
          decidedAt: item.decided_at,
          comment: item.comment,
        })),
      },
    };
  });

export const recordPortalView = createServerFn({ method: "POST" })
  .validator(portalRequestSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("portal_record_view", { p_request: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const decidePortalApproval = createServerFn({ method: "POST" })
  .validator(decideSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Approvals.Decide);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("portal_decide_approval", {
      p_request: data.id,
      p_outcome: data.outcome,
      p_comment: data.comment === undefined || data.comment === "" ? null : data.comment,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const listPortalComments = createServerFn({ method: "GET" })
  .validator(portalVariantSchema)
  .handler(async ({ data }): Promise<Result<{ comments: PortalComment[] }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("portal_list_comments", {
      p_variant: data.variantId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(portalCommentsSchema, { list: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      comments: parsed.list.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        authorName: row.author_name,
        mine: row.mine,
        fromTeam: row.from_team,
        revisionNo: row.revision_no,
      })),
    };
  });

export const addPortalComment = createServerFn({ method: "POST" })
  .validator(portalCommentSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Comments.CreateExternal);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("portal_add_comment", {
      p_variant: data.variantId,
      p_body: data.body,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const signPortalMedia = createServerFn({ method: "POST" })
  .validator(signPortalSchema)
  .handler(async ({ data }): Promise<Result<{ urls: Record<string, string> }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const { data: rows, error } = await caller.supabase.rpc("portal_media_urls", {
      p_revision: data.revisionId,
      p_version_ids: data.versionIds,
    });
    if (error) return fail(error);
    const parsed = parseOutput(portalMediaKeysSchema, { list: rows });
    if (!parsed.ok) return parsed;

    const keyOf = (row: (typeof parsed.list)[number]): string | null =>
      data.variant === MediaVariant.Thumb
        ? (row.thumb_key ?? row.display_key)
        : data.variant === MediaVariant.Display
          ? (row.display_key ?? row.storage_key)
          : row.storage_key;
    const signed = await storage.signUrls(parsed.list.map(keyOf), EXTERNAL_URL_SECONDS);
    const urls: Record<string, string> = {};
    for (const row of parsed.list) {
      const key = keyOf(row);
      const url = key === null ? undefined : signed.get(key);
      if (url !== undefined) urls[row.version_id] = url;
    }
    return { ok: true, urls };
  });

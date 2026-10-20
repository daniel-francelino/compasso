import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import type { ContentObjective } from "@/lib/shared/enums";
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
import { portalBrandLogoUrls } from "@/lib/portal/brands/brand-logos.server";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import {
  PORTAL_PAGE_SIZE,
  PortalApprovalFilter,
  decideSchema,
  portalBrandSchema,
  portalCommentSchema,
  portalListSchema,
  portalRequestSchema,
  portalItemSchema,
  signPortalSchema,
  signPortalPreviewSchema,
} from "@/lib/portal/approvals/schemas";
import {
  portalApprovalSchema,
  portalBrandProfileSchema,
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
  PortalBrandProfile,
  PortalComment,
  PortalRequest,
} from "@/lib/portal/approvals/types";

const toRequest = (row: PortalRequestRow): PortalRequest => ({
  id: row.id,
  itemId: row.item_id,
  revisionId: row.revision_id,
  stage: row.stage,
  status: row.status,
  title: row.title,
  channels: row.channels.map((channel) => ({
    rowId: channel.row_id,
    platform: channel.platform,
    profileName: channel.profile_name,
    format: channel.format,
    caption: channel.caption?.text ?? null,
    plannedAt: channel.planned_at ?? null,
    plannedTimezone: channel.planned_timezone ?? null,
  })),
  media: row.media.map((item) => ({
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
  objectiveKind: (row.objective_kind ?? null) as ContentObjective | null,
  planSummary: row.plan_summary ?? null,
  brandTimezone: row.brand_timezone,
  revisionNo: row.revision_no,
  dueDate: row.due_date,
  requestedAt: row.requested_at,
  decidedAt: row.decided_at,
  canDecide: row.can_decide,
  decidedByName: row.decided_by_name,
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
    const logos = await portalBrandLogoUrls(
      caller.supabase,
      parsed.list.map((row) => row.id),
    );
    return {
      ok: true,
      brands: parsed.list.map((row) => ({
        id: row.id,
        name: row.name,
        clientName: row.client_name,
        logoUrl: logos.get(row.id) ?? null,
        pendingCount: row.pending_count,
      })),
    };
  },
);

export const getPortalBrand = createServerFn({ method: "GET" })
  .validator(portalBrandSchema)
  .handler(async ({ data }): Promise<Result<{ brand: PortalBrandProfile }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("portal_get_brand", {
      p_brand: data.brandId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(portalBrandProfileSchema, row);
    if (!parsed.ok) return parsed;
    const logos = await portalBrandLogoUrls(caller.supabase, [parsed.id]);
    return {
      ok: true,
      brand: {
        id: parsed.id,
        name: parsed.name,
        clientName: parsed.client_name,
        logoUrl: logos.get(parsed.id) ?? null,
        description: parsed.description,
        targetAudience: parsed.target_audience,
        toneOfVoice: parsed.tone_of_voice,
        objectives: parsed.objectives,
        timezone: parsed.timezone,
        channels: parsed.channels.map((channel) => ({
          platform: channel.platform,
          profileName: channel.profile_name,
          profileUrl: channel.profile_url,
        })),
      },
    };
  });

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
        planSummary: parsed.plan_summary ?? null,
        objectiveKind: (parsed.objective_kind ?? null) as ContentObjective | null,
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
  .validator(portalItemSchema)
  .handler(async ({ data }): Promise<Result<{ comments: PortalComment[] }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("portal_list_comments", {
      p_item: data.itemId,
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
      p_item: data.itemId,
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

export const signPortalPreviewMedia = createServerFn({ method: "POST" })
  .validator(signPortalPreviewSchema)
  .handler(async ({ data }): Promise<Result<{ urls: Record<string, string> }>> => {
    const caller = await requireActionServer(Action.Portal.View);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const lookups = await Promise.all(
      data.requests.map(async (request) => {
        const { data: rows, error } = await caller.supabase.rpc("portal_media_urls", {
          p_revision: request.revisionId,
          p_version_ids: request.versionIds,
        });
        if (error) return fail(error);
        return parseOutput(portalMediaKeysSchema, { list: rows });
      }),
    );
    const media: z.infer<typeof portalMediaKeysSchema>["list"] = [];
    for (const lookup of lookups) {
      if (!lookup.ok) return lookup;
      media.push(...lookup.list);
    }

    const keyOf = (row: (typeof media)[number]): string | null =>
      row.display_key ?? row.storage_key;
    const signed = await storage.signUrls(
      media.map(keyOf).filter((key): key is string => key !== null),
      EXTERNAL_URL_SECONDS,
    );
    const urls: Record<string, string> = {};
    for (const row of media) {
      const key = keyOf(row);
      const url = key === null ? undefined : signed.get(key);
      if (url !== undefined) urls[row.version_id] = url;
    }
    return { ok: true, urls };
  });

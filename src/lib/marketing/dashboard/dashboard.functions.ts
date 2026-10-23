import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { DashboardReason, EditorialStatus } from "@/lib/shared/enums";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type AttentionItem = {
  itemId: string;
  title: string;
  brandId: string;
  brandName: string;
  channels: string[];
  reasons: DashboardReason[];
};

export type PublicationPendingItem = {
  itemId: string;
  title: string;
  brandId: string;
  brandName: string;
  pendingRows: number;
  oldestPlannedAt: string;
  channels: string[];
};

export type MyItem = {
  itemId: string;
  title: string;
  brandId: string;
  brandName: string;
  productionDueDate: string | null;
  editorialStatus: EditorialStatus;
};

export type StatusCounts = Partial<Record<EditorialStatus, number>>;

const brandFilterSchema = z.object({ brandId: z.string().uuid().optional() });

const attentionSchema = z.object({
  list: z.array(
    z.object({
      item_id: z.string().uuid(),
      title: z.string(),
      brand_id: z.string().uuid(),
      brand_name: z.string(),
      channels: z.array(z.string()),
      reasons: z.array(z.nativeEnum(DashboardReason)),
    }),
  ),
});

const publicationPendingSchema = z.object({
  list: z.array(
    z.object({
      item_id: z.string().uuid(),
      title: z.string(),
      brand_id: z.string().uuid(),
      brand_name: z.string(),
      pending_rows: z.number().int(),
      oldest_planned_at: z.string(),
      channels: z.array(z.string()),
    }),
  ),
});

const countsSchema = z.object({
  counts: z.record(z.nativeEnum(EditorialStatus), z.number().int()),
});

const myItemsSchema = z.object({
  list: z.array(
    z.object({
      item_id: z.string().uuid(),
      title: z.string(),
      brand_id: z.string().uuid(),
      brand_name: z.string(),
      production_due_date: z.string().nullable(),
      editorial_status: z.nativeEnum(EditorialStatus),
    }),
  ),
});

const brandsParam = (brandId: string | undefined): string[] | null =>
  brandId === undefined ? null : [brandId];

export const getAttention = createServerFn({ method: "GET" })
  .validator(brandFilterSchema)
  .handler(async ({ data }): Promise<Result<{ items: AttentionItem[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("dashboard_attention", {
      p_brands: brandsParam(data.brandId),
    });
    if (error) return fail(error);
    const parsed = parseOutput(attentionSchema, { list: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      items: parsed.list.map((row) => ({
        itemId: row.item_id,
        title: row.title,
        brandId: row.brand_id,
        brandName: row.brand_name,
        channels: row.channels,
        reasons: row.reasons,
      })),
    };
  });

export const getPublicationPending = createServerFn({ method: "GET" })
  .validator(brandFilterSchema)
  .handler(async ({ data }): Promise<Result<{ items: PublicationPendingItem[] }>> => {
    const caller = await requireActionServer(Action.Content.PublishManual);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("dashboard_publication_pending", {
      p_brands: brandsParam(data.brandId),
    });
    if (error) return fail(error);
    const parsed = parseOutput(publicationPendingSchema, { list: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      items: parsed.list.map((row) => ({
        itemId: row.item_id,
        title: row.title,
        brandId: row.brand_id,
        brandName: row.brand_name,
        pendingRows: row.pending_rows,
        oldestPlannedAt: row.oldest_planned_at,
        channels: row.channels,
      })),
    };
  });

export const getStatusCounts = createServerFn({ method: "GET" })
  .validator(brandFilterSchema)
  .handler(async ({ data }): Promise<Result<{ counts: StatusCounts }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("dashboard_status_counts", {
      p_brands: brandsParam(data.brandId),
    });
    if (error) return fail(error);
    const parsed = parseOutput(countsSchema, { counts: row });
    return parsed.ok ? { ok: true, counts: parsed.counts } : parsed;
  });

export const getMyItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ items: MyItem[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase.rpc("dashboard_my_items");
    if (error) return fail(error);
    const parsed = parseOutput(myItemsSchema, { list: rows });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      items: parsed.list.map((row) => ({
        itemId: row.item_id,
        title: row.title,
        brandId: row.brand_id,
        brandName: row.brand_name,
        productionDueDate: row.production_due_date,
        editorialStatus: row.editorial_status,
      })),
    };
  },
);

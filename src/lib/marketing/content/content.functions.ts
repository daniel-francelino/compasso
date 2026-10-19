import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { type Caller, requireActionServer } from "@/lib/shared/auth/server-guards.server";
import {
  type ContentFormat,
  EditorialStatus,
  type Platform,
  type PublicationStatus,
} from "@/lib/shared/enums";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { personNames } from "@/lib/shared/people.server";
import { type RichDoc, isRichDocEmpty, richDocFromStored } from "@/lib/shared/rich-text/types";
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
import { SortDirection } from "@/lib/shared/list-sort";
import {
  ContentSort,
  ContentStatusFilter,
  boardSchema,
  brandIdSchema,
  cancelSchema,
  idSchema,
  listContentSchema,
  saveItemSchema,
} from "@/lib/marketing/content/schemas";

export type VariantSummary = {
  id: string;
  channelId: string;
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  editorialStatus: EditorialStatus;
  publicationStatus: PublicationStatus;
  plannedAt: string | null;
  plannedTimezone: string | null;
  thumbnailVersionId: string | null;
  version: number;
};

export type ContentItemRow = {
  id: string;
  title: string;
  brandId: string;
  brandName: string;
  assigneeName: string | null;
  productionDueDate: string | null;
  tags: string[];
  cancelled: boolean;
  updatedAt: string;
  variants: VariantSummary[];
};

export type ContentItemDetail = ContentItemRow & {
  objective: string | null;
  briefing: RichDoc | null;
  internalNotes: string | null;
  assigneeId: string | null;
  version: number;
  brandTimezone: string;
};

export type BoardCard = {
  id: string;
  itemId: string;
  title: string;
  brandName: string;
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  editorialStatus: EditorialStatus;
  plannedAt: string | null;
  plannedTimezone: string | null;
  version: number;
};

export type BoardColumn = { status: EditorialStatus; total: number; cards: BoardCard[] };

const BOARD_CARDS_PER_COLUMN = 30;
const ID_FILTER_LIMIT = 1000;

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
const firstMediaVersion = (value: unknown): string | null => {
  const parsed = z.array(z.object({ media_version_id: z.string().uuid() })).safeParse(value);
  return parsed.success ? (parsed.data[0]?.media_version_id ?? null) : null;
};

const variantSelect =
  "id, channel_id, format, editorial_status, publication_status, planned_at, planned_timezone, working_media, version, channels(platform, profile_name)";

type VariantRow = {
  id: string;
  channel_id: string;
  format: string;
  editorial_status: string;
  publication_status: string;
  planned_at: string | null;
  planned_timezone: string | null;
  working_media: unknown;
  version: number;
  channels: { platform: string; profile_name: string } | null;
};

const toVariant = (row: VariantRow): VariantSummary => ({
  id: row.id,
  channelId: row.channel_id,
  platform: (row.channels?.platform ?? "other") as Platform,
  profileName: row.channels?.profile_name ?? "",
  format: row.format as ContentFormat,
  editorialStatus: row.editorial_status as EditorialStatus,
  publicationStatus: row.publication_status as PublicationStatus,
  plannedAt: row.planned_at,
  plannedTimezone: row.planned_timezone,
  thumbnailVersionId: firstMediaVersion(row.working_media),
  version: row.version,
});

type VariantFilters = {
  brandId?: string | undefined;
  channelId?: string | undefined;
  editorial?: EditorialStatus | undefined;
  publication?: string | undefined;
};

const matchingItemIds = async (
  supabase: Caller["supabase"],
  filters: VariantFilters,
): Promise<Result<{ ids: string[] | null }>> => {
  const equals = Object.fromEntries(
    Object.entries({
      brand_id: filters.brandId,
      channel_id: filters.channelId,
      editorial_status: filters.editorial,
      publication_status: filters.publication,
    }).filter(([, value]) => value !== undefined),
  );
  const variantLevel = Object.keys(equals).some((key) => key !== "brand_id");
  if (!variantLevel) return { ok: true, ids: null };
  const { data, error } = await supabase
    .from("content_variants")
    .select("content_item_id")
    .match(equals)
    .limit(ID_FILTER_LIMIT);
  if (error) return fail(error);
  return { ok: true, ids: [...new Set(data.map((row) => row.content_item_id))] };
};

export const listContentItems = createServerFn({ method: "GET" })
  .validator(listContentSchema)
  .handler(async ({ data }): Promise<Result<Page<ContentItemRow>>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    const search = cleanSearch(data.search);

    const matched = await matchingItemIds(caller.supabase, data);
    if (!matched.ok) return matched;
    const itemIds = matched.ids;
    if (itemIds !== null && itemIds.length === 0) {
      return { ok: true, ...pageOf([], 0, { page: data.page, pageSize: PAGE_SIZE }) };
    }

    let query = caller.supabase
      .from("content_items")
      .select(
        `id, title, brand_id, assignee_id, production_due_date, tags, cancelled_at, updated_at, brands(name), content_variants(${variantSelect})`,
        { count: "exact" },
      )
      .order("created_at", { referencedTable: "content_variants" });
    query =
      data.status === ContentStatusFilter.Cancelled
        ? query.not("cancelled_at", "is", null)
        : query.is("cancelled_at", null);
    if (itemIds !== null) query = query.in("id", itemIds);
    if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);
    if (data.ownerId !== undefined) query = query.eq("assignee_id", data.ownerId);
    if (search !== "") query = query.ilike("title", `%${search}%`);
    if (data.tag !== undefined && data.tag !== "") query = query.contains("tags", [data.tag]);

    const ascending = data.dir !== SortDirection.Desc;
    query =
      data.sort === ContentSort.Title
        ? query.order("title", { ascending })
        : data.sort === ContentSort.Updated
          ? query.order("updated_at", { ascending: data.dir === SortDirection.Asc })
          : query.order("production_due_date", { ascending, nullsFirst: false });

    const { data: rows, count, error } = await query.range(from, to);
    if (error) return fail(error);

    const names = await personNames(
      caller.supabase,
      rows.map((row) => row.assignee_id),
    );
    const mapped = rows.map((row) => ({
      id: row.id,
      title: row.title,
      brandId: row.brand_id,
      brandName: row.brands?.name ?? "",
      assigneeName: row.assignee_id === null ? null : (names.get(row.assignee_id) ?? null),
      productionDueDate: row.production_due_date,
      tags: row.tags,
      cancelled: row.cancelled_at !== null,
      updatedAt: row.updated_at,
      variants: row.content_variants.map(toVariant),
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const getContentItem = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<Result<{ item: ContentItemDetail }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase
      .from("content_items")
      .select(
        `id, title, brand_id, objective, briefing, internal_notes, assignee_id, production_due_date, tags, version, cancelled_at, updated_at, brands(name, timezone), content_variants(${variantSelect})`,
      )
      .eq("id", data.id)
      .order("created_at", { referencedTable: "content_variants" })
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });
    const names = await personNames(caller.supabase, [row.assignee_id]);
    return {
      ok: true,
      item: {
        id: row.id,
        title: row.title,
        brandId: row.brand_id,
        brandName: row.brands?.name ?? "",
        brandTimezone: row.brands?.timezone ?? "America/Sao_Paulo",
        objective: row.objective,
        briefing: richDocFromStored(row.briefing),
        internalNotes: row.internal_notes,
        assigneeId: row.assignee_id,
        assigneeName: row.assignee_id === null ? null : (names.get(row.assignee_id) ?? null),
        productionDueDate: row.production_due_date,
        tags: row.tags,
        cancelled: row.cancelled_at !== null,
        updatedAt: row.updated_at,
        version: row.version,
        variants: row.content_variants.map(toVariant),
      },
    };
  });

export const saveContentItem = createServerFn({ method: "POST" })
  .validator(saveItemSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(
      data.id === undefined ? Action.Content.Create : Action.Content.Update,
    );
    if (caller === null) return denied;
    const briefing =
      data.briefing === undefined || isRichDocEmpty(data.briefing) ? null : data.briefing;
    const { data: row, error } = await caller.supabase.rpc("content_item_save", {
      p_item: {
        ...(data.id === undefined ? {} : { id: data.id }),
        brand_id: data.brandId,
        title: data.title,
        objective: data.objective ?? null,
        briefing,
        internal_notes: data.internalNotes ?? null,
        assignee_id: data.assigneeId ?? null,
        tags: data.tags,
        production_due_date: data.productionDueDate ?? null,
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const cancelContentItem = createServerFn({ method: "POST" })
  .validator(cancelSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Cancel);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("content_item_cancel", {
      p_item: data.id,
      p_reason: data.reason,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const deleteContentItem = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Content.Delete);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("content_item_delete", { p_item: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const listBoard = createServerFn({ method: "GET" })
  .validator(boardSchema)
  .handler(async ({ data }): Promise<Result<{ columns: BoardColumn[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const search = cleanSearch(data.search);
    const statuses = [
      EditorialStatus.Draft,
      EditorialStatus.InProduction,
      EditorialStatus.InternalReview,
      EditorialStatus.AwaitingApproval,
      EditorialStatus.ChangesRequested,
      EditorialStatus.Approved,
    ];

    const loadColumn = async (status: EditorialStatus): Promise<BoardColumn | null> => {
      let query = caller.supabase
        .from("content_variants")
        .select(
          "id, content_item_id, format, editorial_status, planned_at, planned_timezone, version, channels(platform, profile_name), content_items!inner(title, assignee_id, cancelled_at, brands(name))",
          { count: "exact" },
        )
        .eq("editorial_status", status)
        .is("content_items.cancelled_at", null);
      if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);
      if (data.channelId !== undefined) query = query.eq("channel_id", data.channelId);
      if (data.ownerId !== undefined) query = query.eq("content_items.assignee_id", data.ownerId);
      if (search !== "") query = query.ilike("content_items.title", `%${search}%`);
      const {
        data: rows,
        count,
        error,
      } = await query.order("updated_at", { ascending: false }).limit(BOARD_CARDS_PER_COLUMN);
      if (error) return null;
      return {
        status,
        total: count ?? rows.length,
        cards: rows.map((row) => ({
          id: row.id,
          itemId: row.content_item_id,
          title: row.content_items?.title ?? "",
          brandName: row.content_items?.brands?.name ?? "",
          platform: (row.channels?.platform ?? "other") as Platform,
          profileName: row.channels?.profile_name ?? "",
          format: row.format as ContentFormat,
          editorialStatus: row.editorial_status as EditorialStatus,
          plannedAt: row.planned_at,
          plannedTimezone: row.planned_timezone,
          version: row.version,
        })),
      };
    };

    const loaded = await Promise.all(statuses.map(loadColumn));
    const columns = loaded.filter((column): column is BoardColumn => column !== null);
    if (columns.length !== statuses.length) return fail({ message: "unknown" });
    return { ok: true, columns };
  });

export const listAssigneeOptions = createServerFn({ method: "GET" })
  .validator(brandIdSchema)
  .handler(async ({ data }): Promise<Result<{ people: { id: string; name: string }[] }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase
      .from("brand_members")
      .select("user_id")
      .eq("brand_id", data.brandId)
      .eq("kind", "internal")
      .eq("status", "active");
    if (error) return fail(error);
    const names = await personNames(
      caller.supabase,
      rows.map((row) => row.user_id),
    );
    const people = [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, people };
  });

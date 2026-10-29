import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { type Caller, requireActionServer } from "@/lib/shared/auth/server-guards.server";
import {
  type ApprovalOutcome,
  type ApprovalRequestStatus,
  ApprovalStage,
  type ContentFormat,
  type ContentTypeColor,
  EditorialStatus,
  type Platform,
  PublicationStatus,
} from "@/lib/shared/enums";
import type { ContentTypeRow } from "@/lib/shared/content-types/content-types.functions";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { personNames } from "@/lib/shared/people.server";
import { richDocFromStored } from "@/lib/shared/rich-text/types";
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
  saveContentSchema,
} from "@/lib/marketing/content/schemas";
import { planMediaOf } from "@/lib/marketing/content/plan-images";
import { REVISION_SELECT, loadMedia, toRevision } from "@/lib/marketing/content/revisions.server";
import type {
  ChannelRowDetail,
  ChannelSummary,
  ContentDetail,
  ContentMedia,
  RequestRow,
  RevisionRow,
} from "@/lib/marketing/content/types";
import { toMs } from "@/lib/shared/dates";

export type ContentItemRow = {
  id: string;
  title: string;
  brandId: string;
  brandName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  publishDate: string | null;
  types: ContentTypeRow[];
  cancelled: boolean;
  editorialStatus: EditorialStatus;
  updatedAt: string;
  thumbnailVersionId: string | null;
  version: number;
  channels: ChannelSummary[];
};

export type BoardCard = {
  id: string;
  title: string;
  brandName: string;
  editorialStatus: EditorialStatus;
  thumbnailVersionId: string | null;
  channels: ChannelSummary[];
  version: number;
};

export type BoardColumn = { status: EditorialStatus; total: number; cards: BoardCard[] };

const BOARD_CARDS_PER_COLUMN = 30;
const ID_FILTER_LIMIT = 1000;

const savedSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  channels: z.array(z.object({ id: z.string().uuid(), channel_id: z.string().uuid() })),
});
const workingMediaSchema = z.array(
  z.object({ media_version_id: z.string().uuid(), alt_text: z.string().nullable().optional() }),
);
const captionSchema = z.object({ text: z.string() });

const mediaRefs = (
  items: z.infer<typeof workingMediaSchema>,
): { id: string; alt: string | null }[] =>
  items.map((item) => ({ id: item.media_version_id, alt: item.alt_text ?? null }));

const firstMediaVersion = (value: unknown): string | null => {
  const parsed = workingMediaSchema.safeParse(value);
  return parsed.success ? (parsed.data[0]?.media_version_id ?? null) : null;
};

const CHANNEL_SELECT =
  "id, channel_id, format, caption, publication_status, planned_at, planned_timezone, position, version, published_at, published_url, published_note, channels(platform, profile_name, archived_at)";

type ChannelQueryRow = {
  id: string;
  channel_id: string;
  format: string;
  caption: unknown;
  publication_status: string;
  planned_at: string | null;
  planned_timezone: string | null;
  position: number;
  version: number;
  published_at: string | null;
  published_url: string | null;
  published_note: string | null;
  channels: { platform: string; profile_name: string; archived_at: string | null } | null;
};

const byPosition = (a: ChannelQueryRow, b: ChannelQueryRow): number => a.position - b.position;

const captionText = (value: unknown): string => {
  const parsed = captionSchema.safeParse(value);
  return parsed.success ? parsed.data.text : "";
};

const toSummary = (row: ChannelQueryRow): ChannelSummary => ({
  id: row.id,
  channelId: row.channel_id,
  platform: (row.channels?.platform ?? "other") as Platform,
  profileName: row.channels?.profile_name ?? "",
  format: row.format as ContentFormat,
  publicationStatus: row.publication_status as PublicationStatus,
  plannedAt: row.planned_at,
  plannedTimezone: row.planned_timezone,
});

const TYPES_SELECT = "content_item_types(content_types(id, name, color, emoji, archived_at))";

type TypeLinks = {
  content_types: {
    id: string;
    name: string;
    color: string;
    emoji: string | null;
    archived_at: string | null;
  } | null;
}[];

const toTypes = (links: TypeLinks): ContentTypeRow[] =>
  links
    .flatMap((link) =>
      link.content_types === null
        ? []
        : [
            {
              id: link.content_types.id,
              name: link.content_types.name,
              color: link.content_types.color as ContentTypeColor,
              emoji: link.content_types.emoji,
              archived: link.content_types.archived_at !== null,
            },
          ],
    )
    .sort((a, b) => a.name.localeCompare(b.name));

const activeRows = (rows: ChannelQueryRow[]): ChannelQueryRow[] =>
  [...rows]
    .filter((row) => row.publication_status !== PublicationStatus.Cancelled)
    .sort(byPosition);

const toDetailChannel = (row: ChannelQueryRow): ChannelRowDetail => ({
  ...toSummary(row),
  channelArchived: (row.channels?.archived_at ?? null) !== null,
  caption: captionText(row.caption),
  version: row.version,
  published:
    row.published_at === null
      ? null
      : { at: row.published_at, url: row.published_url, note: row.published_note },
});

type ItemFilters = {
  brandId?: string | undefined;
  channelId?: string | undefined;
  publication?: string | undefined;
};

const matchingItemIds = async (
  supabase: Caller["supabase"],
  filters: ItemFilters,
): Promise<Result<{ ids: string[] | null }>> => {
  const equals = Object.fromEntries(
    Object.entries({
      channel_id: filters.channelId,
      publication_status: filters.publication,
    }).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(equals).length === 0) return { ok: true, ids: null };
  let query = supabase.from("content_channels").select("content_item_id").match(equals);
  if (filters.brandId !== undefined) query = query.eq("brand_id", filters.brandId);
  const { data, error } = await query.limit(ID_FILTER_LIMIT);
  if (error) return fail(error);
  return { ok: true, ids: [...new Set(data.map((row) => row.content_item_id))] };
};

const itemIdsOfType = async (
  supabase: Caller["supabase"],
  typeId: string,
): Promise<Result<{ ids: string[] }>> => {
  const { data, error } = await supabase
    .from("content_item_types")
    .select("content_item_id")
    .eq("content_type_id", typeId)
    .limit(ID_FILTER_LIMIT);
  if (error) return fail(error);
  return { ok: true, ids: data.map((row) => row.content_item_id) };
};

const intersectIds = (left: string[] | null, right: string[] | null): string[] | null => {
  if (left === null) return right;
  if (right === null) return left;
  const allowed = new Set(right);
  return left.filter((id) => allowed.has(id));
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
    const typed =
      data.typeId === undefined ? null : await itemIdsOfType(caller.supabase, data.typeId);
    if (typed !== null && !typed.ok) return typed;
    const itemIds = intersectIds(matched.ids, typed === null ? null : typed.ids);
    if (itemIds !== null && itemIds.length === 0) {
      return { ok: true, ...pageOf([], 0, { page: data.page, pageSize: PAGE_SIZE }) };
    }

    let query = caller.supabase
      .from("content_items")
      .select(
        `id, title, brand_id, assignee_id, publish_date, cancelled_at, updated_at, editorial_status, working_media, version, brands(name), ${TYPES_SELECT}, content_channels(${CHANNEL_SELECT})`,
        { count: "exact" },
      );
    query =
      data.status === ContentStatusFilter.Cancelled
        ? query.not("cancelled_at", "is", null)
        : query.is("cancelled_at", null);
    if (itemIds !== null) query = query.in("id", itemIds);
    if (data.editorial !== undefined) query = query.eq("editorial_status", data.editorial);
    if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);
    if (data.ownerId !== undefined) query = query.eq("assignee_id", data.ownerId);
    if (search !== "") query = query.ilike("title", `%${search}%`);

    const ascending = data.dir !== SortDirection.Desc;
    const sort = data.sort ?? ContentSort.Date;
    query =
      sort === ContentSort.Title
        ? query.order("title", { ascending })
        : sort === ContentSort.Updated
          ? query.order("updated_at", { ascending: data.dir === SortDirection.Asc })
          : query.order("publish_date", { ascending, nullsFirst: false }).order("title");

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
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_id === null ? null : (names.get(row.assignee_id) ?? null),
      publishDate: row.publish_date,
      types: toTypes(row.content_item_types),
      cancelled: row.cancelled_at !== null,
      editorialStatus: row.editorial_status as EditorialStatus,
      updatedAt: row.updated_at,
      thumbnailVersionId: firstMediaVersion(row.working_media),
      version: row.version,
      channels: activeRows(row.content_channels).map(toSummary),
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

const sameMedia = (left: ContentMedia[], right: ContentMedia[]): boolean =>
  left.length === right.length &&
  left.every(
    (item, index) =>
      item.mediaVersionId === right[index]?.mediaVersionId &&
      (item.altText ?? "") === (right[index]?.altText ?? ""),
  );

const instantOf = (value: string | null): number | null => (value === null ? null : toMs(value));

const sameChannels = (revision: RevisionRow, rows: ChannelRowDetail[]): boolean =>
  revision.snapshot.channels.length === rows.length &&
  revision.snapshot.channels.every((channel, index) => {
    const row = rows[index];
    return (
      row !== undefined &&
      channel.rowId === row.id &&
      channel.format === row.format &&
      (channel.caption ?? "") === row.caption &&
      instantOf(channel.plannedAt) === instantOf(row.plannedAt)
    );
  });

export const getContentItem = createServerFn({ method: "GET" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<Result<{ item: ContentDetail }>> => {
    const caller = await requireActionServer(Action.Content.View);
    if (caller === null) return denied;
    const { supabase } = caller;

    const { data: row, error } = await supabase
      .from("content_items")
      .select(
        `id, title, brand_id, internal_notes, assignee_id, publish_date, version, cancelled_at, updated_at, editorial_status, approval_due_date, caption, call_to_action, working_media, plan_required, plan_summary, plan_media, plan_approved_revision_id, current_revision_id, approved_revision_id, brands(name, timezone), ${TYPES_SELECT}, content_channels(${CHANNEL_SELECT})`,
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });

    const [revisionsResult, requestsResult] = await Promise.all([
      supabase
        .from("content_revisions")
        .select(REVISION_SELECT)
        .eq("item_id", data.id)
        .order("revision_no", { ascending: false }),
      supabase
        .from("approval_requests")
        .select(
          "id, revision_id, stage, status, requested_by, requested_at, due_date, viewed_at, decided_at, cancelled_reason, approval_decisions(outcome, comment, decided_by)",
        )
        .eq("item_id", data.id)
        .order("requested_at", { ascending: false }),
    ]);
    if (revisionsResult.error) return fail(revisionsResult.error);
    if (requestsResult.error) return fail(requestsResult.error);

    const working = workingMediaSchema.safeParse(row.working_media);
    const mediaResult = await loadMedia(supabase, mediaRefs(working.success ? working.data : []));
    if (!mediaResult.ok) return mediaResult;
    const planned = workingMediaSchema.safeParse(row.plan_media);
    const planMediaResult = await loadMedia(
      supabase,
      mediaRefs(planned.success ? planned.data : []),
    );
    if (!planMediaResult.ok) return planMediaResult;

    const built = await Promise.all(
      revisionsResult.data.map((revision) => toRevision(supabase, revision)),
    );
    const revisions: RevisionRow[] = [];
    for (const result of built) {
      if (!result.ok) return result;
      if (result.revision === null) return fail({ message: "unknown" });
      revisions.push(result.revision);
    }

    const names = await personNames(supabase, [
      row.assignee_id,
      ...requestsResult.data.flatMap((request) => [
        request.requested_by,
        request.approval_decisions[0]?.decided_by ?? null,
      ]),
    ]);
    const numberOf = new Map(revisions.map((revision) => [revision.id, revision.revisionNo]));
    const requests: RequestRow[] = requestsResult.data.map((request) => {
      const decision = request.approval_decisions[0];
      return {
        id: request.id,
        revisionId: request.revision_id,
        revisionNo: numberOf.get(request.revision_id) ?? 0,
        stage: request.stage === ApprovalStage.Plan ? ApprovalStage.Plan : ApprovalStage.Art,
        status: request.status as ApprovalRequestStatus,
        decidedById: decision?.decided_by ?? null,
        decidedByName: decision === undefined ? null : (names.get(decision.decided_by) ?? null),
        requestedById: request.requested_by,
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

    const channels = activeRows(row.content_channels).map(toDetailChannel);
    const current = revisions.find((revision) => revision.id === row.current_revision_id);
    const text = captionText(row.caption);
    const hasUnsentChanges =
      current !== undefined &&
      (current.snapshot.caption !== text ||
        !sameChannels(current, channels) ||
        (current.stage === ApprovalStage.Plan
          ? JSON.stringify(current.snapshot.planSummary) !==
              JSON.stringify(richDocFromStored(row.plan_summary)) ||
            !sameMedia(current.media, planMediaResult.media)
          : (current.snapshot.callToAction ?? "") !== (row.call_to_action ?? "") ||
            !sameMedia(current.media, mediaResult.media)));

    return {
      ok: true,
      item: {
        id: row.id,
        version: row.version,
        brandId: row.brand_id,
        brandName: row.brands?.name ?? "",
        brandTimezone: row.brands?.timezone ?? "America/Sao_Paulo",
        title: row.title,
        internalNotes: row.internal_notes,
        assigneeId: row.assignee_id,
        assigneeName: row.assignee_id === null ? null : (names.get(row.assignee_id) ?? null),
        publishDate: row.publish_date,
        types: toTypes(row.content_item_types),
        cancelled: row.cancelled_at !== null,
        editorialStatus: row.editorial_status as EditorialStatus,
        planRequired: row.plan_required,
        planSummary: richDocFromStored(row.plan_summary),
        planMedia: planMediaResult.media,
        planApprovedRevisionId: row.plan_approved_revision_id,
        approvalDueDate: row.approval_due_date,
        caption: text,
        callToAction: row.call_to_action,
        media: mediaResult.media,
        channels,
        currentRevisionId: row.current_revision_id,
        approvedRevisionId: row.approved_revision_id,
        nextRevisionNo: (revisions[0]?.revisionNo ?? 0) + 1,
        hasUnsentChanges,
        revisions,
        requests,
        updatedAt: row.updated_at,
      },
    };
  });

export const saveContentItem = createServerFn({ method: "POST" })
  .validator(saveContentSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(
      data.id === undefined ? Action.Content.Create : Action.Content.Update,
    );
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("content_item_save", {
      p_item: {
        ...(data.id === undefined ? {} : { id: data.id }),
        brand_id: data.brandId,
        title: data.title,
        internal_notes: data.internalNotes ?? null,
        assignee_id: data.assigneeId ?? null,
        type_ids: data.typeIds,
        publish_date: data.publishDate ?? null,
        caption: { text: data.caption },
        call_to_action: data.callToAction ?? null,
        working_media: data.media.map((item) => ({
          media_version_id: item.mediaVersionId,
          alt_text: item.altText ?? null,
        })),
        plan_summary: data.planSummary ?? null,
        plan_media: planMediaOf(data.planSummary ?? null).map((item) => ({
          media_version_id: item.mediaVersionId,
          alt_text: item.altText,
        })),
        channels: data.channels.map((channel) => ({
          ...(channel.id === undefined ? {} : { id: channel.id }),
          channel_id: channel.channelId,
          format: channel.format,
          caption: channel.caption,
          planned_at: channel.plannedAt ?? null,
          planned_timezone: channel.plannedTimezone ?? null,
        })),
        ...(data.sourceNote === undefined ? {} : { source_note: data.sourceNote }),
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

const COPY_PREFIX = "Cópia de ";
const COPY_SELECT =
  "title, brand_id, internal_notes, assignee_id, caption, call_to_action, working_media, plan_summary, plan_media, content_item_types(content_type_id, content_types(archived_at)), content_channels(channel_id, format, caption, position, publication_status, channels(archived_at))";

export const duplicateContentItem = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Content.Create);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase
      .from("content_items")
      .select(COPY_SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });

    const rows = [...row.content_channels]
      .filter(
        (channel) =>
          channel.publication_status !== PublicationStatus.Cancelled &&
          channel.channels?.archived_at === null,
      )
      .sort((a, b) => a.position - b.position);
    const working = workingMediaSchema.safeParse(row.working_media);
    const planned = workingMediaSchema.safeParse(row.plan_media);
    const { data: saved, error: saveError } = await caller.supabase.rpc("content_item_save", {
      p_item: {
        brand_id: row.brand_id,
        title: `${COPY_PREFIX}${row.title}`.slice(0, 140),
        internal_notes: row.internal_notes,
        assignee_id: row.assignee_id,
        type_ids: row.content_item_types
          .filter((link) => link.content_types?.archived_at === null)
          .map((link) => link.content_type_id),
        caption: { text: captionText(row.caption) },
        call_to_action: row.call_to_action,
        working_media: working.success ? working.data : [],
        plan_summary: row.plan_summary,
        plan_media: planned.success ? planned.data : [],
        channels: rows.map((channel) => ({
          channel_id: channel.channel_id,
          format: channel.format,
          caption: captionText(channel.caption),
        })),
      },
    });
    if (saveError) return fail(saveError);
    const result = parseOutput(savedSchema, saved);
    return result.ok ? { ok: true, id: result.id } : result;
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
      EditorialStatus.Planning,
      EditorialStatus.AwaitingPlanApproval,
      EditorialStatus.PlanChangesRequested,
      EditorialStatus.PlanApproved,
      EditorialStatus.InProduction,
      EditorialStatus.InternalReview,
      EditorialStatus.AwaitingApproval,
      EditorialStatus.ChangesRequested,
      EditorialStatus.Approved,
      EditorialStatus.Published,
    ];

    const matched = await matchingItemIds(caller.supabase, {
      brandId: data.brandId,
      channelId: data.channelId,
    });
    if (!matched.ok) return matched;

    const loadColumn = async (status: EditorialStatus): Promise<BoardColumn | null> => {
      let query = caller.supabase
        .from("content_items")
        .select(
          `id, title, assignee_id, working_media, version, brands(name), content_channels(${CHANNEL_SELECT})`,
          { count: "exact" },
        )
        .eq("editorial_status", status)
        .is("cancelled_at", null);
      if (matched.ids !== null) query = query.in("id", matched.ids);
      if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);
      if (data.ownerId !== undefined) query = query.eq("assignee_id", data.ownerId);
      if (search !== "") query = query.ilike("title", `%${search}%`);
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
          title: row.title,
          brandName: row.brands?.name ?? "",
          editorialStatus: status,
          thumbnailVersionId: firstMediaVersion(row.working_media),
          channels: activeRows(row.content_channels).map(toSummary),
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

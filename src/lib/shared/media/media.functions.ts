import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type MediaScope, MediaVersionStatus } from "@/lib/shared/enums";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import { INTERNAL_URL_SECONDS, MediaKind, kindOfMime } from "@/lib/shared/media/limits";
import {
  MediaSort,
  MediaStatusFilter,
  MediaVariant,
  assetIdSchema,
  listMediaSchema,
  replaceVersionSchema,
  signMediaSchema,
  trashMediaSchema,
  updateMediaSchema,
} from "@/lib/shared/media/schemas";
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
import { serverStorage } from "@/lib/shared/storage/server-storage.server";

export type MediaRow = {
  id: string;
  name: string;
  scope: MediaScope;
  brandId: string | null;
  brandName: string | null;
  tags: string[];
  sizeBytes: number;
  kind: MediaKind;
  mime: string;
  width: number | null;
  height: number | null;
  version: number;
  trashed: boolean;
  createdAt: string;
  currentVersionId: string;
  thumbUrl: string | null;
};

export type MediaVersionRow = {
  id: string;
  versionNo: number;
  filename: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  status: MediaVersionStatus;
  createdAt: string;
  current: boolean;
  published: boolean;
};

export type MediaDetail = {
  asset: Omit<MediaRow, "thumbUrl">;
  versions: MediaVersionRow[];
  usageCount: number;
  previewUrl: string | null;
  downloadUrl: string | null;
};

const versionedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
const keysSchema = z.object({ keys: z.array(z.string()) });

const listColumns =
  "id, display_name, scope, brand_id, tags, size_bytes, version, trashed_at, created_at, brands(name), current:media_versions!media_assets_current_version_fkey!inner(id, mime_type, width, height, thumb_key, status)";

const MIME_PATTERNS: Record<MediaKind, string> = {
  [MediaKind.Image]: "image/*",
  [MediaKind.Video]: "video/*",
  [MediaKind.Document]: "application/*",
};

const ORDERS: Record<string, { column: string; ascending: boolean }> = {
  [MediaSort.Newest]: { column: "created_at", ascending: false },
  [MediaSort.Oldest]: { column: "created_at", ascending: true },
  [MediaSort.Name]: { column: "display_name", ascending: true },
  [MediaSort.Size]: { column: "size_bytes", ascending: false },
};

export const listMedia = createServerFn({ method: "GET" })
  .validator(listMediaSchema)
  .handler(async ({ data }): Promise<Result<Page<MediaRow>>> => {
    const caller = await requireActionServer(Action.Media.View);
    if (caller === null) return denied;

    const search = cleanSearch(data.search);
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    let query = caller.supabase
      .from("media_assets")
      .select(listColumns, { count: "exact" })
      .eq("current.status", MediaVersionStatus.Available);
    query =
      data.status === MediaStatusFilter.Trash
        ? query.not("trashed_at", "is", null)
        : query.is("trashed_at", null);
    if (data.scope !== undefined) query = query.eq("scope", data.scope);
    if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);
    if (data.kind !== undefined) query = query.like("current.mime_type", MIME_PATTERNS[data.kind]);
    const items =
      data.collectionId === undefined
        ? null
        : await caller.supabase
            .from("media_collection_items")
            .select("asset_id")
            .eq("collection_id", data.collectionId)
            .limit(1000);
    if (items?.error) return fail(items.error);
    if (items)
      query = query.in(
        "id",
        items.data.map((item) => item.asset_id),
      );
    if (search !== "")
      query = query.or(`display_name.ilike.%${search}%,tags.cs.{${search.toLowerCase()}}`);

    const order = ORDERS[data.order] ?? ORDERS[MediaSort.Newest];
    const {
      data: rows,
      count,
      error,
    } = await query
      .order(order?.column ?? "created_at", { ascending: order?.ascending ?? false })
      .range(from, to);
    if (error) return fail(error);

    const storage = serverStorage();
    const thumbs =
      storage === null
        ? new Map<string, string>()
        : await storage.signUrls(
            (rows ?? []).map((row) => row.current.thumb_key),
            INTERNAL_URL_SECONDS,
          );
    const mapped = (rows ?? []).map((row) => ({
      id: row.id,
      name: row.display_name,
      scope: row.scope as MediaScope,
      brandId: row.brand_id,
      brandName: row.brands?.name ?? null,
      tags: row.tags,
      sizeBytes: row.size_bytes,
      kind: kindOfMime(row.current.mime_type) ?? MediaKind.Document,
      mime: row.current.mime_type,
      width: row.current.width,
      height: row.current.height,
      version: row.version,
      trashed: row.trashed_at !== null,
      createdAt: row.created_at,
      currentVersionId: row.current.id,
      thumbUrl: row.current.thumb_key ? (thumbs.get(row.current.thumb_key) ?? null) : null,
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const getMedia = createServerFn({ method: "GET" })
  .validator(assetIdSchema)
  .handler(async ({ data }): Promise<Result<MediaDetail>> => {
    const caller = await requireActionServer(Action.Media.View);
    if (caller === null) return denied;

    const { data: asset, error } = await caller.supabase
      .from("media_assets")
      .select(
        "id, display_name, scope, brand_id, tags, size_bytes, version, trashed_at, created_at, current_version_id, brands(name), media_versions!media_versions_asset_id_fkey(id, version_no, original_filename, mime_type, size_bytes, width, height, duration_ms, status, created_at, thumb_key, display_key, storage_key, public_published_at)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (asset === null || asset.current_version_id === null) return fail({ message: "not_found" });

    const versions = [...asset.media_versions].sort((a, b) => b.version_no - a.version_no);
    const current = versions.find((version) => version.id === asset.current_version_id);
    if (current === undefined) return fail({ message: "not_found" });

    const ids = versions.map((version) => version.id);
    const usage = await caller.supabase
      .from("media_usages")
      .select("id", { count: "exact", head: true })
      .in("media_version_id", ids);

    const storage = serverStorage();
    const kind = kindOfMime(current.mime_type) ?? MediaKind.Document;
    const previewKey =
      kind === MediaKind.Image ? (current.display_key ?? current.storage_key) : current.storage_key;
    const signed =
      storage === null
        ? new Map<string, string>()
        : await storage.signUrls([previewKey], INTERNAL_URL_SECONDS);
    const downloads =
      storage === null
        ? new Map<string, string>()
        : await storage.signUrls(
            [current.storage_key],
            INTERNAL_URL_SECONDS,
            current.original_filename,
          );

    return {
      ok: true,
      asset: {
        id: asset.id,
        name: asset.display_name,
        scope: asset.scope as MediaScope,
        brandId: asset.brand_id,
        brandName: asset.brands?.name ?? null,
        tags: asset.tags,
        sizeBytes: asset.size_bytes,
        kind,
        mime: current.mime_type,
        width: current.width,
        height: current.height,
        version: asset.version,
        trashed: asset.trashed_at !== null,
        createdAt: asset.created_at,
        currentVersionId: current.id,
      },
      versions: versions.map((version) => ({
        id: version.id,
        versionNo: version.version_no,
        filename: version.original_filename,
        mime: version.mime_type,
        sizeBytes: version.size_bytes,
        width: version.width,
        height: version.height,
        durationMs: version.duration_ms,
        status: version.status as MediaVersionStatus,
        createdAt: version.created_at,
        current: version.id === asset.current_version_id,
        published: version.public_published_at !== null,
      })),
      usageCount: usage.count ?? 0,
      previewUrl: signed.get(previewKey) ?? null,
      downloadUrl: downloads.get(current.storage_key) ?? null,
    };
  });

export const updateMedia = createServerFn({ method: "POST" })
  .validator(updateMediaSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Media.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("media_update", {
      p_asset: {
        id: data.id,
        display_name: data.displayName,
        tags: data.tags,
        expected_version: data.expectedVersion,
      },
    });
    if (error) return fail(error);
    const parsed = parseOutput(versionedSchema, row);
    return parsed.ok ? { ok: true, version: parsed.version } : parsed;
  });

export const trashMedia = createServerFn({ method: "POST" })
  .validator(trashMediaSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Delete);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("media_set_trashed", {
      p_asset: data.id,
      p_trashed: data.trashed,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const deleteMediaPermanently = createServerFn({ method: "POST" })
  .validator(assetIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Delete);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const { data: row, error } = await caller.supabase.rpc("media_delete_permanently", {
      p_asset: data.id,
    });
    if (error) return fail(error);
    const keys = parseOutput(keysSchema, row);
    if (!keys.ok) return keys;
    const removed = await storage.remove(keys.keys);
    return removed.ok ? { ok: true } : fail({ message: "storage_unavailable" });
  });

export const replaceMediaVersion = createServerFn({ method: "POST" })
  .validator(replaceVersionSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Media.Update);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("media_replace_version", {
      p_asset: data.assetId,
      p_version: data.versionId,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const getStorageSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ usedBytes: number; quotaBytes: number }>> => {
    const caller = await requireActionServer(Action.Media.View);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase.rpc("media_storage_summary");
    if (error) return fail(error);
    const parsed = parseOutput(z.object({ used_bytes: z.number(), quota_bytes: z.number() }), data);
    return parsed.ok
      ? { ok: true, usedBytes: parsed.used_bytes, quotaBytes: parsed.quota_bytes }
      : parsed;
  },
);

export const signMediaUrls = createServerFn({ method: "POST" })
  .validator(signMediaSchema)
  .handler(async ({ data }): Promise<Result<{ urls: Record<string, string> }>> => {
    const caller = await requireActionServer(Action.Media.View);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const { data: rows, error } = await caller.supabase
      .from("media_versions")
      .select("id, storage_key, thumb_key, display_key, status")
      .in("id", data.versionIds)
      .eq("status", MediaVersionStatus.Available);
    if (error) return fail(error);

    const keyOf = (row: (typeof rows)[number]): string | null =>
      data.variant === MediaVariant.Thumb
        ? row.thumb_key
        : data.variant === MediaVariant.Display
          ? (row.display_key ?? row.storage_key)
          : row.storage_key;
    const signed = await storage.signUrls(rows.map(keyOf), INTERNAL_URL_SECONDS, data.downloadName);
    const urls: Record<string, string> = {};
    for (const row of rows) {
      const key = keyOf(row);
      const url = key === null ? undefined : signed.get(key);
      if (url !== undefined) urls[row.id] = url;
    }
    return { ok: true, urls };
  });

const checkSchema = z.array(z.object({ key: z.string(), status: z.string() }));

export type StorageCheck = {
  bucketObjects: number;
  bucketBytes: number;
  unknownObjects: string[];
  unknownCount: number;
  missingCount: number;
  truncated: boolean;
};

export const checkStorage = createServerFn({ method: "POST" }).handler(
  async (): Promise<Result<{ report: StorageCheck }>> => {
    const caller = await requireActionServer(Action.Media.Delete);
    if (caller === null) return denied;
    const storage = serverStorage();
    if (storage === null) return fail({ message: "storage_unavailable" });

    const { data, error } = await caller.supabase.rpc("media_storage_keys");
    if (error) return fail(error);
    const known = parseOutput(z.object({ rows: checkSchema }), { rows: data });
    if (!known.ok) return known;
    const listed = await storage.list("");
    if (listed === null) return fail({ message: "storage_unavailable" });

    const knownKeys = new Set(known.rows.map((row) => row.key));
    const bucketKeys = new Set(listed.objects.map((object) => object.key));
    const unknown = listed.objects.filter((object) => !knownKeys.has(object.key));
    const expected = known.rows.filter((row) => row.status === MediaVersionStatus.Available);
    return {
      ok: true,
      report: {
        bucketObjects: listed.objects.length,
        bucketBytes: listed.objects.reduce((sum, object) => sum + object.size, 0),
        unknownObjects: unknown.slice(0, 20).map((object) => object.key),
        unknownCount: unknown.length,
        missingCount: expected.filter((row) => !bucketKeys.has(row.key)).length,
        truncated: listed.truncated,
      },
    };
  },
);

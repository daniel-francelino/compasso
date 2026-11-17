import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { DesignPreset } from "@/lib/shared/design/types";
import {
  type VideoDocument,
  createVideoProjectSchema,
  listVideoProjectsSchema,
  recordVideoExportSchema,
  renameVideoProjectSchema,
  saveVideoProjectDraftSchema,
  saveVideoProjectVersionSchema,
  setVideoProjectTrashedSchema,
  videoDocumentSchema,
  videoProjectIdSchema,
} from "@/lib/shared/video/schemas";
import { VIDEO_PAGE_SIZE, VideoStatusFilter } from "@/lib/shared/video/types";
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

export type VideoProjectRow = {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  preset: DesignPreset;
  savedVersions: number;
  trashed: boolean;
  updatedAt: string;
};

export type VideoProjectDetail = VideoProjectRow & {
  document: VideoDocument;
  version: number;
};

export type VideoExportRow = {
  versionNo: number;
  mediaAssetId: string;
  mediaVersionId: string;
  createdAt: string;
};

const versionSchema = z.object({ version: z.number().int() });
const createdSchema = z.object({ id: z.string().uuid(), version: z.number().int() });
const idSchema = z.object({ id: z.string().uuid() });
const savedVersionSchema = z.object({
  version: z.number().int(),
  version_no: z.number().int(),
});

const rowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  brand_id: z.string().uuid(),
  preset: z.nativeEnum(DesignPreset),
  current_version_no: z.number().int(),
  trashed_at: z.string().nullable(),
  updated_at: z.string(),
  brand: z.object({ name: z.string() }),
});

const detailSchema = rowSchema.extend({
  version: z.number().int(),
  draft_document: videoDocumentSchema,
});

const exportRowSchema = z.object({
  version_no: z.number().int(),
  media_asset_id: z.string().uuid(),
  media_version_id: z.string().uuid(),
  created_at: z.string(),
});

const toRow = (row: z.infer<typeof rowSchema>): VideoProjectRow => ({
  id: row.id,
  name: row.name,
  brandId: row.brand_id,
  brandName: row.brand.name,
  preset: row.preset,
  savedVersions: row.current_version_no,
  trashed: row.trashed_at !== null,
  updatedAt: row.updated_at,
});

const ROW_COLUMNS =
  "id, name, brand_id, preset, current_version_no, trashed_at, updated_at, brand:brands(name)";

export const listVideoProjects = createServerFn({ method: "GET" })
  .validator(listVideoProjectsSchema)
  .handler(async ({ data }): Promise<Result<Page<VideoProjectRow>>> => {
    const caller = await requireActionServer(Action.Video.View);
    if (caller === null) return denied;

    const search = cleanSearch(data.search);
    const [from, to] = rangeOf(data.page, VIDEO_PAGE_SIZE);
    let query = caller.supabase.from("video_projects").select(ROW_COLUMNS, { count: "exact" });
    query =
      data.status === VideoStatusFilter.Trash
        ? query.not("trashed_at", "is", null)
        : query.is("trashed_at", null);
    if (search !== "") query = query.ilike("name", `%${search}%`);
    if (data.brandId !== undefined) query = query.eq("brand_id", data.brandId);

    const {
      data: rows,
      count,
      error,
    } = await query.order("updated_at", { ascending: false }).order("id").range(from, to);
    if (error) return fail(error);
    const parsed = parseOutput(z.object({ rows: z.array(rowSchema) }), { rows: rows ?? [] });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      ...pageOf(parsed.rows.map(toRow), count ?? 0, {
        page: data.page,
        pageSize: VIDEO_PAGE_SIZE,
      }),
    };
  });

export const getVideoProject = createServerFn({ method: "GET" })
  .validator(videoProjectIdSchema)
  .handler(async ({ data }): Promise<Result<{ project: VideoProjectDetail }>> => {
    const caller = await requireActionServer(Action.Video.View);
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase
      .from("video_projects")
      .select(`${ROW_COLUMNS}, version, draft_document`)
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });
    const parsed = parseOutput(z.object({ row: detailSchema }), { row });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      project: {
        ...toRow(parsed.row),
        document: parsed.row.draft_document,
        version: parsed.row.version,
      },
    };
  });

export const createVideoProject = createServerFn({ method: "POST" })
  .validator(createVideoProjectSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Video.Create);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("video_project_create", {
      p_brand: data.brandId,
      p_name: data.name,
      p_preset: data.preset,
      p_document: data.document,
    });
    if (error) return fail(error);
    return parseOutput(createdSchema, raw);
  });

export const saveVideoProjectDraft = createServerFn({ method: "POST" })
  .validator(saveVideoProjectDraftSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Video.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("video_project_save_draft", {
      p_project: data.id,
      p_document: data.document,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const renameVideoProject = createServerFn({ method: "POST" })
  .validator(renameVideoProjectSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Video.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("video_project_rename", {
      p_project: data.id,
      p_name: data.name,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const saveVideoProjectVersion = createServerFn({ method: "POST" })
  .validator(saveVideoProjectVersionSchema)
  .handler(async ({ data }): Promise<Result<{ version: number; versionNo: number }>> => {
    const caller = await requireActionServer(Action.Video.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("video_project_save_version", {
      p_project: data.id,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const parsed = parseOutput(savedVersionSchema, raw);
    if (!parsed.ok) return parsed;
    return { ok: true, version: parsed.version, versionNo: parsed.version_no };
  });

export const setVideoProjectTrashed = createServerFn({ method: "POST" })
  .validator(setVideoProjectTrashedSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Video.Delete);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("video_project_set_trashed", {
      p_project: data.id,
      p_trashed: data.trashed,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const listVideoExports = createServerFn({ method: "GET" })
  .validator(videoProjectIdSchema)
  .handler(async ({ data }): Promise<Result<{ exports: VideoExportRow[] }>> => {
    const caller = await requireActionServer(Action.Video.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase
      .from("video_exports")
      .select("version_no, media_asset_id, media_version_id, created_at")
      .eq("project_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return fail(error);
    const parsed = parseOutput(z.object({ rows: z.array(exportRowSchema) }), { rows: rows ?? [] });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      exports: parsed.rows.map((row) => ({
        versionNo: row.version_no,
        mediaAssetId: row.media_asset_id,
        mediaVersionId: row.media_version_id,
        createdAt: row.created_at,
      })),
    };
  });

export const recordVideoExport = createServerFn({ method: "POST" })
  .validator(recordVideoExportSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Video.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("video_project_record_export", {
      p_project: data.id,
      p_version_no: data.versionNo,
      p_media_version: data.mediaVersionId,
    });
    if (error) return fail(error);
    return parseOutput(idSchema, raw);
  });

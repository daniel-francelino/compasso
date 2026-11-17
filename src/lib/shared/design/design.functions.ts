import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { type Caller, requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { visualIdentitySchema } from "@/lib/shared/brands/visual-identity";
import {
  type DesignDocument,
  brandIdSchema,
  createDesignSchema,
  designDocumentSchema,
  designIdSchema,
  listDesignsSchema,
  recordDesignExportSchema,
  renameDesignSchema,
  restoreDesignVersionSchema,
  saveDesignDraftSchema,
  saveDesignVersionSchema,
  setDesignTemplateSchema,
  setDesignTrashedSchema,
} from "@/lib/shared/design/schemas";
import {
  DESIGN_PAGE_SIZE,
  DesignExportFormat,
  DesignPreset,
  DesignStatusFilter,
} from "@/lib/shared/design/types";
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

export type DesignRow = {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  brandTimezone: string;
  preset: DesignPreset;
  savedVersions: number;
  isTemplate: boolean;
  trashed: boolean;
  updatedAt: string;
  thumbVersionId: string | null;
};

export type DesignDetail = DesignRow & {
  document: DesignDocument;
  version: number;
};

export type DesignVersionRow = {
  versionNo: number;
  createdAt: string;
  authorName: string | null;
};

export type DesignExportRow = {
  versionNo: number;
  pageNo: number;
  format: DesignExportFormat;
  mediaAssetId: string;
  mediaVersionId: string;
  createdAt: string;
};

export type DesignBrandKit = {
  colors: { name: string; hex: string }[];
  fonts: string[];
  logoVersionId: string | null;
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
  is_template: z.boolean(),
  trashed_at: z.string().nullable(),
  updated_at: z.string(),
  brand: z.object({ name: z.string(), timezone: z.string() }),
});

const detailSchema = rowSchema.extend({
  version: z.number().int(),
  draft_document: designDocumentSchema,
});

const versionRowSchema = z.object({
  version_no: z.number().int(),
  created_at: z.string(),
  author: z.object({ full_name: z.string().nullable() }).nullable(),
});

const exportRowSchema = z.object({
  version_no: z.number().int(),
  page_no: z.number().int(),
  format: z.nativeEnum(DesignExportFormat),
  media_asset_id: z.string().uuid(),
  media_version_id: z.string().uuid(),
  created_at: z.string(),
});

const toRow = (row: z.infer<typeof rowSchema>): DesignRow => ({
  id: row.id,
  name: row.name,
  brandId: row.brand_id,
  brandName: row.brand.name,
  brandTimezone: row.brand.timezone,
  preset: row.preset,
  savedVersions: row.current_version_no,
  isTemplate: row.is_template,
  trashed: row.trashed_at !== null,
  updatedAt: row.updated_at,
  thumbVersionId: null,
});

const thumbRowSchema = z.object({
  design_id: z.string().uuid(),
  media_version_id: z.string().uuid(),
});

const firstPageThumbs = async (
  supabase: Caller["supabase"],
  ids: readonly string[],
): Promise<Result<{ thumbs: Map<string, string> }>> => {
  if (ids.length === 0) return { ok: true, thumbs: new Map() };
  const { data, error } = await supabase
    .from("design_exports")
    .select("design_id, media_version_id")
    .in("design_id", [...ids])
    .eq("page_no", 1)
    .order("created_at", { ascending: false });
  if (error) return fail(error);
  const parsed = parseOutput(z.object({ rows: z.array(thumbRowSchema) }), { rows: data ?? [] });
  if (!parsed.ok) return parsed;
  const thumbs = new Map<string, string>();
  for (const row of parsed.rows) {
    if (!thumbs.has(row.design_id)) thumbs.set(row.design_id, row.media_version_id);
  }
  return { ok: true, thumbs };
};

const ROW_COLUMNS =
  "id, name, brand_id, preset, current_version_no, is_template, trashed_at, updated_at, brand:brands(name, timezone)";

export const listDesigns = createServerFn({ method: "GET" })
  .validator(listDesignsSchema)
  .handler(async ({ data }): Promise<Result<Page<DesignRow>>> => {
    const caller = await requireActionServer(Action.Design.View);
    if (caller === null) return denied;

    const search = cleanSearch(data.search);
    const [from, to] = rangeOf(data.page, DESIGN_PAGE_SIZE);
    let query = caller.supabase.from("designs").select(ROW_COLUMNS, { count: "exact" });
    query =
      data.status === DesignStatusFilter.Trash
        ? query.not("trashed_at", "is", null)
        : query.is("trashed_at", null);
    if (data.status === DesignStatusFilter.Templates) query = query.eq("is_template", true);
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
    const thumbs = await firstPageThumbs(
      caller.supabase,
      parsed.rows.map((row) => row.id),
    );
    if (!thumbs.ok) return thumbs;
    const withThumbs = parsed.rows.map((row) => ({
      ...toRow(row),
      thumbVersionId: thumbs.thumbs.get(row.id) ?? null,
    }));
    return {
      ok: true,
      ...pageOf(withThumbs, count ?? 0, {
        page: data.page,
        pageSize: DESIGN_PAGE_SIZE,
      }),
    };
  });

export const getDesign = createServerFn({ method: "GET" })
  .validator(designIdSchema)
  .handler(async ({ data }): Promise<Result<{ design: DesignDetail }>> => {
    const caller = await requireActionServer(Action.Design.View);
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase
      .from("designs")
      .select(`${ROW_COLUMNS}, version, draft_document`)
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });
    const parsed = parseOutput(z.object({ row: detailSchema }), { row });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      design: {
        ...toRow(parsed.row),
        document: parsed.row.draft_document,
        version: parsed.row.version,
      },
    };
  });

export const createDesign = createServerFn({ method: "POST" })
  .validator(createDesignSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Design.Create);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_create", {
      p_brand: data.brandId,
      p_name: data.name,
      p_preset: data.preset,
      p_document: data.document ?? null,
    });
    if (error) return fail(error);
    return parseOutput(createdSchema, raw);
  });

export const saveDesignDraft = createServerFn({ method: "POST" })
  .validator(saveDesignDraftSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Design.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_save_draft", {
      p_design: data.id,
      p_document: data.document,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const renameDesign = createServerFn({ method: "POST" })
  .validator(renameDesignSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Design.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_rename", {
      p_design: data.id,
      p_name: data.name,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const saveDesignVersion = createServerFn({ method: "POST" })
  .validator(saveDesignVersionSchema)
  .handler(async ({ data }): Promise<Result<{ version: number; versionNo: number }>> => {
    const caller = await requireActionServer(Action.Design.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_save_version", {
      p_design: data.id,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const parsed = parseOutput(savedVersionSchema, raw);
    if (!parsed.ok) return parsed;
    return { ok: true, version: parsed.version, versionNo: parsed.version_no };
  });

export const setDesignTrashed = createServerFn({ method: "POST" })
  .validator(setDesignTrashedSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Design.Delete);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_set_trashed", {
      p_design: data.id,
      p_trashed: data.trashed,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const listDesignVersions = createServerFn({ method: "GET" })
  .validator(designIdSchema)
  .handler(async ({ data }): Promise<Result<{ versions: DesignVersionRow[] }>> => {
    const caller = await requireActionServer(Action.Design.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase
      .from("design_versions")
      .select("version_no, created_at, author:profiles!design_versions_created_by_fkey(full_name)")
      .eq("design_id", data.id)
      .order("version_no", { ascending: false })
      .limit(100);
    if (error) return fail(error);
    const parsed = parseOutput(z.object({ rows: z.array(versionRowSchema) }), { rows: rows ?? [] });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      versions: parsed.rows.map((row) => ({
        versionNo: row.version_no,
        createdAt: row.created_at,
        authorName: row.author?.full_name ?? null,
      })),
    };
  });

export const restoreDesignVersion = createServerFn({ method: "POST" })
  .validator(restoreDesignVersionSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Design.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_restore_version", {
      p_design: data.id,
      p_version_no: data.versionNo,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const setDesignTemplate = createServerFn({ method: "POST" })
  .validator(setDesignTemplateSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Design.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_set_template", {
      p_design: data.id,
      p_template: data.template,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return parseOutput(versionSchema, raw);
  });

export const listDesignExports = createServerFn({ method: "GET" })
  .validator(designIdSchema)
  .handler(async ({ data }): Promise<Result<{ exports: DesignExportRow[] }>> => {
    const caller = await requireActionServer(Action.Design.View);
    if (caller === null) return denied;
    const { data: rows, error } = await caller.supabase
      .from("design_exports")
      .select("version_no, page_no, format, media_asset_id, media_version_id, created_at")
      .eq("design_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return fail(error);
    const parsed = parseOutput(z.object({ rows: z.array(exportRowSchema) }), { rows: rows ?? [] });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      exports: parsed.rows.map((row) => ({
        versionNo: row.version_no,
        pageNo: row.page_no,
        format: row.format,
        mediaAssetId: row.media_asset_id,
        mediaVersionId: row.media_version_id,
        createdAt: row.created_at,
      })),
    };
  });

export const recordDesignExport = createServerFn({ method: "POST" })
  .validator(recordDesignExportSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Design.Update);
    if (caller === null) return denied;
    const { data: raw, error } = await caller.supabase.rpc("design_record_export", {
      p_design: data.id,
      p_version_no: data.versionNo,
      p_page_no: data.pageNo,
      p_format: data.format,
      p_scale: data.scale,
      p_media_version: data.mediaVersionId,
    });
    if (error) return fail(error);
    return parseOutput(idSchema, raw);
  });

export const getDesignBrandKit = createServerFn({ method: "GET" })
  .validator(brandIdSchema)
  .handler(async ({ data }): Promise<Result<{ kit: DesignBrandKit }>> => {
    const caller = await requireActionServer(Action.Design.View);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase
      .from("brands")
      .select("visual_identity, logo_media_version_id")
      .eq("id", data.brandId)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });
    const identity = visualIdentitySchema.safeParse(row.visual_identity);
    const colors = identity.success
      ? identity.data.colors.map((color) => ({ name: color.name, hex: color.hex.toLowerCase() }))
      : [];
    return {
      ok: true,
      kit: {
        colors,
        fonts: identity.success ? identity.data.fonts : [],
        logoVersionId: row.logo_media_version_id,
      },
    };
  });

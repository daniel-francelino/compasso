import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createPageSchema, pageIdSchema, savePageSchema } from "@/lib/cms/schemas";
import { loadPageRefs, loadSnapshot } from "@/lib/cms/context.server";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Json, toJson } from "@/lib/shared/content/published";
import { draftPageSchema } from "@/lib/shared/content/schemas";
import { SitePageKind, SitePageStatus } from "@/lib/shared/enums";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

export type SiteOverview = {
  exists: boolean;
  pagesTotal: number;
  pagesPublished: number;
  pagesWithChanges: number;
  lastPublishedAt: string | null;
  settingsPublished: boolean;
  settingsDirty: boolean;
  messagesNew: number;
  withdrawnCases: number;
};

export type SitePageRow = {
  id: string;
  kind: SitePageKind;
  slug: string;
  title: string;
  status: SitePageStatus;
  version: number;
  isSystem: boolean;
  updatedAt: string;
  revisionNo: number | null;
  hasChanges: boolean;
  authorized: boolean;
};

export type PageEditorData = {
  id: string;
  kind: SitePageKind;
  slug: string;
  status: SitePageStatus;
  version: number;
  isSystem: boolean;
  authorized: boolean;
  hash: string;
  draft: Json;
};

const overviewSchema = z.object({
  exists: z.boolean(),
  pages_total: z.number().int(),
  pages_published: z.number().int(),
  pages_with_changes: z.number().int(),
  last_published_at: z.string().nullable(),
  settings_published: z.boolean(),
  settings_dirty: z.boolean(),
  messages_new: z.number().int(),
  withdrawn_cases: z.number().int(),
});

const pagesSchema = z.object({
  list: z.array(
    z.object({
      id: z.string().uuid(),
      kind: z.nativeEnum(SitePageKind),
      slug: z.string(),
      title: z.string().nullable(),
      status: z.nativeEnum(SitePageStatus),
      version: z.number().int(),
      is_system: z.boolean(),
      updated_at: z.string(),
      revision_no: z.number().int().nullable(),
      has_changes: z.boolean(),
      authorized: z.boolean(),
    }),
  ),
});

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

export const getSiteOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ overview: SiteOverview }>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const ensured = await caller.supabase.rpc("site_ensure");
    if (ensured.error) return fail(ensured.error);
    const { data, error } = await caller.supabase.rpc("site_overview");
    if (error) return fail(error);
    const parsed = parseOutput(overviewSchema, data);
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      overview: {
        exists: parsed.exists,
        pagesTotal: parsed.pages_total,
        pagesPublished: parsed.pages_published,
        pagesWithChanges: parsed.pages_with_changes,
        lastPublishedAt: parsed.last_published_at,
        settingsPublished: parsed.settings_published,
        settingsDirty: parsed.settings_dirty,
        messagesNew: parsed.messages_new,
        withdrawnCases: parsed.withdrawn_cases,
      },
    };
  },
);

export const listSitePages = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ pages: SitePageRow[] }>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const ensured = await caller.supabase.rpc("site_ensure");
    if (ensured.error) return fail(ensured.error);
    const { data, error } = await caller.supabase.rpc("site_pages_overview");
    if (error) return fail(error);
    const parsed = parseOutput(pagesSchema, { list: data });
    if (!parsed.ok) return parsed;
    return {
      ok: true,
      pages: parsed.list.map((row) => ({
        id: row.id,
        kind: row.kind,
        slug: row.slug,
        title: row.title ?? "",
        status: row.status,
        version: row.version,
        isSystem: row.is_system,
        updatedAt: row.updated_at,
        revisionNo: row.revision_no,
        hasChanges: row.has_changes,
        authorized: row.authorized,
      })),
    };
  },
);

export const getPageEditor = createServerFn({ method: "GET" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result<{ page: PageEditorData }>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const loaded = await loadSnapshot(caller, data.pageId);
    if (!loaded.ok) return loaded;
    const { snapshot } = loaded;
    const draft = draftPageSchema.safeParse(snapshot.draft_content);
    return {
      ok: true,
      page: {
        id: snapshot.id,
        kind: snapshot.kind,
        slug: snapshot.slug,
        status: snapshot.status,
        version: snapshot.version,
        isSystem: snapshot.is_system,
        authorized: snapshot.authorized,
        hash: snapshot.hash,
        draft: toJson(draft.success ? draft.data : draftPageSchema.parse({})),
      },
    };
  });

export const createSitePage = createServerFn({ method: "POST" })
  .validator(createPageSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Site.Structure);
    if (caller === null) return denied;
    const draft = draftPageSchema.parse({ title: data.title });
    const { data: row, error } = await caller.supabase.rpc("site_page_save", {
      p_page: { kind: data.kind, slug: data.slug, draft_content: toJson(draft) },
    });
    if (error) return fail(error);
    const parsed = parseOutput(savedSchema, row);
    return parsed.ok ? { ok: true, id: parsed.id } : parsed;
  });

export const saveSitePage = createServerFn({ method: "POST" })
  .validator(savePageSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Site.Edit);
    if (caller === null) return denied;
    const draft = draftPageSchema.safeParse(data.draft);
    if (!draft.success) return invalid("Confira os campos destacados.");
    const { data: row, error } = await caller.supabase.rpc("site_page_save", {
      p_page: {
        id: data.pageId,
        kind: data.kind,
        slug: data.slug,
        draft_content: toJson(draft.data),
      },
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const parsed = parseOutput(savedSchema, row);
    return parsed.ok ? { ok: true, version: parsed.version } : parsed;
  });

export const deleteSitePage = createServerFn({ method: "POST" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Structure);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_page_delete", { p_page: data.pageId });
    if (error) return fail(error);
    return { ok: true };
  });

export type PageOption = {
  id: string;
  title: string;
  slug: string;
  kind: SitePageKind;
  anchors: { sectionId: string; anchor: string }[];
};

export const listPageOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ pages: PageOption[] }>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const loaded = await loadPageRefs(caller);
    if (!loaded.ok) return loaded;
    return {
      ok: true,
      pages: loaded.pages.map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.slug,
        kind: page.kind,
        anchors: Object.entries(page.anchors).map(([sectionId, anchor]) => ({ sectionId, anchor })),
      })),
    };
  },
);

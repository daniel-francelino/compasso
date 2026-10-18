import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadResolveContext, loadSnapshot } from "@/lib/cms/context.server";
import { pageIdSchema, publishPageSchema, rollbackSchema } from "@/lib/cms/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Problem, hasErrors, resolveDraftPage } from "@/lib/shared/content/resolve";
import { type PublishedPage, toJson } from "@/lib/shared/content/published";
import type { SitePageStatus } from "@/lib/shared/enums";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

export type PublishCheck = {
  hash: string;
  problems: Problem[];
  status: SitePageStatus;
  title: string;
};

export type RevisionRow = {
  id: string;
  revisionNo: number;
  note: string | null;
  publishedAt: string;
  current: boolean;
  fromRevisionNo: number | null;
};

const publishedSchema = z.object({ revision_no: z.number().int() });

export const checkPublish = createServerFn({ method: "GET" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result<{ check: PublishCheck }>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const loaded = await loadSnapshot(caller, data.pageId);
    if (!loaded.ok) return loaded;
    const context = await loadResolveContext(caller, loaded.snapshot);
    if (!context.ok) return context;
    const resolved = resolveDraftPage(loaded.snapshot.draft_content, context.ctx);
    return {
      ok: true,
      check: {
        hash: loaded.snapshot.hash,
        problems: resolved.problems,
        status: loaded.snapshot.status,
        title: resolved.published.page.title,
      },
    };
  });

export const publishSitePage = createServerFn({ method: "POST" })
  .validator(publishPageSchema)
  .handler(async ({ data }): Promise<Result<{ revisionNo: number }>> => {
    const caller = await requireActionServer(Action.Site.Publish);
    if (caller === null) return denied;
    const loaded = await loadSnapshot(caller, data.pageId);
    if (!loaded.ok) return loaded;
    const context = await loadResolveContext(caller, loaded.snapshot);
    if (!context.ok) return context;
    const resolved = resolveDraftPage(loaded.snapshot.draft_content, context.ctx);
    if (hasErrors(resolved.problems)) {
      return invalid("Corrija os itens destacados antes de publicar.");
    }
    const { data: row, error } = await caller.supabase.rpc("publish_site_page", {
      p_page: data.pageId,
      p_note: data.note ?? "",
      p_resolved: toJson({ ...resolved.published, draft_hash: loaded.snapshot.hash }),
      p_expected_hash: loaded.snapshot.hash,
    });
    if (error) return fail(error);
    const parsed = parseOutput(publishedSchema, row);
    return parsed.ok ? { ok: true, revisionNo: parsed.revision_no } : parsed;
  });

export const unpublishSitePage = createServerFn({ method: "POST" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Publish);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("unpublish_site_page", { p_page: data.pageId });
    if (error) return fail(error);
    return { ok: true };
  });

export const listRevisions = createServerFn({ method: "GET" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result<{ revisions: RevisionRow[] }>> => {
    const caller = await requireActionServer(Action.Site.Publish);
    if (caller === null) return denied;
    const [page, revisions] = await Promise.all([
      caller.supabase
        .from("site_pages")
        .select("published_revision_id")
        .eq("id", data.pageId)
        .maybeSingle(),
      caller.supabase
        .from("site_page_revisions")
        .select("id, revision_no, note, published_at, source_revision_id")
        .eq("page_id", data.pageId)
        .order("revision_no", { ascending: false })
        .limit(100),
    ]);
    if (page.error) return fail(page.error);
    if (revisions.error) return fail(revisions.error);
    const numbers = new Map(revisions.data.map((row) => [row.id, row.revision_no]));
    return {
      ok: true,
      revisions: revisions.data.map((row) => ({
        id: row.id,
        revisionNo: row.revision_no,
        note: row.note,
        publishedAt: row.published_at,
        current: row.id === page.data?.published_revision_id,
        fromRevisionNo: row.source_revision_id
          ? (numbers.get(row.source_revision_id) ?? null)
          : null,
      })),
    };
  });

export const rollbackSitePage = createServerFn({ method: "POST" })
  .validator(rollbackSchema)
  .handler(async ({ data }): Promise<Result<{ revisionNo: number }>> => {
    const caller = await requireActionServer(Action.Site.Publish);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("site_rollback", {
      p_page: data.pageId,
      p_revision: data.revisionId,
    });
    if (error) return fail(error);
    const parsed = parseOutput(publishedSchema, row);
    return parsed.ok ? { ok: true, revisionNo: parsed.revision_no } : parsed;
  });

export type PreviewData = {
  page: PublishedPage;
  mediaIds: string[];
  slug: string;
};

export const getPreview = createServerFn({ method: "GET" })
  .validator(pageIdSchema)
  .handler(async ({ data }): Promise<Result<PreviewData>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const loaded = await loadSnapshot(caller, data.pageId);
    if (!loaded.ok) return loaded;
    const context = await loadResolveContext(caller, loaded.snapshot);
    if (!context.ok) return context;
    const resolved = resolveDraftPage(loaded.snapshot.draft_content, context.ctx);
    return {
      ok: true,
      page: resolved.published,
      mediaIds: resolved.mediaIds,
      slug: loaded.snapshot.slug,
    };
  });

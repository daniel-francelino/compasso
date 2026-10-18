import { z } from "zod";
import type { Caller } from "@/lib/shared/auth/server-guards.server";
import type { PageRef } from "@/lib/shared/content/links";
import { mediaIdsIn } from "@/lib/shared/content/media-ids";
import type { EntryRow, MediaRef, ResolveContext } from "@/lib/shared/content/resolve";
import type { SettingsContext } from "@/lib/shared/content/resolve-settings";
import { draftPageSchema, settingsSchemas } from "@/lib/shared/content/schemas";
import { type SiteEntryKind, SitePageKind, SitePageStatus } from "@/lib/shared/enums";
import { type Result, fail, parseOutput } from "@/lib/shared/server-utils";

const snapshotSchema = z.object({
  id: z.string().uuid(),
  kind: z.nativeEnum(SitePageKind),
  slug: z.string(),
  status: z.nativeEnum(SitePageStatus),
  version: z.number().int(),
  draft_content: z.unknown(),
  hash: z.string(),
  is_system: z.boolean(),
  authorized: z.boolean(),
});

export type DraftSnapshot = z.infer<typeof snapshotSchema>;

const mediaInfoSchema = z.record(
  z.object({
    checksum: z.string().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    published: z.boolean(),
  }),
);

export const mediaBaseUrl = (): string | null => {
  const value = process.env["SITE_MEDIA_BASE_URL"] ?? "";
  return value.startsWith("https://") ? value : null;
};

const anchorsOf = (draft: unknown): Record<string, string> => {
  const parsed = draftPageSchema.safeParse(draft);
  if (!parsed.success) return {};
  return Object.fromEntries(
    parsed.data.sections.flatMap((section) =>
      section.anchor === undefined ? [] : [[section.id, section.anchor] as const],
    ),
  );
};

const titleOf = (draft: unknown): string => {
  const parsed = draftPageSchema.safeParse(draft);
  return parsed.success ? parsed.data.title : "";
};

export const loadPageRefs = async (caller: Caller): Promise<Result<{ pages: PageRef[] }>> => {
  const [pages, authorizations] = await Promise.all([
    caller.supabase.from("site_pages").select("id, kind, slug, status, draft_content"),
    caller.supabase
      .from("site_case_study_authorizations")
      .select("page_id")
      .is("withdrawn_at", null),
  ]);
  if (pages.error) return fail(pages.error);
  if (authorizations.error) return fail(authorizations.error);
  const authorized = new Set(authorizations.data.map((row) => row.page_id));
  return {
    ok: true,
    pages: pages.data.map((row) => ({
      id: row.id,
      kind: row.kind as SitePageKind,
      slug: row.slug,
      status: row.status as SitePageStatus,
      authorized: authorized.has(row.id),
      title: titleOf(row.draft_content),
      anchors: anchorsOf(row.draft_content),
    })),
  };
};

const loadMedia = async (
  caller: Caller,
  ids: string[],
): Promise<Result<{ media: Record<string, MediaRef> }>> => {
  if (ids.length === 0) return { ok: true, media: {} };
  const { data, error } = await caller.supabase.rpc("site_media_info", { p_ids: ids });
  if (error) return fail(error);
  const parsed = parseOutput(z.object({ info: mediaInfoSchema }), { info: data });
  return parsed.ok ? { ok: true, media: parsed.info } : parsed;
};

export const loadEntries = async (caller: Caller): Promise<Result<{ entries: EntryRow[] }>> => {
  const { data, error } = await caller.supabase
    .from("site_entries")
    .select("kind, content, sort_order, visible");
  if (error) return fail(error);
  return {
    ok: true,
    entries: data.map((row) => ({
      kind: row.kind as SiteEntryKind,
      content: row.content,
      sortOrder: row.sort_order,
      visible: row.visible,
    })),
  };
};

export const loadSiteSettings = async (
  caller: Caller,
): Promise<
  Result<{ siteId: string | null; settings: Record<string, unknown>; version: number }>
> => {
  const { data, error } = await caller.supabase
    .from("sites")
    .select("id, settings, settings_version")
    .limit(1)
    .maybeSingle();
  if (error) return fail(error);
  if (data === null) return { ok: true, siteId: null, settings: {}, version: 1 };
  const settings =
    typeof data.settings === "object" && data.settings !== null && !Array.isArray(data.settings)
      ? { ...data.settings }
      : {};
  return { ok: true, siteId: data.id, settings, version: data.settings_version };
};

export const loadSnapshot = async (
  caller: Caller,
  pageId: string,
): Promise<Result<{ snapshot: DraftSnapshot }>> => {
  const { data, error } = await caller.supabase.rpc("site_draft_snapshot", { p_page: pageId });
  if (error) return fail(error);
  const parsed = parseOutput(z.object({ snapshot: snapshotSchema }), { snapshot: data });
  return parsed.ok ? { ok: true, snapshot: parsed.snapshot } : parsed;
};

export const loadResolveContext = async (
  caller: Caller,
  snapshot: DraftSnapshot,
): Promise<Result<{ ctx: ResolveContext }>> => {
  const [refs, entries, settings] = await Promise.all([
    loadPageRefs(caller),
    loadEntries(caller),
    loadSiteSettings(caller),
  ]);
  if (!refs.ok) return refs;
  if (!entries.ok) return entries;
  if (!settings.ok) return settings;
  const media = await loadMedia(
    caller,
    mediaIdsIn(snapshot.draft_content, entries.entries, settings.settings),
  );
  if (!media.ok) return media;
  const contacts = settingsSchemas.contacts.parse(settings.settings["contacts"] ?? {});
  return {
    ok: true,
    ctx: {
      page: {
        id: snapshot.id,
        kind: snapshot.kind,
        slug: snapshot.slug,
        hasPublished: snapshot.status === SitePageStatus.Published,
      },
      pages: refs.pages,
      entries: entries.entries,
      settings: { contacts },
      media: media.media,
      mediaBaseUrl: mediaBaseUrl(),
    },
  };
};

export const loadSettingsContext = async (
  caller: Caller,
  siteId: string,
  settings: Record<string, unknown>,
): Promise<Result<{ ctx: SettingsContext }>> => {
  const refs = await loadPageRefs(caller);
  if (!refs.ok) return refs;
  const media = await loadMedia(caller, mediaIdsIn(settings));
  if (!media.ok) return media;
  return {
    ok: true,
    ctx: { siteId, pages: refs.pages, media: media.media, mediaBaseUrl: mediaBaseUrl() },
  };
};

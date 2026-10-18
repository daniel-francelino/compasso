import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadSettingsContext, loadSiteSettings } from "@/lib/cms/context.server";
import {
  entryIdSchema,
  publishSettingsSchema,
  redirectSchema,
  saveSettingsSchema,
} from "@/lib/cms/schemas";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Json, toJson } from "@/lib/shared/content/published";
import { type Problem, hasErrors } from "@/lib/shared/content/resolve";
import { resolveSettings } from "@/lib/shared/content/resolve-settings";
import { settingsSchemas } from "@/lib/shared/content/schemas";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

export type SettingsData = {
  settings: Json;
  version: number;
  siteId: string | null;
  problems: Problem[];
};

export type RedirectRow = { id: string; from: string; to: string; permanent: boolean };

const versionSchema = z.object({ version: z.number().int() });

export const getSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<SettingsData>> => {
    const caller = await requireActionServer(Action.Site.View);
    if (caller === null) return denied;
    const ensured = await caller.supabase.rpc("site_ensure");
    if (ensured.error) return fail(ensured.error);
    const loaded = await loadSiteSettings(caller);
    if (!loaded.ok) return loaded;
    if (loaded.siteId === null) return fail({ message: "unknown" });
    const context = await loadSettingsContext(caller, loaded.siteId, loaded.settings);
    if (!context.ok) return context;
    const resolved = resolveSettings(loaded.settings, context.ctx);
    return {
      ok: true,
      settings: toJson(loaded.settings),
      version: loaded.version,
      siteId: loaded.siteId,
      problems: resolved.problems,
    };
  },
);

export const saveSettings = createServerFn({ method: "POST" })
  .validator(saveSettingsSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Site.Settings);
    if (caller === null) return denied;
    const value = settingsSchemas[data.group].safeParse(data.value);
    if (!value.success) return invalid("Confira os campos destacados.");
    const { data: row, error } = await caller.supabase.rpc("site_settings_save", {
      p_group: data.group,
      p_value: toJson(value.data) as Record<string, Json>,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    const parsed = parseOutput(versionSchema, row);
    return parsed.ok ? { ok: true, version: parsed.version } : parsed;
  });

export const publishSettings = createServerFn({ method: "POST" })
  .validator(publishSettingsSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Publish);
    if (caller === null) return denied;
    const loaded = await loadSiteSettings(caller);
    if (!loaded.ok) return loaded;
    if (loaded.siteId === null) return fail({ message: "unknown" });
    const context = await loadSettingsContext(caller, loaded.siteId, loaded.settings);
    if (!context.ok) return context;
    const resolved = resolveSettings(loaded.settings, context.ctx);
    if (hasErrors(resolved.problems))
      return invalid("Corrija os itens destacados antes de publicar.");
    const { error } = await caller.supabase.rpc("publish_site_settings", {
      p_resolved: toJson(resolved.published) as Record<string, Json>,
      p_expected_version: data.expectedVersion,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const listRedirects = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ redirects: RedirectRow[] }>> => {
    const caller = await requireActionServer(Action.Site.Settings);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("site_redirects")
      .select("id, from_path, to_path, permanent")
      .order("from_path")
      .limit(200);
    if (error) return fail(error);
    return {
      ok: true,
      redirects: data.map((row) => ({
        id: row.id,
        from: row.from_path,
        to: row.to_path,
        permanent: row.permanent,
      })),
    };
  },
);

export const saveRedirect = createServerFn({ method: "POST" })
  .validator(redirectSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Settings);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_redirect_save", {
      p_redirect: { from_path: data.from, to_path: data.to, permanent: data.permanent },
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const deleteRedirect = createServerFn({ method: "POST" })
  .validator(entryIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Site.Settings);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("site_redirect_delete", { p_redirect: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

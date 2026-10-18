import {
  type CaseStudyCard,
  type PublicPageAnswer,
  type PublishedSettings,
  publicPageAnswerSchema,
  publishedSettingsSchema,
} from "@/lib/shared/content/published";
import { logError } from "@/lib/shared/logger";
import { anonClient } from "@/lib/shared/supabase/anon.server";
import { z } from "zod";

const READ_TIMEOUT_MS = 4000;

export type PageRead = { kind: "answer"; answer: PublicPageAnswer } | { kind: "error" };
export type SettingsRead =
  { kind: "settings"; settings: PublishedSettings } | { kind: "none" } | { kind: "error" };

const lastGoodPages = new Map<string, PublicPageAnswer>();
let lastGoodSettings: PublishedSettings | null = null;

const sitemapSchema = z.object({
  published: z.boolean(),
  pages: z.array(z.object({ slug: z.string(), updated_at: z.string() })),
});

export type Sitemap = z.infer<typeof sitemapSchema>;

export const readPublicPage = async (slug: string): Promise<PageRead> => {
  const { data, error } = await anonClient()
    .rpc("site_published_page", { p_slug: slug })
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));
  const parsed = publicPageAnswerSchema.safeParse(data);
  if (error || !parsed.success) {
    logError("site: reading the published page failed", error?.code ?? "invalid_output");
    const cached = lastGoodPages.get(slug);
    return cached ? { kind: "answer", answer: cached } : { kind: "error" };
  }
  if (parsed.data.status === "ok") lastGoodPages.set(slug, parsed.data);
  return { kind: "answer", answer: parsed.data };
};

export const readPublicSettings = async (): Promise<SettingsRead> => {
  const { data, error } = await anonClient()
    .rpc("site_published_settings")
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));
  if (error) {
    logError("site: reading the published settings failed", error.code);
    return lastGoodSettings ? { kind: "settings", settings: lastGoodSettings } : { kind: "error" };
  }
  if (data === null) return { kind: "none" };
  const parsed = publishedSettingsSchema.safeParse(data);
  if (!parsed.success) {
    logError("site: the published settings have an unknown format");
    return lastGoodSettings ? { kind: "settings", settings: lastGoodSettings } : { kind: "error" };
  }
  lastGoodSettings = parsed.data;
  return { kind: "settings", settings: parsed.data };
};

export const readSitemap = async (): Promise<Sitemap | null> => {
  const { data, error } = await anonClient()
    .rpc("site_published_sitemap")
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));
  const parsed = sitemapSchema.safeParse(data);
  if (error || !parsed.success) {
    logError("site: reading the sitemap failed", error?.code ?? "invalid_output");
    return null;
  }
  return parsed.data;
};

export const caseStudiesOf = (answer: PublicPageAnswer): CaseStudyCard[] =>
  answer.status === "ok" ? answer.case_studies : [];

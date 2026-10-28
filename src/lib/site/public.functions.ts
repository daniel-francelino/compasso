import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  turnstileConfigured,
  turnstileSiteKey,
  verifyTurnstile,
  withinRateLimit,
} from "@/lib/site/contact.server";
import { readPublicPage, readPublicSettings } from "@/lib/site/public-reader.server";
import { markResponseStatus } from "@/lib/site/response-status.server";
import type {
  CaseStudyCard,
  PublishedPage,
  PublishedSettings,
} from "@/lib/shared/content/published";
import { PublicSiteState } from "@/lib/shared/enums";
import { logError } from "@/lib/shared/logger";
import { type Result, fail } from "@/lib/shared/server-utils";
import { siteOrigin } from "@/lib/shared/site-url.server";
import { anonClient } from "@/lib/shared/supabase/anon.server";

export type PublicSiteResult =
  | {
      state: typeof PublicSiteState.Ok;
      page: PublishedPage;
      caseStudies: CaseStudyCard[];
      settings: PublishedSettings | null;
      turnstileSiteKey: string | null;
      origin: string;
    }
  | { state: typeof PublicSiteState.Redirect; to: string; permanent: boolean }
  | { state: typeof PublicSiteState.NotFound; settings: PublishedSettings | null }
  | { state: typeof PublicSiteState.None };

const slugSchema = z.object({ slug: z.string().max(200) });

const cleanSlug = (slug: string): string => slug.replace(/^\/+|\/+$/g, "");

const preparing = (): PublicSiteResult => {
  markResponseStatus(503);
  return { state: PublicSiteState.None };
};

export const getPublicSite = createServerFn({ method: "GET" })
  .validator(slugSchema)
  .handler(async ({ data }): Promise<PublicSiteResult> => {
    const slug = cleanSlug(data.slug);
    const [page, settings] = await Promise.all([readPublicPage(slug), readPublicSettings()]);
    if (page.kind === "error") return preparing();
    const published = settings.kind === "settings" ? settings.settings : null;
    const answer = page.answer;
    if (answer.status === PublicSiteState.None) return preparing();
    if (answer.status === PublicSiteState.Redirect) {
      return { state: PublicSiteState.Redirect, to: answer.to, permanent: answer.permanent };
    }
    if (answer.status === PublicSiteState.NotFound) {
      markResponseStatus(404);
      return { state: PublicSiteState.NotFound, settings: published };
    }
    setResponseHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return {
      state: PublicSiteState.Ok,
      page: answer.content,
      caseStudies: answer.case_studies,
      settings: published,
      turnstileSiteKey: turnstileSiteKey(),
      origin: siteOrigin(),
    };
  });

export const getContactConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ turnstileSiteKey: string | null }> => ({
    turnstileSiteKey: turnstileSiteKey(),
  }),
);

const contactSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120),
  email: z.string().trim().max(200),
  phone: z.string().trim().max(40),
  message: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
  consent: z.boolean(),
  website: z.string().max(200),
  turnstileToken: z.string().max(4096),
  slug: z.string().max(200),
});

const clientIp = (): string =>
  (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";

export const submitContactMessage = createServerFn({ method: "POST" })
  .validator(contactSchema)
  .handler(async ({ data }): Promise<Result> => {
    if (data.website !== "") return { ok: true };
    if (!turnstileConfigured()) return fail({ message: "contact_unavailable" });
    const ip = clientIp();
    if (!withinRateLimit(ip === "" ? "unknown" : ip)) return fail({ message: "rate_limited" });
    const check = await verifyTurnstile(data.turnstileToken, ip);
    if (check === "unavailable") return fail({ message: "contact_unavailable" });
    if (check === "failed") return fail({ message: "captcha_failed" });

    const settings = await readPublicSettings();
    if (settings.kind !== "settings") return fail({ message: "contact_unavailable" });
    const { error } = await anonClient().rpc("site_contact_submit", {
      p_site: settings.settings.site_id,
      p_payload: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message,
        consent: data.consent,
        source_slug: cleanSlug(data.slug),
      },
    });
    if (error) {
      logError("site: saving a contact message failed", error.code);
      return fail(error);
    }
    return { ok: true };
  });

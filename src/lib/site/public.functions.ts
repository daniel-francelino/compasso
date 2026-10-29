import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { type ContactMessageInput, contactMessageSchema } from "@/lib/site/contact-schemas";
import {
  turnstileConfigured,
  turnstileSiteKey,
  verifyTurnstile,
  withinRateLimit,
} from "@/lib/site/contact.server";
import { isStaticAssetPath } from "@/lib/site/static-path";
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
    if (isStaticAssetPath(slug)) {
      markResponseStatus(404);
      return { state: PublicSiteState.NotFound, settings: null };
    }
    const reads = await Promise.all([readPublicPage(slug), readPublicSettings()]).catch((error) => {
      logError("site: reading the published site failed", error);
      return null;
    });
    if (reads === null) return preparing();
    const [page, settings] = reads;
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

const clientIp = (): string =>
  (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";

export const getContactConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ turnstileSiteKey: string | null }> => {
    try {
      return { turnstileSiteKey: turnstileSiteKey() };
    } catch (error) {
      logError("site: reading the contact configuration failed", error);
      return { turnstileSiteKey: null };
    }
  },
);

const antiBotFailure = async (token: string, ip: string): Promise<Result | null> => {
  if (!turnstileConfigured()) return null;
  const check = await verifyTurnstile(token, ip);
  if (check === "unavailable") return fail({ message: "contact_unavailable" });
  if (check === "failed") return fail({ message: "captcha_failed" });
  return null;
};

const saveContactMessage = async (data: ContactMessageInput): Promise<Result> => {
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
};

export const submitContactMessage = createServerFn({ method: "POST" })
  .validator(contactMessageSchema)
  .handler(async ({ data }): Promise<Result> => {
    if (data.website !== "") return { ok: true };
    const ip = clientIp();
    if (!withinRateLimit(ip === "" ? "unknown" : ip)) return fail({ message: "rate_limited" });
    const blocked = await antiBotFailure(data.turnstileToken, ip);
    if (blocked !== null) return blocked;
    try {
      return await saveContactMessage(data);
    } catch (error) {
      logError("site: a contact message could not be handled", error);
      return fail({ message: "contact_unavailable" });
    }
  });

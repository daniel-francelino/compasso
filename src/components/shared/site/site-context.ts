import type { CaseStudyCard, PublishedMedia } from "@/lib/shared/content/published";

export type ContactPayload = {
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
  website: string;
  turnstileToken: string;
};

export type ContactOutcome = { ok: true } | { ok: false; message: string };

export type SiteRenderContext = {
  media: PublishedMedia;
  caseStudies: CaseStudyCard[];
  siteId: string | null;
  pageSlug: string;
  turnstileSiteKey: string | null;
  preview: boolean;
  submitContact: ((payload: ContactPayload) => Promise<ContactOutcome>) | null;
};

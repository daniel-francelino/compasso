import { z } from "zod";
import { PublicSiteState, SitePageKind } from "@/lib/shared/enums";

export const PUBLISHED_FORMAT = 1;

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ]),
);

export const toJson = (value: unknown): Json => jsonSchema.parse(JSON.parse(JSON.stringify(value)));

export const mediaEntrySchema = z.object({
  small: z.string(),
  large: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});

export type PublishedMedia = Record<string, z.infer<typeof mediaEntrySchema>>;

export const publishedSectionSchema = z.object({
  id: z.string(),
  component: z.string(),
  content: z.record(jsonSchema),
  appearance: z.record(jsonSchema).default({}),
  anchor: z.string().optional(),
});

export type PublishedSection = z.infer<typeof publishedSectionSchema>;

export const cardSchema = z.object({
  title: z.string(),
  summary: z.string().default(""),
  imageVersionId: z.string().uuid().nullable().default(null),
});

export const publishedPageSchema = z.object({
  format: z.literal(PUBLISHED_FORMAT),
  draft_hash: z.string().optional(),
  page: z.object({
    id: z.string(),
    slug: z.string(),
    kind: z.nativeEnum(SitePageKind),
    title: z.string(),
    seo: z.object({
      title: z.string().default(""),
      description: z.string().default(""),
      ogImage: z.string().uuid().nullable().optional(),
      noindex: z.boolean().optional(),
    }),
    card: cardSchema.optional(),
    sections: z.array(publishedSectionSchema),
  }),
  media: z.record(mediaEntrySchema).default({}),
});

export type PublishedPage = z.infer<typeof publishedPageSchema>;

export const caseStudyCardSchema = z.object({
  page_id: z.string(),
  slug: z.string(),
  card: cardSchema,
  media: z.record(mediaEntrySchema).default({}),
});

export type CaseStudyCard = z.infer<typeof caseStudyCardSchema>;

export const publicPageAnswerSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal(PublicSiteState.None) }),
  z.object({ status: z.literal(PublicSiteState.NotFound) }),
  z.object({
    status: z.literal(PublicSiteState.Redirect),
    to: z.string(),
    permanent: z.boolean(),
  }),
  z.object({
    status: z.literal(PublicSiteState.Ok),
    kind: z.nativeEnum(SitePageKind),
    content: publishedPageSchema,
    case_studies: z.array(caseStudyCardSchema).default([]),
  }),
]);

export type PublicPageAnswer = z.infer<typeof publicPageAnswerSchema>;

const publishedLinkSchema = z.object({ href: z.string(), newTab: z.boolean() });

export const publishedSettingsSchema = z.object({
  site_id: z.string().uuid(),
  contacts: z
    .object({
      whatsapp: z.string().default(""),
      email: z.string().default(""),
      phone: z.string().default(""),
    })
    .default({}),
  social: z.record(z.string()).default({}),
  seo_defaults: z
    .object({
      title: z.string().default(""),
      description: z.string().default(""),
      ogImage: z.string().uuid().nullable().optional(),
    })
    .default({}),
  navigation: z
    .object({
      header: z
        .array(
          z.object({
            label: z.string(),
            link: publishedLinkSchema.nullable().default(null),
            children: z
              .array(
                z.object({ label: z.string(), link: publishedLinkSchema.nullable().default(null) }),
              )
              .default([]),
          }),
        )
        .default([]),
      footer: z
        .array(z.object({ label: z.string(), link: publishedLinkSchema.nullable().default(null) }))
        .default([]),
    })
    .default({}),
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().default(""),
      link: publishedLinkSchema.nullable().default(null),
    })
    .default({}),
  media: z.record(mediaEntrySchema).default({}),
});

export type PublishedSettings = z.infer<typeof publishedSettingsSchema>;

export const resolvedCtaSchema = z
  .object({ label: z.string(), href: z.string(), newTab: z.boolean() })
  .nullable();

export type ResolvedCta = z.infer<typeof resolvedCtaSchema>;

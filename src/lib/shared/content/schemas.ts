import { z } from "zod";
import {
  ImageSide,
  LinkKind,
  PortfolioSource,
  SectionAccent,
  SectionBackground,
  SectionKind,
  SectionSpacing,
  SiteEntryKind,
  SiteSettingsGroup,
} from "@/lib/shared/enums";

const text = (max: number) => z.string().max(max).default("");

export const linkSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal(LinkKind.Page),
    pageId: z.string().uuid(),
    newTab: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal(LinkKind.Anchor),
    pageId: z.string().uuid(),
    sectionId: z.string().min(1).max(60),
    newTab: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal(LinkKind.CaseStudy),
    pageId: z.string().uuid(),
    newTab: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal(LinkKind.Url),
    url: z.string().max(500),
    newTab: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal(LinkKind.Whatsapp),
    message: z.string().max(300).default(""),
    newTab: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal(LinkKind.Email),
    subject: z.string().max(150).optional(),
    newTab: z.boolean().optional(),
  }),
  z.object({ kind: z.literal(LinkKind.Phone), newTab: z.boolean().optional() }),
]);

export type SiteLink = z.infer<typeof linkSchema>;

export const imageSchema = z.object({
  mediaVersionId: z.string().uuid().nullable().default(null),
  alt: text(300),
  decorative: z.boolean().default(false),
});

export type SiteImage = z.infer<typeof imageSchema>;

export const ctaSchema = z.object({
  label: text(40),
  link: linkSchema.nullable().default(null),
});

export type SiteCta = z.infer<typeof ctaSchema>;

export const heroSchema = z.object({
  eyebrow: text(60),
  headline: text(80),
  subheadline: text(300),
  image: imageSchema.default({}),
  primaryCta: ctaSchema.default({}),
  secondaryCta: ctaSchema.default({}),
});

export const servicesGridSchema = z.object({
  title: text(80),
  intro: text(300),
  limit: z.number().int().min(1).max(24).default(6),
});

export const portfolioGridSchema = z.object({
  title: text(80),
  source: z.nativeEnum(PortfolioSource).default(PortfolioSource.All),
  caseStudyIds: z.array(z.string().uuid()).max(24).default([]),
  limit: z.number().int().min(1).max(24).default(6),
});

export const testimonialsSchema = z.object({
  title: text(80),
  limit: z.number().int().min(1).max(24).default(6),
});

export const richTextSchema = z.object({ body: text(6000) });

export const imageTextSchema = z.object({
  image: imageSchema.default({}),
  side: z.nativeEnum(ImageSide).default(ImageSide.Left),
  title: text(80),
  text: text(600),
  cta: ctaSchema.default({}),
});

export const gallerySchema = z.object({
  title: text(80),
  images: z.array(imageSchema).max(12).default([]),
});

export const faqSchema = z.object({
  title: text(80),
  items: z
    .array(z.object({ question: text(160), answer: text(600) }))
    .max(30)
    .default([]),
});

export const contactFormSchema = z.object({
  title: text(80),
  intro: text(300),
  recipientEmail: text(200),
  consentText: text(300),
  successMessage: text(200),
});

export const sectionContentSchemas = {
  [SectionKind.Hero]: heroSchema,
  [SectionKind.ServicesGrid]: servicesGridSchema,
  [SectionKind.PortfolioGrid]: portfolioGridSchema,
  [SectionKind.Testimonials]: testimonialsSchema,
  [SectionKind.RichText]: richTextSchema,
  [SectionKind.ImageText]: imageTextSchema,
  [SectionKind.Gallery]: gallerySchema,
  [SectionKind.Faq]: faqSchema,
  [SectionKind.ContactForm]: contactFormSchema,
} as const;

export const appearanceSchema = z.object({
  background: z.nativeEnum(SectionBackground).optional(),
  spacing: z.nativeEnum(SectionSpacing).optional(),
  accent: z.nativeEnum(SectionAccent).optional(),
});

export type Appearance = z.infer<typeof appearanceSchema>;

export const anchorSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens.")
  .max(40);

export const sectionSchema = z.object({
  id: z.string().min(1).max(60),
  component: z.nativeEnum(SectionKind),
  schemaVersion: z.number().int().default(1),
  content: z.record(z.unknown()).default({}),
  appearance: appearanceSchema.default({}),
  anchor: anchorSchema.optional(),
  visible: z.boolean().default(true),
});

export type DraftSection = z.infer<typeof sectionSchema>;

export const seoSchema = z.object({
  title: text(70),
  description: text(170),
  ogImage: z.string().uuid().nullable().optional(),
  noindex: z.boolean().optional(),
});

export type PageSeo = z.infer<typeof seoSchema>;

export const draftPageSchema = z.object({
  title: text(120),
  seo: seoSchema.default({}),
  sections: z.array(sectionSchema).max(40).default([]),
});

export type DraftPage = z.infer<typeof draftPageSchema>;

export const serviceEntrySchema = z.object({
  icon: text(40),
  name: text(80),
  description: text(400),
  link: linkSchema.nullable().default(null),
});

export const testimonialEntrySchema = z.object({
  quote: text(400),
  author: text(80),
  role: text(80),
  photo: imageSchema.default({}),
});

export const entryContentSchemas = {
  [SiteEntryKind.Service]: serviceEntrySchema,
  [SiteEntryKind.Testimonial]: testimonialEntrySchema,
} as const;

const navItemSchema = z.object({ label: text(60), link: linkSchema.nullable().default(null) });

export const settingsSchemas = {
  [SiteSettingsGroup.Contacts]: z.object({
    whatsapp: z
      .string()
      .regex(/^\d{10,15}$/, "Informe só números, com o código do país.")
      .or(z.literal(""))
      .default(""),
    email: text(200),
    phone: text(40),
  }),
  [SiteSettingsGroup.Social]: z.object({
    instagram: text(200),
    linkedin: text(200),
    facebook: text(200),
    youtube: text(200),
  }),
  [SiteSettingsGroup.Languages]: z.object({
    default: z.string().default("pt-BR"),
    active: z.array(z.string()).default(["pt-BR"]),
  }),
  [SiteSettingsGroup.SeoDefaults]: z.object({
    title: text(70),
    description: text(170),
    ogImage: z.string().uuid().nullable().optional(),
  }),
  [SiteSettingsGroup.Navigation]: z.object({
    header: z
      .array(navItemSchema.extend({ children: z.array(navItemSchema).max(8).default([]) }))
      .max(8)
      .default([]),
    footer: z.array(navItemSchema).max(12).default([]),
  }),
  [SiteSettingsGroup.MessageTemplates]: z.object({ whatsapp: text(300) }),
  [SiteSettingsGroup.Announcement]: z.object({
    enabled: z.boolean().default(false),
    text: text(160),
    link: linkSchema.nullable().default(null),
  }),
} as const;

export type SiteSettings = {
  [K in SiteSettingsGroup]: z.infer<(typeof settingsSchemas)[K]>;
};

export type HeroContent = z.infer<typeof heroSchema>;
export type ImageTextContent = z.infer<typeof imageTextSchema>;
export type GalleryContent = z.infer<typeof gallerySchema>;

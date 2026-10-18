import {
  type LinkContext,
  type PageRef,
  LinkProblem,
  resolveLink,
} from "@/lib/shared/content/links";
import { publicUrls } from "@/lib/shared/content/media-urls";
import {
  PUBLISHED_FORMAT,
  toJson,
  type Json,
  type PublishedMedia,
  type PublishedPage,
  type PublishedSection,
} from "@/lib/shared/content/published";
import { parseSectionContent } from "@/lib/shared/content/registry";
import { parseRichText } from "@/lib/shared/content/rich-text";
import {
  type DraftPage,
  type GalleryContent,
  type HeroContent,
  type ImageTextContent,
  type SiteCta,
  type SiteImage,
  type SiteLink,
  type SiteSettings,
  draftPageSchema,
  serviceEntrySchema,
  testimonialEntrySchema,
} from "@/lib/shared/content/schemas";
import { ProblemSeverity, SectionKind, SitePageKind, SiteEntryKind } from "@/lib/shared/enums";

export type MediaRef = {
  checksum: string | null;
  width: number | null;
  height: number | null;
  published: boolean;
};

export type EntryRow = {
  kind: SiteEntryKind;
  content: unknown;
  sortOrder: number;
  visible: boolean;
};

export type ResolveContext = {
  page: { id: string; kind: SitePageKind; slug: string; hasPublished: boolean };
  pages: PageRef[];
  entries: EntryRow[];
  settings: Partial<SiteSettings>;
  media: Record<string, MediaRef>;
  mediaBaseUrl: string | null;
};

export type Problem = {
  severity: ProblemSeverity;
  code: string;
  message: string;
  sectionId?: string;
};

const error = (code: string, message: string, sectionId?: string): Problem => ({
  severity: ProblemSeverity.Error,
  code,
  message,
  ...(sectionId === undefined ? {} : { sectionId }),
});

const warning = (code: string, message: string, sectionId?: string): Problem => ({
  severity: ProblemSeverity.Warning,
  code,
  message,
  ...(sectionId === undefined ? {} : { sectionId }),
});

const linkMessages: Record<LinkProblem, string> = {
  [LinkProblem.MissingPage]: "Um botão aponta para uma página que não existe mais.",
  [LinkProblem.UnpublishedPage]: "Um botão aponta para uma página que não está no ar.",
  [LinkProblem.MissingAnchor]: "Um botão aponta para uma seção que não tem âncora.",
  [LinkProblem.UnauthorizedCase]: "Um botão aponta para um case sem autorização.",
  [LinkProblem.InvalidUrl]: "Um endereço precisa começar com https:// ou com /.",
  [LinkProblem.MissingContact]: "Falta o contato (WhatsApp, e-mail ou telefone) nas configurações.",
};

type Collector = { problems: Problem[]; mediaIds: Set<string> };

const contactsOf = (settings: Partial<SiteSettings>) => ({
  whatsapp: settings.contacts?.whatsapp ?? "",
  email: settings.contacts?.email ?? "",
  phone: settings.contacts?.phone ?? "",
});

const linkContextOf = (ctx: ResolveContext, title: string): LinkContext => ({
  selfId: ctx.page.id,
  pages: ctx.pages,
  contacts: contactsOf(ctx.settings),
  pageTitle: title,
});

const linkOf = (
  link: SiteLink | null,
  linkCtx: LinkContext,
  collector: Collector,
  sectionId: string,
): { href: string; newTab: boolean } | null => {
  if (link === null) return null;
  const outcome = resolveLink(link, linkCtx);
  if (outcome.problem !== null) {
    collector.problems.push(
      error(`link_${outcome.problem}`, linkMessages[outcome.problem], sectionId),
    );
  }
  return outcome.link;
};

const ctaOf = (cta: SiteCta, linkCtx: LinkContext, collector: Collector, sectionId: string) => {
  const link = linkOf(cta.link, linkCtx, collector, sectionId);
  if (cta.label === "" || link === null) return null;
  return { label: cta.label, ...link };
};

const imageOf = (
  image: SiteImage,
  collector: Collector,
  ctx: ResolveContext,
  sectionId: string,
) => {
  if (image.mediaVersionId === null) return null;
  collector.mediaIds.add(image.mediaVersionId);
  if (!image.decorative && image.alt.trim() === "") {
    collector.problems.push(
      error("image_alt_missing", "Falta o texto alternativo de uma imagem.", sectionId),
    );
  }
  const info = ctx.media[image.mediaVersionId];
  if (info === undefined || !info.published) {
    collector.problems.push(
      error(
        "image_not_published",
        "Há uma imagem que ainda não foi publicada para o site.",
        sectionId,
      ),
    );
  }
  return { mediaVersionId: image.mediaVersionId, alt: image.decorative ? "" : image.alt };
};

const requireText = (value: string, label: string, collector: Collector, sectionId: string) => {
  if (value.trim() === "") {
    collector.problems.push(error("required_missing", `Falta preencher «${label}».`, sectionId));
  }
};

const entriesOf = (ctx: ResolveContext, kind: SiteEntryKind, limit: number) =>
  ctx.entries
    .filter((entry) => entry.kind === kind && entry.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, limit);

type Resolver = (
  content: Record<string, unknown>,
  env: { ctx: ResolveContext; linkCtx: LinkContext; collector: Collector; id: string },
) => Record<string, unknown>;

const resolvers: Record<SectionKind, Resolver> = {
  [SectionKind.Hero]: (raw, { ctx, linkCtx, collector, id }) => {
    const content = parseSectionContent(SectionKind.Hero, raw) as HeroContent;
    requireText(content.headline, "Título", collector, id);
    return {
      eyebrow: content.eyebrow,
      headline: content.headline,
      subheadline: content.subheadline,
      image: imageOf(content.image, collector, ctx, id),
      primaryCta: ctaOf(content.primaryCta, linkCtx, collector, id),
      secondaryCta: ctaOf(content.secondaryCta, linkCtx, collector, id),
    };
  },
  [SectionKind.ServicesGrid]: (raw, { ctx, linkCtx, collector, id }) => {
    const content = parseSectionContent(SectionKind.ServicesGrid, raw) as {
      title: string;
      intro: string;
      limit: number;
    };
    const items = entriesOf(ctx, SiteEntryKind.Service, content.limit).map((entry) => {
      const service = serviceEntrySchema.parse(entry.content);
      const link = linkOf(service.link, linkCtx, collector, id);
      return { icon: service.icon, name: service.name, description: service.description, link };
    });
    if (items.length === 0) {
      collector.problems.push(warning("section_empty", "A seção de serviços não tem itens.", id));
    }
    return { title: content.title, intro: content.intro, items };
  },
  [SectionKind.PortfolioGrid]: (raw) => {
    const content = parseSectionContent(SectionKind.PortfolioGrid, raw) as {
      title: string;
      source: string;
      caseStudyIds: string[];
      limit: number;
    };
    return { ...content };
  },
  [SectionKind.Testimonials]: (raw, { ctx, collector, id }) => {
    const content = parseSectionContent(SectionKind.Testimonials, raw) as {
      title: string;
      limit: number;
    };
    const items = entriesOf(ctx, SiteEntryKind.Testimonial, content.limit).map((entry) => {
      const testimonial = testimonialEntrySchema.parse(entry.content);
      return {
        quote: testimonial.quote,
        author: testimonial.author,
        role: testimonial.role,
        photo: imageOf(testimonial.photo, collector, ctx, id),
      };
    });
    if (items.length === 0) {
      collector.problems.push(
        warning("section_empty", "A seção de depoimentos não tem itens.", id),
      );
    }
    return { title: content.title, items };
  },
  [SectionKind.RichText]: (raw, { collector, id }) => {
    const content = parseSectionContent(SectionKind.RichText, raw) as { body: string };
    requireText(content.body, "Texto", collector, id);
    return { blocks: parseRichText(content.body) };
  },
  [SectionKind.ImageText]: (raw, { ctx, linkCtx, collector, id }) => {
    const content = parseSectionContent(SectionKind.ImageText, raw) as ImageTextContent;
    requireText(content.title, "Título", collector, id);
    return {
      image: imageOf(content.image, collector, ctx, id),
      side: content.side,
      title: content.title,
      text: content.text,
      cta: ctaOf(content.cta, linkCtx, collector, id),
    };
  },
  [SectionKind.Gallery]: (raw, { ctx, collector, id }) => {
    const content = parseSectionContent(SectionKind.Gallery, raw) as GalleryContent;
    const images = content.images.map((image) => imageOf(image, collector, ctx, id));
    if (images.filter((image) => image !== null).length === 0) {
      collector.problems.push(
        error("required_missing", "A galeria precisa de ao menos uma imagem.", id),
      );
    }
    return { title: content.title, images };
  },
  [SectionKind.Faq]: (raw, { collector, id }) => {
    const content = parseSectionContent(SectionKind.Faq, raw) as {
      title: string;
      items: { question: string; answer: string }[];
    };
    const items = content.items.filter(
      (item) => item.question.trim() !== "" && item.answer.trim() !== "",
    );
    if (items.length === 0) {
      collector.problems.push(
        error("required_missing", "Adicione ao menos uma pergunta com resposta.", id),
      );
    }
    return { title: content.title, items };
  },
  [SectionKind.ContactForm]: (raw, { collector, id }) => {
    const content = parseSectionContent(SectionKind.ContactForm, raw) as {
      title: string;
      intro: string;
      consentText: string;
      successMessage: string;
    };
    requireText(content.consentText, "Texto do consentimento", collector, id);
    requireText(content.successMessage, "Mensagem de sucesso", collector, id);
    return {
      title: content.title,
      intro: content.intro,
      consentText: content.consentText,
      successMessage: content.successMessage,
    };
  },
};

const checkPage = (
  draft: DraftPage,
  ctx: ResolveContext,
  collector: Collector,
  visible: PublishedSection[],
) => {
  if (draft.seo.title.trim() === "" || draft.seo.description.trim() === "") {
    collector.problems.push(
      error("seo_missing", "Preencha o título e a descrição de SEO da página."),
    );
  }
  const anchors = draft.sections
    .filter((section) => section.visible)
    .map((section) => section.anchor);
  const seen = new Set<string>();
  for (const anchor of anchors) {
    if (anchor === undefined) continue;
    if (seen.has(anchor))
      collector.problems.push(error("anchor_duplicate", `A âncora «${anchor}» se repete.`));
    seen.add(anchor);
  }
  if (visible.length === 0) {
    const isFirstHome = ctx.page.kind === SitePageKind.Home && !ctx.page.hasPublished;
    collector.problems.push(
      isFirstHome
        ? error("home_empty", "A página inicial precisa de ao menos uma seção visível.")
        : warning("page_empty", "A página não tem nenhuma seção visível."),
    );
  }
};

const toJsonRecord = (value: Record<string, unknown>): Record<string, Json> => {
  const json = toJson(value);
  return typeof json === "object" && json !== null && !Array.isArray(json) ? json : {};
};

export type ResolvedPage = {
  published: PublishedPage;
  problems: Problem[];
  mediaIds: string[];
};

export const resolveDraftPage = (rawDraft: unknown, ctx: ResolveContext): ResolvedPage => {
  const draft = draftPageSchema.parse(rawDraft);
  const collector: Collector = { problems: [], mediaIds: new Set() };
  const linkCtx = linkContextOf(ctx, draft.title);

  const sections: PublishedSection[] = [];
  for (const section of draft.sections) {
    if (!section.visible) continue;
    const content = resolvers[section.component](section.content, {
      ctx,
      linkCtx,
      collector,
      id: section.id,
    });
    sections.push({
      id: section.id,
      component: section.component,
      content: toJsonRecord(content),
      appearance: toJsonRecord(section.appearance),
      ...(section.anchor === undefined ? {} : { anchor: section.anchor }),
    });
  }
  checkPage(draft, ctx, collector, sections);
  if (draft.seo.ogImage) collector.mediaIds.add(draft.seo.ogImage);

  const media: PublishedMedia = {};
  for (const id of collector.mediaIds) {
    const info = ctx.media[id];
    if (info?.published && info.checksum !== null && ctx.mediaBaseUrl !== null) {
      media[id] = {
        ...publicUrls(info.checksum, ctx.mediaBaseUrl),
        width: info.width,
        height: info.height,
      };
    }
  }
  if (collector.mediaIds.size > 0 && ctx.mediaBaseUrl === null) {
    collector.problems.push(
      error("media_base_missing", "O endereço público das imagens não está configurado."),
    );
  }

  const firstImage = draft.sections
    .map(
      (section) => (section.content["image"] ?? null) as { mediaVersionId?: string | null } | null,
    )
    .find((image) => image?.mediaVersionId);
  const published: PublishedPage = {
    format: PUBLISHED_FORMAT,
    page: {
      id: ctx.page.id,
      slug: ctx.page.slug,
      kind: ctx.page.kind,
      title: draft.title,
      seo: draft.seo,
      ...(ctx.page.kind === SitePageKind.CaseStudy
        ? {
            card: {
              title: draft.title,
              summary: draft.seo.description,
              imageVersionId: firstImage?.mediaVersionId ?? null,
            },
          }
        : {}),
      sections,
    },
    media,
  };
  if (published.page.card?.imageVersionId)
    collector.mediaIds.add(published.page.card.imageVersionId);
  return { published, problems: collector.problems, mediaIds: [...collector.mediaIds] };
};

export const hasErrors = (problems: Problem[]): boolean =>
  problems.some((problem) => problem.severity === ProblemSeverity.Error);

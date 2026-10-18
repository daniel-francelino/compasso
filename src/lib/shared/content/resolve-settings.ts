import { type PageRef, LinkProblem, resolveLink } from "@/lib/shared/content/links";
import { publicUrls } from "@/lib/shared/content/media-urls";
import type { PublishedMedia, PublishedSettings } from "@/lib/shared/content/published";
import type { MediaRef, Problem } from "@/lib/shared/content/resolve";
import { type SiteLink, type SiteSettings, settingsSchemas } from "@/lib/shared/content/schemas";
import { ProblemSeverity, SiteSettingsGroup } from "@/lib/shared/enums";

export type SettingsContext = {
  siteId: string;
  pages: PageRef[];
  media: Record<string, MediaRef>;
  mediaBaseUrl: string | null;
};

export type ResolvedSettings = {
  published: Omit<PublishedSettings, "site_id">;
  problems: Problem[];
  mediaIds: string[];
};

const parseGroup = <K extends SiteSettingsGroup>(group: K, raw: unknown): SiteSettings[K] =>
  settingsSchemas[group].parse(raw ?? {}) as SiteSettings[K];

export const resolveSettings = (
  raw: Record<string, unknown>,
  ctx: SettingsContext,
): ResolvedSettings => {
  const problems: Problem[] = [];
  const contacts = parseGroup(SiteSettingsGroup.Contacts, raw[SiteSettingsGroup.Contacts]);
  const navigation = parseGroup(SiteSettingsGroup.Navigation, raw[SiteSettingsGroup.Navigation]);
  const announcement = parseGroup(
    SiteSettingsGroup.Announcement,
    raw[SiteSettingsGroup.Announcement],
  );
  const seo = parseGroup(SiteSettingsGroup.SeoDefaults, raw[SiteSettingsGroup.SeoDefaults]);
  const social = parseGroup(SiteSettingsGroup.Social, raw[SiteSettingsGroup.Social]);
  const linkCtx = { selfId: "", pages: ctx.pages, contacts, pageTitle: "" };

  const resolve = (link: SiteLink | null) => {
    if (link === null) return null;
    const outcome = resolveLink(link, linkCtx);
    if (outcome.problem !== null && outcome.problem !== LinkProblem.MissingContact) {
      problems.push({
        severity: ProblemSeverity.Error,
        code: `link_${outcome.problem}`,
        message: "Um link do menu aponta para uma página que não está no ar.",
      });
    }
    return outcome.link;
  };

  const header = navigation.header.map((item) => ({
    label: item.label,
    link: resolve(item.link),
    children: item.children.map((child) => ({ label: child.label, link: resolve(child.link) })),
  }));
  const footer = navigation.footer.map((item) => ({ label: item.label, link: resolve(item.link) }));
  if (header.length === 0) {
    problems.push({
      severity: ProblemSeverity.Warning,
      code: "menu_empty",
      message: "O menu do cabeçalho está vazio.",
    });
  }

  const mediaIds = seo.ogImage ? [seo.ogImage] : [];
  for (const id of mediaIds) {
    if (ctx.media[id]?.published !== true) {
      problems.push({
        severity: ProblemSeverity.Error,
        code: "image_not_published",
        message: "A imagem de compartilhamento ainda não foi publicada para o site.",
      });
    }
  }
  const media: PublishedMedia = {};
  for (const id of mediaIds) {
    const info = ctx.media[id];
    if (info?.published && info.checksum !== null && ctx.mediaBaseUrl !== null) {
      media[id] = {
        ...publicUrls(info.checksum, ctx.mediaBaseUrl),
        width: info.width,
        height: info.height,
      };
    }
  }

  return {
    published: {
      contacts,
      social,
      seo_defaults: seo,
      navigation: { header, footer },
      announcement: {
        enabled: announcement.enabled,
        text: announcement.text,
        link: resolve(announcement.link),
      },
      media,
    },
    problems,
    mediaIds,
  };
};

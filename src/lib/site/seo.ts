import { pagePath } from "@/lib/shared/content/links";
import type { PublishedPage, PublishedSettings } from "@/lib/shared/content/published";
import { SitePageKind } from "@/lib/shared/enums";

export type HeadMeta =
  { title: string } | { name: string; content: string } | { property: string; content: string };

export type SiteHead = {
  meta: HeadMeta[];
  links: { rel: string; href: string }[];
  jsonLd: string | null;
};

export const buildHead = (
  page: PublishedPage,
  settings: PublishedSettings | null,
  origin: string,
): SiteHead => {
  const defaults = settings?.seo_defaults;
  const title = page.page.seo.title || page.page.title || defaults?.title || "";
  const description = page.page.seo.description || defaults?.description || "";
  const url = `${origin.replace(/\/+$/, "")}${pagePath(page.page.slug)}`;
  const ogId = page.page.seo.ogImage ?? defaults?.ogImage ?? null;
  const og = ogId === null ? undefined : (page.media[ogId] ?? settings?.media[ogId]);

  const meta: HeadMeta[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: og ? "summary_large_image" : "summary" },
  ];
  if (og) meta.push({ property: "og:image", content: og.large });
  if (page.page.seo.noindex === true) meta.push({ name: "robots", content: "noindex" });

  const contacts = settings?.contacts;
  const sameAs = Object.values(settings?.social ?? {}).filter((item) =>
    item.startsWith("https://"),
  );
  const jsonLd =
    page.page.kind === SitePageKind.Home
      ? JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: defaults?.title || title,
          url: origin.replace(/\/+$/, ""),
          ...(contacts?.email ? { email: contacts.email } : {}),
          ...(contacts?.phone ? { telephone: contacts.phone } : {}),
          ...(sameAs.length > 0 ? { sameAs } : {}),
        })
      : null;
  return { meta, links: [{ rel: "canonical", href: url }], jsonLd };
};

export const robotsText = (published: boolean, origin: string): string =>
  published
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /portal\nDisallow: /api\nSitemap: ${origin.replace(/\/+$/, "")}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";

const xmlEscape = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const sitemapXml = (
  pages: { slug: string; updated_at: string }[],
  origin: string,
): string => {
  const base = origin.replace(/\/+$/, "");
  const urls = pages
    .map(
      (page) =>
        `  <url><loc>${xmlEscape(base + pagePath(page.slug))}</loc><lastmod>${xmlEscape(page.updated_at.slice(0, 10))}</lastmod></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

import { createFileRoute } from "@tanstack/react-router";
import { siteOrigin } from "@/lib/shared/site-url.server";
import { readSitemap } from "@/lib/site/public-reader.server";
import { sitemapXml } from "@/lib/site/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const sitemap = await readSitemap();
        const pages = sitemap?.published === true ? sitemap.pages : [];
        return new Response(sitemapXml(pages, siteOrigin()), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        });
      },
    },
  },
});

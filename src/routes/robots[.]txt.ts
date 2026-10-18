import { createFileRoute } from "@tanstack/react-router";
import { siteOrigin } from "@/lib/shared/site-url.server";
import { readSitemap } from "@/lib/site/public-reader.server";
import { robotsText } from "@/lib/site/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const sitemap = await readSitemap();
        const body = robotsText(sitemap?.published === true, siteOrigin());
        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        });
      },
    },
  },
});

import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicSitePage } from "@/components/site/public-page";
import { PublicSiteState } from "@/lib/shared/enums";
import { getPublicSite } from "@/lib/site/public.functions";
import { buildHead } from "@/lib/site/seo";

export const Route = createFileRoute("/(site)/")({
  loader: async () => {
    const result = await getPublicSite({ data: { slug: "" } });
    if (result.state === PublicSiteState.Redirect) {
      throw redirect({ href: result.to, statusCode: result.permanent ? 301 : 302 });
    }
    return result;
  },
  head: ({ loaderData }) => {
    if (loaderData?.state !== PublicSiteState.Ok) {
      return { meta: [{ title: "Site" }, { name: "robots", content: "noindex" }] };
    }
    const head = buildHead(loaderData.page, loaderData.settings, loaderData.origin);
    return {
      meta: head.meta,
      links: head.links,
      ...(head.jsonLd ? { scripts: [{ type: "application/ld+json", children: head.jsonLd }] } : {}),
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const result = Route.useLoaderData();
  return <PublicSitePage result={result} slug="" />;
}

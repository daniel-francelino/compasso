import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicSitePage } from "@/components/site/public-page";
import { PublicSiteState } from "@/lib/shared/enums";
import { getPublicSite } from "@/lib/site/public.functions";
import { buildHead } from "@/lib/site/seo";

export const Route = createFileRoute("/(site)/$")({
  loader: async ({ params }) => {
    const result = await getPublicSite({ data: { slug: params._splat ?? "" } });
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
    return { meta: head.meta, links: head.links };
  },
  component: SplatRoute,
});

function SplatRoute() {
  const result = Route.useLoaderData();
  const { _splat } = Route.useParams();
  return <PublicSitePage result={result} slug={_splat ?? ""} />;
}

import { createFileRoute } from "@tanstack/react-router";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { LandingPage } from "@/components/site/landing/landing-page";
import { getContactConfig, submitContactMessage } from "@/lib/site/public.functions";

const title = "Rayana Vasconcelos · Social media e gestão de redes sociais";
const description =
  "Estratégia, criação, publicação e relatórios para as redes sociais da sua marca. Fale com a Rayana Vasconcelos.";

export const Route = createFileRoute("/(site)/")({
  loader: () => getContactConfig(),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { turnstileSiteKey } = Route.useLoaderData();
  const ctx: SiteRenderContext = {
    media: {},
    caseStudies: [],
    siteId: null,
    pageSlug: "",
    turnstileSiteKey,
    preview: false,
    submitContact: async (payload) => {
      const outcome = await submitContactMessage({ data: { ...payload, slug: "" } });
      return outcome.ok ? { ok: true } : { ok: false, message: outcome.message };
    },
  };
  return <LandingPage ctx={ctx} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/site/landing/landing-page";

const title = "Rayana Vasconcelos · Marketing, social media e comunicação";
const description =
  "Estratégia e criatividade para marcas com personalidade: gestão de redes sociais, criação de conteúdo e consultoria de comunicação com Rayana Vasconcelos.";

export const Route = createFileRoute("/(site)/")({
  headers: () => ({ "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

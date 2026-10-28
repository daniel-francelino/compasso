import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { LandingAbout } from "@/components/site/landing/landing-about";
import { LandingContact } from "@/components/site/landing/landing-contact";
import { LandingFooter } from "@/components/site/landing/landing-footer";
import { LandingHeader } from "@/components/site/landing/landing-header";
import { LandingHero } from "@/components/site/landing/landing-hero";
import { LandingPlatforms } from "@/components/site/landing/landing-platforms";
import { LandingProcess } from "@/components/site/landing/landing-process";
import { LandingServices } from "@/components/site/landing/landing-services";
import { LandingWorkspace } from "@/components/site/landing/landing-workspace";

export function LandingPage({ ctx }: { ctx: SiteRenderContext }) {
  return (
    <div className="min-h-screen bg-ivory text-ink">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <LandingHeader />
      <main id="conteudo">
        <LandingHero />
        <LandingPlatforms />
        <LandingServices />
        <LandingWorkspace />
        <LandingProcess />
        <LandingAbout />
        <LandingContact ctx={ctx} />
      </main>
      <LandingFooter />
    </div>
  );
}

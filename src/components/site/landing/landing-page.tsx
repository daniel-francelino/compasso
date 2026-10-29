import { CatchBoundary } from "@tanstack/react-router";
import { MotionConfig } from "motion/react";
import { Suspense, lazy } from "react";
import { LandingAudience } from "@/components/site/landing/landing-audience";
import { LandingFooter } from "@/components/site/landing/landing-footer";
import { LandingFaq } from "@/components/site/landing/landing-faq";
import { LandingHeader } from "@/components/site/landing/landing-header";
import { LandingHero } from "@/components/site/landing/landing-hero";
import { LandingMethod } from "@/components/site/landing/landing-method";
import { LandingPlatforms } from "@/components/site/landing/landing-platforms";
import { LandingProcess } from "@/components/site/landing/landing-process";
import { LandingServices } from "@/components/site/landing/landing-services";

const LandingAbout = lazy(() =>
  import("@/components/site/landing/landing-about").then((m) => ({ default: m.LandingAbout })),
);
const LandingContact = lazy(() =>
  import("@/components/site/landing/landing-contact").then((m) => ({ default: m.LandingContact })),
);

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
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
          <LandingAudience />
          <LandingServices />
          <LandingProcess />
          <LandingMethod />
          <CatchBoundary getResetKey={() => "landing-lazy"} errorComponent={() => null}>
            <Suspense fallback={null}>
              <LandingAbout />
              <LandingFaq />
              <LandingContact />
            </Suspense>
          </CatchBoundary>
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}

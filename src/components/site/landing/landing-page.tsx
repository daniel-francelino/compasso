import { MotionConfig } from "motion/react";
import { Suspense, lazy } from "react";
import { LandingFooter } from "@/components/site/landing/landing-footer";
import { LandingHeader } from "@/components/site/landing/landing-header";
import { LandingHero } from "@/components/site/landing/landing-hero";
import { LandingPlatforms } from "@/components/site/landing/landing-platforms";
import { LandingProcess } from "@/components/site/landing/landing-process";
import { LandingServices } from "@/components/site/landing/landing-services";

const LandingWorkspace = lazy(() =>
  import("@/components/site/landing/landing-workspace").then((m) => ({
    default: m.LandingWorkspace,
  })),
);
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
          <LandingServices />
          <LandingProcess />
          <Suspense fallback={null}>
            <LandingWorkspace />
            <LandingAbout />
            <LandingContact />
          </Suspense>
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}

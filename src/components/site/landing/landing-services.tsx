import { BlurFade } from "lost-ui/effects/blur-fade";
import { MagicCard } from "lost-ui/effects/magic-card";
import { Camera, Clapperboard, MessagesSquare, Share2, type LucideIcon } from "lucide-react";
import { LandingCtaLink } from "@/components/site/landing/landing-cta-link";
import { LandingAnchor, services } from "@/components/site/landing/landing-content";
import { Ribbon, Sparkle } from "@/components/site/landing/landing-ornaments";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

const serviceIcons: Record<(typeof services)[number]["key"], LucideIcon> = {
  social: Share2,
  content: Clapperboard,
  capture: Camera,
  consulting: MessagesSquare,
};

export function LandingServices() {
  return (
    <section
      id={LandingAnchor.Services}
      className="relative scroll-mt-20 overflow-clip bg-[image:var(--image-landing)] bg-cover bg-center px-6 py-24"
    >
      <Ribbon className="-right-16 -top-12 w-48 rotate-6 opacity-80 max-sm:hidden" />
      <Sparkle className="right-[8%] top-12 size-10" />
      <Sparkle className="bottom-10 left-[6%] size-12 [animation-delay:800ms]" />
      <div className="relative mx-auto max-w-5xl">
        <LandingSectionTitle
          eyebrow="Serviços"
          title="Como posso ajudar sua marca?"
          text="Do planejamento à captação, cada serviço pode ser contratado de forma pontual ou mensal."
        />
        <ul className="mt-14 grid gap-5 sm:grid-cols-2">
          {services.map((service, index) => {
            const Icon = serviceIcons[service.key];
            return (
              <li key={service.key}>
                <BlurFade inView delay={index * 0.08} className="h-full">
                  <MagicCard
                    gradientColor="var(--orchid-light)"
                    gradientFrom="var(--violet-bright)"
                    gradientTo="var(--coral)"
                    className="card-offset h-full"
                  >
                    <div className="space-y-3 p-6">
                      <span className="flex size-11 items-center justify-center rounded-md bg-orchid-light text-violet-deep">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <h3 className="font-display text-2xl font-semibold text-ink">
                        {service.title}
                      </h3>
                      <p className="text-ink-soft">{service.text}</p>
                    </div>
                  </MagicCard>
                </BlurFade>
              </li>
            );
          })}
        </ul>
        <div className="mt-12 flex justify-center">
          <LandingCtaLink />
        </div>
      </div>
    </section>
  );
}

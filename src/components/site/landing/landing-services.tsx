import { BlurFade } from "lost-ui/effects/blur-fade";
import { MagicCard } from "lost-ui/effects/magic-card";
import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  MessagesSquare,
  Send,
  Target,
  type LucideIcon,
} from "lucide-react";
import { LandingAnchor, services } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

const serviceIcons: Record<(typeof services)[number]["key"], LucideIcon> = {
  strategy: Target,
  calendar: CalendarDays,
  creation: Clapperboard,
  community: MessagesSquare,
  publishing: Send,
  reports: BarChart3,
};

export function LandingServices() {
  return (
    <section id={LandingAnchor.Services} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <LandingSectionTitle
        eyebrow="Serviços"
        title="Tudo o que suas redes precisam, em um só fluxo"
        text="Do planejamento ao relatório, cada etapa tem dono e prazo."
      />
      <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => {
          const Icon = serviceIcons[service.key];
          return (
            <li key={service.key}>
              <BlurFade inView delay={index * 0.08} className="h-full">
                <MagicCard
                  gradientColor="var(--orchid-light)"
                  gradientFrom="var(--violet-bright)"
                  gradientTo="var(--coral)"
                  className="h-full rounded-2xl"
                >
                  <div className="space-y-3 p-6">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-orchid-light text-violet-deep">
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
    </section>
  );
}

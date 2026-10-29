import { ChartLine, Clock, Megaphone, type LucideIcon } from "lucide-react";
import { audience, LandingAnchor } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

const painIcons: Record<(typeof audience.pains)[number]["key"], LucideIcon> = {
  results: ChartLine,
  time: Clock,
  voice: Megaphone,
};

export function LandingAudience() {
  return (
    <section id={LandingAnchor.Audience} className="scroll-mt-20 bg-ivory px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <LandingSectionTitle
          eyebrow={audience.eyebrow}
          title={audience.title}
          text={audience.text}
        />
        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {audience.pains.map((pain) => {
            const Icon = painIcons[pain.key];
            return (
              <li key={pain.key}>
                <div className="h-full space-y-3 rounded-lg border border-line bg-surface p-6 transition-transform duration-200 motion-safe:hover:scale-105">
                  <span className="flex size-11 items-center justify-center rounded-md bg-orchid-light text-violet-deep">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="font-display text-2xl font-semibold text-ink">{pain.title}</h3>
                  <p className="text-ink-soft">{pain.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center font-display text-2xl text-violet-deep">
          {audience.solution}
        </p>
      </div>
    </section>
  );
}

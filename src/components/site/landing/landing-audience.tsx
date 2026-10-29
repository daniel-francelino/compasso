import { BlurFade } from "lost-ui/effects/blur-fade";
import { audience, LandingAnchor } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

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
          {audience.pains.map((pain, index) => (
            <li key={pain.title}>
              <BlurFade inView delay={index * 0.08} className="h-full">
                <div className="h-full space-y-2 rounded-2xl border border-line bg-surface p-6">
                  <h3 className="font-display text-2xl font-semibold text-ink">{pain.title}</h3>
                  <p className="text-ink-soft">{pain.text}</p>
                </div>
              </BlurFade>
            </li>
          ))}
        </ul>
        <BlurFade inView delay={0.2}>
          <p className="mx-auto mt-10 max-w-2xl text-center font-display text-2xl text-violet-deep">
            {audience.solution}
          </p>
        </BlurFade>
      </div>
    </section>
  );
}

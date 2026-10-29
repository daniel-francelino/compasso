import { BlurFade } from "lost-ui/effects/blur-fade";
import { LandingAnchor, processSteps } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

export function LandingProcess() {
  return (
    <section id={LandingAnchor.Process} className="scroll-mt-20 bg-orchid-light px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <LandingSectionTitle
          eyebrow="Processo"
          title="Como funciona o trabalho?"
          text="Um processo claro, colaborativo e ajustado à realidade do cliente."
        />
        <ol className="mt-14 space-y-3">
          {processSteps.map((step, index) => (
            <li key={step.number}>
              <BlurFade inView delay={index * 0.08}>
                <div className="grid items-center gap-x-6 gap-y-1 rounded-2xl border border-line bg-surface px-5 py-4 sm:grid-cols-[3rem_14rem_1fr]">
                  <span className="font-display text-2xl font-bold text-violet-deep">
                    {step.number}
                  </span>
                  <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="text-ink-soft">{step.text}</p>
                </div>
              </BlurFade>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

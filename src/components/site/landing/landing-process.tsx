import { BlurFade } from "lost-ui/effects/blur-fade";
import {
  CalendarDays,
  ChartLine,
  MessageCircle,
  PenTool,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { LandingCtaLink } from "@/components/site/landing/landing-cta-link";
import { LandingAnchor, processSteps } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

const stepIcons: Record<string, LucideIcon> = {
  "01": MessageCircle,
  "02": FileText,
  "03": CalendarDays,
  "04": PenTool,
  "05": ChartLine,
};

function StepIcon({ number }: { number: string }) {
  const Icon = stepIcons[number] ?? MessageCircle;
  return <Icon aria-hidden="true" className="size-5" />;
}

export function LandingProcess() {
  return (
    <section id={LandingAnchor.Process} className="scroll-mt-20 bg-orchid-light px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <LandingSectionTitle
          eyebrow="Processo"
          title="Como funciona o trabalho?"
          text="Um processo claro, feito em parceria e ajustado à realidade do seu negócio."
        />
        <ol className="mt-14 space-y-3">
          {processSteps.map((step, index) => (
            <li key={step.number}>
              <BlurFade inView delay={index * 0.08}>
                <div className="grid items-center gap-x-6 gap-y-1 rounded-lg border border-line bg-surface px-5 py-4 sm:grid-cols-[2.75rem_3rem_14rem_1fr]">
                  <span className="flex size-11 items-center justify-center rounded-md bg-orchid-light text-violet-deep">
                    <StepIcon number={step.number} />
                  </span>
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
        <div className="mt-12 flex justify-center">
          <LandingCtaLink />
        </div>
      </div>
    </section>
  );
}

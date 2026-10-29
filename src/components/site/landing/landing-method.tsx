import { BlurFade } from "lost-ui/effects/blur-fade";
import { CalendarDays, Check, PenTool, Send, SquareCheckBig, type LucideIcon } from "lucide-react";
import { LandingAnchor, method } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

const stepIcons: Record<(typeof method.steps)[number]["key"], LucideIcon> = {
  plan: CalendarDays,
  produce: PenTool,
  approve: SquareCheckBig,
  publish: Send,
};

export function LandingMethod() {
  return (
    <section id={LandingAnchor.Method} className="scroll-mt-20 bg-cream px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <LandingSectionTitle eyebrow="Método" title={method.title} text={method.text} />
        <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {method.steps.map((step, index) => {
            const Icon = stepIcons[step.key];
            return (
              <li key={step.key}>
                <BlurFade inView delay={index * 0.08} className="h-full">
                  <div className="flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex size-11 items-center justify-center rounded-md bg-orchid-light text-violet-deep">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="font-display text-3xl font-bold text-violet-deep">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display text-2xl font-semibold text-ink">{step.label}</h3>
                      <p className="text-ink-soft">{step.text}</p>
                    </div>
                    <ul className="mt-auto space-y-2 border-t border-line pt-4 text-sm text-ink">
                      {step.todos.map((todo) => (
                        <li key={todo} className="flex items-start gap-2">
                          <Check
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-violet"
                          />
                          {todo}
                        </li>
                      ))}
                    </ul>
                  </div>
                </BlurFade>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

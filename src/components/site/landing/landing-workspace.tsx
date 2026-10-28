import { BlurFade } from "lost-ui/effects/blur-fade";
import { BorderBeam } from "lost-ui/effects/border-beam";
import { Kbd } from "lost-ui/elements/kbd";
import { PageTransition } from "lost-ui/elements/page-transition";
import { CheckSquare, FileText } from "lucide-react";
import { useState } from "react";
import {
  LandingAnchor,
  slashCommands,
  workspaceSteps,
} from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";
import { cn } from "@/lib/shared/utils";

export function LandingWorkspace() {
  const [activeKey, setActiveKey] = useState<string>(workspaceSteps[0].key);
  const active = workspaceSteps.find((step) => step.key === activeKey) ?? workspaceSteps[0];
  return (
    <section id={LandingAnchor.Workspace} className="scroll-mt-20 bg-cream px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <LandingSectionTitle
          eyebrow="Método"
          title="Um espaço de trabalho claro, do plano ao post"
          text="Tudo organizado em páginas simples. Você acompanha cada etapa sem precisar pedir."
        />
        <BlurFade inView delay={0.1} className="mt-14">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
            <BorderBeam
              size={220}
              duration={9}
              colorFrom="var(--violet-bright)"
              colorTo="var(--coral)"
            />
            <div className="grid md:grid-cols-[14rem_1fr]">
              <div
                role="tablist"
                aria-label="Etapas do método"
                className="flex gap-1 overflow-x-auto border-b border-line bg-ivory p-3 md:flex-col md:border-b-0 md:border-r"
              >
                {workspaceSteps.map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    role="tab"
                    aria-selected={step.key === activeKey}
                    onClick={() => setActiveKey(step.key)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-medium whitespace-nowrap transition-colors",
                      step.key === activeKey
                        ? "bg-orchid-light text-violet-deep"
                        : "text-ink-soft hover:bg-cream",
                    )}
                  >
                    <FileText aria-hidden="true" className="size-4" />
                    {step.label}
                  </button>
                ))}
              </div>
              <PageTransition
                transitionKey={active.key}
                variant="fade"
                className="min-h-96 p-6 sm:p-10"
              >
                <div role="tabpanel" className="space-y-6">
                  <h3 className="font-display text-4xl font-bold text-ink">{active.page}</h3>
                  <dl className="space-y-2 text-sm">
                    {active.rows.map((row) => (
                      <div key={row.name} className="grid grid-cols-[7rem_1fr] items-center gap-3">
                        <dt className="text-ink-soft">{row.name}</dt>
                        <dd>
                          <span className="rounded-md bg-orchid-light px-2 py-1 font-medium text-violet-deep">
                            {row.value}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <ul className="space-y-2 border-t border-line pt-5">
                    {active.todos.map((todo) => (
                      <li key={todo} className="flex items-center gap-3 text-ink">
                        <CheckSquare aria-hidden="true" className="size-5 text-violet" />
                        {todo}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <Kbd value="/" />
                    <span>para inserir:</span>
                    {slashCommands.map((command) => (
                      <span
                        key={command}
                        className="rounded-md border border-line px-2 py-0.5 text-ink"
                      >
                        {command}
                      </span>
                    ))}
                  </div>
                </div>
              </PageTransition>
            </div>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

import { BlurFade } from "lost-ui/effects/blur-fade";
import { AnimatedSpan, Terminal, TerminalTypingAnimation } from "lost-ui/effects/terminal";
import { LandingAnchor, terminalLines } from "@/components/site/landing/landing-content";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

export function LandingProcess() {
  const [command, ...steps] = terminalLines;
  return (
    <section id={LandingAnchor.Process} className="mx-auto max-w-4xl scroll-mt-20 px-6 py-24">
      <LandingSectionTitle
        eyebrow="Processo"
        title="Do briefing à agenda cheia, sem improviso"
        text="Um fluxo repetível, mês após mês, que você consegue acompanhar."
      />
      <BlurFade inView delay={0.1} className="mt-14">
        <Terminal startOnView className="max-w-none">
          <TerminalTypingAnimation>{`> ${command ?? ""}`}</TerminalTypingAnimation>
          {steps.map((line) => (
            <AnimatedSpan key={line} className="text-success">
              <span>{`✔ ${line}`}</span>
            </AnimatedSpan>
          ))}
        </Terminal>
      </BlurFade>
    </section>
  );
}

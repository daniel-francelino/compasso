import { AnimatedGradientText } from "lost-ui/effects/animated-gradient-text";
import { AnimatedList } from "lost-ui/effects/animated-list";
import { BlurFade } from "lost-ui/effects/blur-fade";
import { DotPattern } from "lost-ui/effects/dot-pattern";
import { ShimmerButton } from "lost-ui/effects/shimmer-button";
import { TextAnimate } from "lost-ui/effects/text-animate";
import { WordRotate } from "lost-ui/effects/word-rotate";
import { CalendarCheck, CircleCheck, Clock, FileBarChart, Sparkles } from "lucide-react";
import { heroFeed, heroWords } from "@/components/site/landing/landing-content";
import { scrollToAnchor } from "@/components/site/landing/scroll-to-anchor";
import { cn } from "@/lib/shared/utils";

const feedIcons = {
  approved: CircleCheck,
  planned: CalendarCheck,
  review: Clock,
  done: FileBarChart,
} as const;

const feedTones = {
  approved: "bg-sage text-cactus",
  planned: "bg-orchid-light text-violet-deep",
  review: "bg-peach text-warning",
  done: "bg-rose text-ink",
} as const;

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[image:var(--gradient-hero)]">
      <DotPattern
        glow
        className="-z-10 fill-violet/20 [mask-image:radial-gradient(520px_circle_at_center,var(--ink),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="space-y-7">
          <BlurFade delay={0.05}>
            <AnimatedGradientText
              colorFrom="var(--violet)"
              colorTo="var(--coral-dark)"
              className="inline-flex items-center rounded-full border border-line bg-surface/70 px-4 py-1.5 text-sm font-medium"
            >
              <Sparkles aria-hidden="true" className="mr-2 size-4 text-violet" />
              Social media · Gestão de redes sociais
            </AnimatedGradientText>
          </BlurFade>
          <div
            role="heading"
            aria-level={1}
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl"
          >
            <span className="sr-only">Sua marca aparece nas redes sociais.</span>
            <span aria-hidden="true" className="block">
              <TextAnimate animation="blurInUp" by="word" as="span" className="block">
                Sua marca
              </TextAnimate>
              <WordRotate words={heroWords} className="block text-violet-deep" duration={2400} />
              <TextAnimate animation="blurInUp" by="word" as="span" delay={0.3} className="block">
                nas redes sociais.
              </TextAnimate>
            </span>
          </div>
          <BlurFade delay={0.4}>
            <p className="max-w-xl text-lg text-ink-soft">
              Eu cuido do planejamento, da criação, da publicação e dos resultados do seu conteúdo,
              para você ter presença constante sem perder tempo com as redes.
            </p>
          </BlurFade>
          <BlurFade delay={0.55} className="flex flex-wrap items-center gap-4">
            <ShimmerButton
              type="button"
              background="var(--violet)"
              shimmerColor="var(--orchid)"
              className="text-base font-medium"
              onClick={() => scrollToAnchor("contato")}
            >
              Quero conversar
            </ShimmerButton>
            <a
              href="#servicos"
              className="rounded-full px-4 py-3 text-base font-medium text-ink underline-offset-4 hover:underline"
            >
              Ver o que eu faço
            </a>
          </BlurFade>
        </div>
        <BlurFade delay={0.35} direction="left" offset={24}>
          <div
            role="img"
            aria-label="Exemplo ilustrativo de avisos de um fluxo de redes sociais: pauta aprovada, reels agendado, carrossel em revisão e relatório pronto"
            className="rounded-3xl border border-line bg-surface/85 p-5 shadow-sm backdrop-blur"
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-soft">
              Fluxo da semana · exemplo
            </p>
            <AnimatedList delay={1600} className="gap-3">
              {heroFeed.map((item) => {
                const Icon = feedIcons[item.tone];
                return (
                  <div
                    key={item.title}
                    className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        feedTones[item.tone],
                      )}
                    >
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-ink-soft">{item.detail}</span>
                    </span>
                  </div>
                );
              })}
            </AnimatedList>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}

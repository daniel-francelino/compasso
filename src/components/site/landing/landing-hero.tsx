import { AnimatedGradientText } from "lost-ui/effects/animated-gradient-text";
import { AnimatedList } from "lost-ui/effects/animated-list";
import { BlurFade } from "lost-ui/effects/blur-fade";
import { ShimmerButton } from "lost-ui/effects/shimmer-button";
import { TextAnimate } from "lost-ui/effects/text-animate";
import { WordRotate } from "lost-ui/effects/word-rotate";
import { CalendarCheck, CircleCheck, Clock, FileBarChart, Sparkles } from "lucide-react";
import { hero, heroFeed, heroWords } from "@/components/site/landing/landing-content";
import { LandingHeroPhoto } from "@/components/site/landing/landing-hero-photo";
import { Blob, Sparkle } from "@/components/site/landing/landing-ornaments";
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
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_oklab,var(--violet)_22%,transparent)_1px,transparent_1px)] bg-size-[18px_18px] mask-[radial-gradient(560px_circle_at_center,var(--ink),transparent)]"
      />
      <Blob className="-right-28 -top-28 -z-10 w-80 opacity-90" />
      <Blob className="-bottom-32 -left-28 -z-10 w-72 rotate-90 opacity-90" />
      <Sparkle className="left-[6%] top-[22%] -z-10 size-10" />
      <Sparkle className="right-[48%] top-[10%] -z-10 size-8 [animation-delay:600ms]" />
      <Sparkle className="bottom-[12%] left-[30%] -z-10 size-12 [animation-delay:1200ms]" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div className="space-y-7">
          <BlurFade delay={0.05}>
            <AnimatedGradientText
              colorFrom="var(--violet)"
              colorTo="var(--coral-dark)"
              className="inline-flex items-center rounded-full bg-orchid-light px-4 py-1.5 text-sm font-medium"
            >
              <Sparkles aria-hidden="true" className="mr-2 size-4 text-violet" />
              {hero.eyebrow}
            </AnimatedGradientText>
          </BlurFade>
          <div
            role="heading"
            aria-level={1}
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl"
          >
            <span className="sr-only">{hero.titleAccessible}</span>
            <span aria-hidden="true" className="block">
              <TextAnimate animation="blurInUp" by="word" as="span" className="block">
                {hero.titleStart}
              </TextAnimate>
              <WordRotate words={heroWords} className="block text-violet-deep" duration={2600} />
            </span>
          </div>
          <BlurFade delay={0.4}>
            <p className="max-w-xl text-lg text-ink-soft">{hero.text}</p>
          </BlurFade>
          <BlurFade delay={0.55} className="flex flex-wrap items-center gap-4">
            <ShimmerButton
              type="button"
              background="var(--violet)"
              shimmerColor="var(--orchid)"
              className="text-base font-medium"
              onClick={() => scrollToAnchor("contato")}
            >
              Vamos conversar
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
          <LandingHeroPhoto>
            <div
              role="img"
              aria-label="Exemplo ilustrativo de avisos de um fluxo de redes sociais: pauta aprovada, reels agendado, carrossel em revisão e relatório pronto"
              className="w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-sm"
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
          </LandingHeroPhoto>
        </BlurFade>
      </div>
    </section>
  );
}

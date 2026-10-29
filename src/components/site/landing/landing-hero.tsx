import { AnimatedGradientText } from "lost-ui/effects/animated-gradient-text";
import { BlurFade } from "lost-ui/effects/blur-fade";
import { ShimmerButton } from "lost-ui/effects/shimmer-button";
import { TextAnimate } from "lost-ui/effects/text-animate";
import { WordRotate } from "lost-ui/effects/word-rotate";
import { ArrowDown, Check, Sparkles } from "lucide-react";
import { hero, heroWords } from "@/components/site/landing/landing-content";
import { LandingHeroPhoto } from "@/components/site/landing/landing-hero-photo";
import { Ribbon, Sparkle } from "@/components/site/landing/landing-ornaments";
import { scrollToAnchor } from "@/components/site/landing/scroll-to-anchor";

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[image:var(--image-landing)] bg-cover bg-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(color-mix(in_oklab,var(--violet)_22%,transparent)_1px,transparent_1px)] bg-size-[18px_18px] mask-[radial-gradient(560px_circle_at_center,var(--ink),transparent)]"
      />
      <Ribbon eager className="-right-16 -top-20 -z-10 w-72 rotate-12 opacity-90" />
      <Ribbon className="-bottom-24 -left-20 -z-10 w-60 -rotate-[100deg] opacity-80" />
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
              {hero.cta}
            </ShimmerButton>
            <a
              href="#servicos"
              className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-base font-medium text-ink underline-offset-4 hover:underline"
            >
              Ver o que eu faço
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </BlurFade>
          <BlurFade delay={0.7}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
              {hero.proof.map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Check aria-hidden="true" className="size-4 text-violet-deep" />
                  {item}
                </li>
              ))}
            </ul>
          </BlurFade>
        </div>
        <BlurFade delay={0.35} direction="left" offset={24}>
          <LandingHeroPhoto />
        </BlurFade>
      </div>
    </section>
  );
}

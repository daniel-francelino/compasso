import { Marquee } from "lost-ui/effects/marquee";
import { LandingBrandIcon } from "@/components/site/landing/landing-brand-icon";
import { platforms } from "@/components/site/landing/landing-content";

export function LandingPlatforms() {
  return (
    <section
      aria-label="Plataformas em que atuo"
      className="contain-paint border-y border-line bg-surface py-6"
    >
      <Marquee repeat={3} pauseOnHover className="[--duration:32s] [--gap:3rem]">
        {platforms.map((platform) => (
          <span
            key={platform.key}
            role="img"
            aria-label={platform.name}
            className="flex size-12 items-center justify-center text-violet-deep"
          >
            <LandingBrandIcon platform={platform.key} className="size-8" />
          </span>
        ))}
      </Marquee>
    </section>
  );
}

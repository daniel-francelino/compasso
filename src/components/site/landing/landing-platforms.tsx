import { Marquee } from "lost-ui/effects/marquee";
import { platforms } from "@/components/site/landing/landing-content";

export function LandingPlatforms() {
  return (
    <section aria-label="Plataformas em que atuo" className="border-y border-line bg-surface py-6">
      <Marquee pauseOnHover className="[--duration:32s] [--gap:2.5rem]">
        {platforms.map((name) => (
          <span key={name} className="font-display text-2xl font-semibold text-ink-soft">
            {name}
          </span>
        ))}
      </Marquee>
    </section>
  );
}

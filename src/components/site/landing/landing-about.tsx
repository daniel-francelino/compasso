import { BlurFade } from "lost-ui/effects/blur-fade";
import { HyperText } from "lost-ui/effects/hyper-text";
import { Meteors } from "lost-ui/effects/meteors";
import { TextReveal } from "lost-ui/effects/text-reveal";
import { about, LandingAnchor } from "@/components/site/landing/landing-content";
import { MountOnView } from "@/components/site/landing/mount-on-view";

export function LandingAbout() {
  return (
    <section
      id={LandingAnchor.About}
      className="relative scroll-mt-20 overflow-clip bg-ink text-ivory [--foreground:var(--ivory)]"
    >
      <MountOnView>
        <Meteors number={8} className="bg-orchid" />
      </MountOnView>
      <div className="relative mx-auto max-w-4xl px-6 pt-24 text-center">
        <HyperText
          as="p"
          startOnView
          className="text-sm font-semibold uppercase tracking-wide text-orchid"
        >
          SOBRE MIM
        </HyperText>
        <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{about.title}</h2>
      </div>
      <TextReveal className="text-ivory">{about.text}</TextReveal>
      <ul className="relative mx-auto grid max-w-5xl gap-5 px-6 pb-24 md:grid-cols-3">
        {about.principles.map((item, index) => (
          <li key={item.title}>
            <BlurFade inView delay={index * 0.1} className="h-full">
              <div className="h-full rounded-2xl border border-ivory/20 p-6">
                <h3 className="font-display text-2xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-orchid-light">{item.text}</p>
              </div>
            </BlurFade>
          </li>
        ))}
      </ul>
    </section>
  );
}

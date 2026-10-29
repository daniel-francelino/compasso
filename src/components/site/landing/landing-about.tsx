import { Compass, GraduationCap, Heart } from "lucide-react";
import { BlurFade } from "lost-ui/effects/blur-fade";
import { HyperText } from "lost-ui/effects/hyper-text";
import { Meteors } from "lost-ui/effects/meteors";
import { about, aboutPhoto, LandingAnchor } from "@/components/site/landing/landing-content";
import { MountOnView } from "@/components/site/landing/mount-on-view";

const principleIcons = [Compass, Heart, GraduationCap];

function PrincipleIcon({ index }: { index: number }) {
  const Icon = principleIcons[index] ?? Compass;
  return (
    <span className="flex size-10 items-center justify-center rounded-md bg-ivory/10 text-orchid">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

export function LandingAbout() {
  return (
    <section
      id={LandingAnchor.About}
      className="relative scroll-mt-20 overflow-clip bg-ink text-ivory [--foreground:var(--ivory)]"
    >
      <MountOnView>
        <Meteors number={8} className="bg-orchid" />
      </MountOnView>
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pt-24 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        <div className="space-y-6">
          <HyperText
            as="p"
            startOnView
            className="text-sm font-semibold uppercase tracking-wide text-orchid"
          >
            SOBRE MIM
          </HyperText>
          <h2 className="font-display text-4xl font-bold sm:text-5xl">{about.title}</h2>
          <div className="max-w-xl space-y-4 text-lg text-orchid-light">
            {about.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg lg:max-w-none">
          <img
            src={aboutPhoto.src}
            alt={aboutPhoto.alt}
            width={960}
            height={1475}
            loading="lazy"
            decoding="async"
            className="block aspect-[4/5] w-full object-cover object-[center_30%]"
          />
        </div>
      </div>
      <ul className="relative mx-auto grid max-w-6xl gap-5 px-6 py-16 md:grid-cols-3">
        {about.principles.map((item, index) => (
          <li key={item.title}>
            <BlurFade inView delay={index * 0.1} className="h-full">
              <div className="h-full rounded-lg border border-ivory/20 p-6 transition-transform duration-200 motion-safe:hover:scale-105">
                <PrincipleIcon index={index} />
                <h3 className="mt-3 font-display text-2xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-orchid-light">{item.text}</p>
              </div>
            </BlurFade>
          </li>
        ))}
      </ul>
    </section>
  );
}

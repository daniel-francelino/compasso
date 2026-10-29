import { BlurFade } from "lost-ui/effects/blur-fade";
import { Instagram, Mail } from "lucide-react";
import { Ribbon, Sparkle } from "@/components/site/landing/landing-ornaments";
import { contact, LandingAnchor } from "@/components/site/landing/landing-content";

export function LandingContact() {
  return (
    <section
      id={LandingAnchor.Contact}
      className="relative scroll-mt-20 overflow-clip bg-[image:var(--image-landing)] bg-cover bg-center px-6 py-24"
    >
      <Ribbon className="-left-12 bottom-6 w-44 -rotate-12 opacity-80 max-sm:hidden" />
      <Sparkle className="left-[8%] top-16 size-10" />
      <Sparkle className="bottom-16 right-[8%] size-12 [animation-delay:700ms]" />
      <BlurFade inView>
        <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-line bg-surface p-8 text-center sm:p-12">
          <h2 className="font-display text-4xl font-bold text-ink sm:text-5xl">{contact.title}</h2>
          <p className="font-display text-2xl text-violet-deep">{contact.text}</p>
          <p className="text-ink-soft">{contact.detail}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={contact.instagram.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet px-5 py-2 font-medium text-ivory hover:bg-violet-deep"
            >
              <Instagram aria-hidden="true" className="size-4" />
              {contact.instagram.label}
            </a>
            <a
              href={contact.email.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-5 py-2 font-medium text-ink hover:bg-orchid-light"
            >
              <Mail aria-hidden="true" className="size-4" />
              {contact.email.label}
            </a>
          </div>
        </div>
      </BlurFade>
    </section>
  );
}

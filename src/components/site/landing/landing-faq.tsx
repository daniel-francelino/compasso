import { BlurFade } from "lost-ui/effects/blur-fade";
import { ChevronDown } from "lucide-react";
import { faq, LandingAnchor } from "@/components/site/landing/landing-content";
import { LandingCtaLink } from "@/components/site/landing/landing-cta-link";
import { LandingSectionTitle } from "@/components/site/landing/landing-section-title";

export function LandingFaq() {
  return (
    <section id={LandingAnchor.Faq} className="scroll-mt-20 bg-ivory px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <LandingSectionTitle eyebrow={faq.eyebrow} title={faq.title} />
        <ul className="mt-12 space-y-3">
          {faq.items.map((item, index) => (
            <li key={item.question}>
              <BlurFade inView delay={index * 0.06}>
                <details className="group rounded-lg border border-line bg-surface px-5 py-4">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-ink">
                    {item.question}
                    <ChevronDown
                      aria-hidden="true"
                      className="size-5 shrink-0 text-violet-deep transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="pt-2 text-ink-soft">{item.answer}</p>
                </details>
              </BlurFade>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <LandingCtaLink />
        </div>
      </div>
    </section>
  );
}

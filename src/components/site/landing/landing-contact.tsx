import { BlurFade } from "lost-ui/effects/blur-fade";
import { ContactFormSection } from "@/components/shared/site/sections/contact-form-section";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { contactCopy, LandingAnchor } from "@/components/site/landing/landing-content";

export function LandingContact({ ctx }: { ctx: SiteRenderContext }) {
  return (
    <section
      id={LandingAnchor.Contact}
      className="scroll-mt-20 bg-[image:var(--gradient-hero)] px-6 py-24"
    >
      <BlurFade inView>
        <div className="mx-auto max-w-xl rounded-3xl border border-line bg-surface py-10">
          <ContactFormSection content={contactCopy} ctx={ctx} />
        </div>
      </BlurFade>
    </section>
  );
}

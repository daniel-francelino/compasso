import { ArrowRight } from "lucide-react";
import { ctaLabel, LandingAnchor } from "@/components/site/landing/landing-content";

export function LandingCtaLink() {
  return (
    <a
      href={`#${LandingAnchor.Contact}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet px-6 py-3 text-base font-medium text-ivory hover:bg-violet-deep"
    >
      {ctaLabel}
      <ArrowRight aria-hidden="true" className="size-4" />
    </a>
  );
}

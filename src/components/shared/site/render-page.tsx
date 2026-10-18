import type { ComponentType, ReactNode } from "react";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { ContactFormSection } from "@/components/shared/site/sections/contact-form-section";
import { FaqSection } from "@/components/shared/site/sections/faq-section";
import { GallerySection } from "@/components/shared/site/sections/gallery-section";
import { HeroSection } from "@/components/shared/site/sections/hero-section";
import { ImageTextSection } from "@/components/shared/site/sections/image-text-section";
import { PortfolioSection } from "@/components/shared/site/sections/portfolio-section";
import { RichTextSection } from "@/components/shared/site/sections/rich-text-section";
import { ServicesSection } from "@/components/shared/site/sections/services-section";
import { TestimonialsSection } from "@/components/shared/site/sections/testimonials-section";
import type { PublishedPage, PublishedSection } from "@/lib/shared/content/published";
import { SectionAccent, SectionBackground, SectionKind, SectionSpacing } from "@/lib/shared/enums";

type SectionProps = { content: Record<string, unknown>; ctx: SiteRenderContext };

const renderers: Record<SectionKind, ComponentType<SectionProps>> = {
  [SectionKind.Hero]: HeroSection,
  [SectionKind.ServicesGrid]: ServicesSection,
  [SectionKind.PortfolioGrid]: PortfolioSection,
  [SectionKind.Testimonials]: TestimonialsSection,
  [SectionKind.RichText]: RichTextSection,
  [SectionKind.ImageText]: ImageTextSection,
  [SectionKind.Gallery]: GallerySection,
  [SectionKind.Faq]: FaqSection,
  [SectionKind.ContactForm]: ContactFormSection,
};

const backgrounds: Record<SectionBackground, string> = {
  [SectionBackground.Ivory]: "bg-ivory",
  [SectionBackground.Cream]: "bg-cream",
  [SectionBackground.Peach]: "bg-peach",
};

const spacings: Record<SectionSpacing, string> = {
  [SectionSpacing.Small]: "py-8",
  [SectionSpacing.Medium]: "py-14",
  [SectionSpacing.Large]: "py-24",
};

const accents: Record<SectionAccent, string> = {
  [SectionAccent.Violet]: "border-t-4 border-violet",
  [SectionAccent.Coral]: "border-t-4 border-coral",
  [SectionAccent.Orchid]: "border-t-4 border-orchid",
};

const isKind = (value: string): value is SectionKind =>
  (Object.values(SectionKind) as string[]).includes(value);

const lookup = <K extends string>(map: Record<K, string>, key: unknown): string =>
  typeof key === "string" && key in map ? map[key as K] : "";

function SectionFrame({ section, ctx }: { section: PublishedSection; ctx: SiteRenderContext }) {
  if (!isKind(section.component)) return null;
  const Renderer = renderers[section.component];
  const style = [
    lookup(backgrounds, section.appearance["background"]),
    lookup(spacings, section.appearance["spacing"]) || "py-14",
    lookup(accents, section.appearance["accent"]),
  ].join(" ");
  return (
    <section id={section.anchor} className={style}>
      <Renderer content={section.content} ctx={ctx} />
    </section>
  );
}

export function RenderPage({
  page,
  ctx,
}: {
  page: PublishedPage;
  ctx: SiteRenderContext;
}): ReactNode {
  return (
    <>
      {page.page.sections.map((section) => (
        <SectionFrame key={section.id} section={section} ctx={ctx} />
      ))}
    </>
  );
}

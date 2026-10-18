import { z } from "zod";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { SiteImage } from "@/components/shared/site/site-image";
import { SiteButton } from "@/components/shared/site/site-link";
import { resolvedCtaSchema } from "@/lib/shared/content/published";

const imageSchema = z.object({ mediaVersionId: z.string().nullable(), alt: z.string() }).nullable();

const schema = z.object({
  eyebrow: z.string().default(""),
  headline: z.string().default(""),
  subheadline: z.string().default(""),
  image: imageSchema.default(null),
  primaryCta: resolvedCtaSchema.default(null),
  secondaryCta: resolvedCtaSchema.default(null),
});

export function HeroSection({
  content,
  ctx,
}: {
  content: Record<string, unknown>;
  ctx: SiteRenderContext;
}) {
  const parsed = schema.safeParse(content);
  if (!parsed.success) return null;
  const { eyebrow, headline, subheadline, image, primaryCta, secondaryCta } = parsed.data;
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 md:grid-cols-2">
      <div className="space-y-4">
        {eyebrow === "" ? null : (
          <p className="text-sm font-medium uppercase tracking-wide text-violet">{eyebrow}</p>
        )}
        <h1 className="heading-page">{headline}</h1>
        {subheadline === "" ? null : <p className="text-lg text-ink-soft">{subheadline}</p>}
        <div className="flex flex-wrap gap-3 pt-2">
          <SiteButton cta={primaryCta} />
          <SiteButton cta={secondaryCta} variant="secondary" />
        </div>
      </div>
      <SiteImage image={image} media={ctx.media} className="w-full rounded-2xl object-cover" />
    </div>
  );
}

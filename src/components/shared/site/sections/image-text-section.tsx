import { z } from "zod";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { SiteImage } from "@/components/shared/site/site-image";
import { SiteButton } from "@/components/shared/site/site-link";
import { resolvedCtaSchema } from "@/lib/shared/content/published";
import { ImageSide } from "@/lib/shared/enums";

const schema = z.object({
  image: z
    .object({ mediaVersionId: z.string().nullable(), alt: z.string() })
    .nullable()
    .default(null),
  side: z.nativeEnum(ImageSide).default(ImageSide.Left),
  title: z.string().default(""),
  text: z.string().default(""),
  cta: resolvedCtaSchema.default(null),
});

export function ImageTextSection({
  content,
  ctx,
}: {
  content: Record<string, unknown>;
  ctx: SiteRenderContext;
}) {
  const parsed = schema.safeParse(content);
  if (!parsed.success) return null;
  const { image, side, title, text, cta } = parsed.data;
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 md:grid-cols-2">
      <SiteImage
        image={image}
        media={ctx.media}
        className={`w-full rounded-2xl object-cover ${side === ImageSide.Right ? "md:order-2" : ""}`}
      />
      <div className="space-y-3">
        {title === "" ? null : <h2 className="heading-card">{title}</h2>}
        {text === "" ? null : <p className="text-ink-soft">{text}</p>}
        <SiteButton cta={cta} />
      </div>
    </div>
  );
}

import { z } from "zod";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { SiteImage } from "@/components/shared/site/site-image";

const schema = z.object({
  title: z.string().default(""),
  images: z
    .array(z.object({ mediaVersionId: z.string().nullable(), alt: z.string() }).nullable())
    .default([]),
});

export function GallerySection({
  content,
  ctx,
}: {
  content: Record<string, unknown>;
  ctx: SiteRenderContext;
}) {
  const parsed = schema.safeParse(content);
  if (!parsed.success) return null;
  const images = parsed.data.images.filter(
    (image) => image?.mediaVersionId && ctx.media[image.mediaVersionId],
  );
  if (images.length === 0) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6">
      {parsed.data.title === "" ? null : <h2 className="heading-card">{parsed.data.title}</h2>}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {images.map((image, index) => (
          <li key={`${image?.mediaVersionId}-${index}`}>
            <SiteImage
              image={image}
              media={ctx.media}
              className="aspect-square w-full rounded-xl object-cover"
              sizes="(min-width: 768px) 33vw, 50vw"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

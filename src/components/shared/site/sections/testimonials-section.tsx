import { z } from "zod";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { SiteImage } from "@/components/shared/site/site-image";

const schema = z.object({
  title: z.string().default(""),
  items: z
    .array(
      z.object({
        quote: z.string(),
        author: z.string().default(""),
        role: z.string().default(""),
        photo: z
          .object({ mediaVersionId: z.string().nullable(), alt: z.string() })
          .nullable()
          .default(null),
      }),
    )
    .default([]),
});

export function TestimonialsSection({
  content,
  ctx,
}: {
  content: Record<string, unknown>;
  ctx: SiteRenderContext;
}) {
  const parsed = schema.safeParse(content);
  if (!parsed.success || parsed.data.items.length === 0) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6">
      {parsed.data.title === "" ? null : <h2 className="heading-card">{parsed.data.title}</h2>}
      <ul className="grid gap-6 md:grid-cols-2">
        {parsed.data.items.map((item) => (
          <li key={`${item.author}-${item.quote}`}>
            <figure className="space-y-3 rounded-2xl border border-line bg-surface p-6">
              <blockquote className="text-lg">&ldquo;{item.quote}&rdquo;</blockquote>
              <figcaption className="flex items-center gap-3 text-sm text-ink-soft">
                <SiteImage
                  image={item.photo}
                  media={ctx.media}
                  className="size-10 rounded-full object-cover"
                  sizes="40px"
                />
                <span>
                  {item.author}
                  {item.role === "" ? "" : `, ${item.role}`}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

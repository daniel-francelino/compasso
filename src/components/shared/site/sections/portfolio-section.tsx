import { z } from "zod";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { SiteImage } from "@/components/shared/site/site-image";
import { PortfolioSource } from "@/lib/shared/enums";

const schema = z.object({
  title: z.string().default(""),
  source: z.nativeEnum(PortfolioSource).default(PortfolioSource.All),
  caseStudyIds: z.array(z.string()).default([]),
  limit: z.number().int().default(6),
});

export function PortfolioSection({
  content,
  ctx,
}: {
  content: Record<string, unknown>;
  ctx: SiteRenderContext;
}) {
  const parsed = schema.safeParse(content);
  if (!parsed.success) return null;
  const { title, source, caseStudyIds, limit } = parsed.data;
  const cases =
    source === PortfolioSource.Manual
      ? caseStudyIds.flatMap((id) => ctx.caseStudies.filter((item) => item.page_id === id))
      : ctx.caseStudies;
  const shown = cases.slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6">
      {title === "" ? null : <h2 className="heading-card">{title}</h2>}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <li key={item.page_id}>
            <a
              href={`/${item.slug}`}
              className="block space-y-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-cream"
            >
              <SiteImage
                image={
                  item.card.imageVersionId === null
                    ? null
                    : { mediaVersionId: item.card.imageVersionId, alt: "" }
                }
                media={{ ...item.media, ...ctx.media }}
                className="aspect-[4/3] w-full rounded-xl object-cover"
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
              <h3 className="font-semibold">{item.card.title}</h3>
              {item.card.summary === "" ? null : (
                <p className="text-sm text-ink-soft">{item.card.summary}</p>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { z } from "zod";
import { SiteButton } from "@/components/shared/site/site-link";

const schema = z.object({
  title: z.string().default(""),
  intro: z.string().default(""),
  items: z
    .array(
      z.object({
        icon: z.string().default(""),
        name: z.string(),
        description: z.string().default(""),
        link: z.object({ href: z.string(), newTab: z.boolean() }).nullable().default(null),
      }),
    )
    .default([]),
});

export function ServicesSection({ content }: { content: Record<string, unknown> }) {
  const parsed = schema.safeParse(content);
  if (!parsed.success || parsed.data.items.length === 0) return null;
  const { title, intro, items } = parsed.data;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6">
      <header className="max-w-2xl space-y-2">
        {title === "" ? null : <h2 className="heading-card">{title}</h2>}
        {intro === "" ? null : <p className="text-ink-soft">{intro}</p>}
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.name} className="space-y-2 rounded-2xl border border-line bg-surface p-5">
            <h3 className="font-semibold">{item.name}</h3>
            {item.description === "" ? null : (
              <p className="text-sm text-ink-soft">{item.description}</p>
            )}
            {item.link ? (
              <SiteButton
                cta={{ label: "Saiba mais", href: item.link.href, newTab: item.link.newTab }}
                variant="secondary"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { z } from "zod";

const schema = z.object({
  title: z.string().default(""),
  items: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

export function FaqSection({ content }: { content: Record<string, unknown> }) {
  const parsed = schema.safeParse(content);
  if (!parsed.success || parsed.data.items.length === 0) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6">
      {parsed.data.title === "" ? null : <h2 className="heading-card">{parsed.data.title}</h2>}
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {parsed.data.items.map((item) => (
          <details key={item.question} className="group p-4">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">
              {item.question}
            </summary>
            <p className="pt-2 text-ink-soft">{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

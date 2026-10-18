import { z } from "zod";

const schema = z.object({
  blocks: z
    .array(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("heading"), text: z.string() }),
        z.object({ type: z.literal("paragraph"), text: z.string() }),
        z.object({ type: z.literal("list"), items: z.array(z.string()) }),
      ]),
    )
    .default([]),
});

export function RichTextSection({ content }: { content: Record<string, unknown> }) {
  const parsed = schema.safeParse(content);
  if (!parsed.success || parsed.data.blocks.length === 0) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6">
      {parsed.data.blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h2 key={index} className="heading-card">
              {block.text}
            </h2>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-6">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

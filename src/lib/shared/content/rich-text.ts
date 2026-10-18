export type RichBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const restOf = (lines: string[]): RichBlock[] => {
  const rest = lines.slice(1).join(" ");
  return rest === "" ? [] : [{ type: "paragraph", text: rest }];
};

export const parseRichText = (body: string): RichBlock[] => {
  const blocks: RichBlock[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const first = lines[0];
    if (first === undefined) continue;
    if (lines.every((line) => line.startsWith("- "))) {
      blocks.push({ type: "list", items: lines.map((line) => line.slice(2).trim()) });
      continue;
    }
    if (first.startsWith("# ")) {
      blocks.push({ type: "heading", text: first.slice(2).trim() });
      blocks.push(...restOf(lines));
      continue;
    }
    blocks.push({ type: "paragraph", text: lines.join(" ") });
  }
  return blocks;
};

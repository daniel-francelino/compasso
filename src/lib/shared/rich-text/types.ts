import { z } from "zod";
import type { ValueOf } from "@/lib/shared/utils";

export const RichNodeType = {
  Doc: "doc",
  Paragraph: "paragraph",
  Heading: "heading",
  BulletList: "bulletList",
  OrderedList: "orderedList",
  ListItem: "listItem",
  HardBreak: "hardBreak",
  Image: "image",
  Text: "text",
} as const;
export type RichNodeType = ValueOf<typeof RichNodeType>;

export const RichMarkType = {
  Bold: "bold",
  Italic: "italic",
} as const;
export type RichMarkType = ValueOf<typeof RichMarkType>;

export const RICH_TEXT_MAX_CHARACTERS = 8000;
export const RICH_TEXT_MAX_STORED_LENGTH = 4000;
export const RICH_TEXT_MAX_IMAGES = 10;
const RICH_TEXT_MAX_NODES = 2000;
const RICH_IMAGE_ALT_MAX = 100;

export type RichNode = {
  type: RichNodeType;
  attrs?:
    | { level?: number | undefined; mediaVersionId?: string | undefined; alt?: string | undefined }
    | undefined;
  content?: RichNode[] | undefined;
  text?: string | undefined;
  marks?: { type: RichMarkType }[] | undefined;
};

const richNodeSchema: z.ZodType<RichNode, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    type: z.nativeEnum(RichNodeType),
    attrs: z
      .object({
        level: z.number().int().min(2).max(3).optional(),
        mediaVersionId: z.string().uuid().optional(),
        alt: z.string().max(RICH_IMAGE_ALT_MAX).optional(),
      })
      .strict()
      .optional(),
    content: z.array(richNodeSchema).optional(),
    text: z.string().optional(),
    marks: z.array(z.object({ type: z.nativeEnum(RichMarkType) }).strict()).optional(),
  }),
);

export const richDocSchema = z
  .object({
    type: z.literal(RichNodeType.Doc),
    content: z.array(richNodeSchema).optional(),
  })
  .superRefine((doc, ctx) => {
    if (countNodes(doc.content ?? []) > RICH_TEXT_MAX_NODES) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O texto é complexo demais." });
    }
    if (plainTextOf(doc.content ?? []).length > RICH_TEXT_MAX_CHARACTERS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O texto é longo demais." });
    }
    if (JSON.stringify(doc).length > RICH_TEXT_MAX_STORED_LENGTH) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O texto é longo demais." });
    }
    if (hasImageWithoutReference(doc.content ?? [])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A imagem não tem arquivo." });
    }
    if (richDocImages(doc).length > RICH_TEXT_MAX_IMAGES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `No máximo ${RICH_TEXT_MAX_IMAGES} imagens no planejamento.`,
      });
    }
  });

export type RichDoc = z.infer<typeof richDocSchema>;

function hasImageWithoutReference(nodes: RichNode[]): boolean {
  return nodes.some(
    (node) =>
      (node.type === RichNodeType.Image && node.attrs?.mediaVersionId === undefined) ||
      hasImageWithoutReference(node.content ?? []),
  );
}

function countNodes(nodes: RichNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.content ?? []), 0);
}

function plainTextOf(nodes: RichNode[]): string {
  return nodes
    .map((node) =>
      node.type === RichNodeType.Text ? (node.text ?? "") : plainTextOf(node.content ?? []),
    )
    .join("");
}

export const richDocPlainText = (doc: RichDoc | null): string =>
  doc === null ? "" : plainTextOf(doc.content ?? []);

export type RichImage = { mediaVersionId: string; alt: string | undefined };

const imagesOf = (nodes: RichNode[]): RichImage[] =>
  nodes.flatMap((node) => {
    const own =
      node.type === RichNodeType.Image && node.attrs?.mediaVersionId !== undefined
        ? [{ mediaVersionId: node.attrs.mediaVersionId, alt: node.attrs.alt }]
        : [];
    return [...own, ...imagesOf(node.content ?? [])];
  });

export const richDocImages = (doc: RichDoc | null): RichImage[] => {
  const seen = new Set<string>();
  return imagesOf(doc?.content ?? []).filter((image) => {
    if (seen.has(image.mediaVersionId)) return false;
    seen.add(image.mediaVersionId);
    return true;
  });
};

export const isRichDocEmpty = (doc: RichDoc | null): boolean =>
  richDocPlainText(doc).trim() === "" && richDocImages(doc).length === 0;

export const richDocFromPlain = (text: string): RichDoc | null => {
  const paragraphs = text.split(/\n{2,}/).filter((part) => part.trim() !== "");
  if (paragraphs.length === 0) return null;
  return {
    type: RichNodeType.Doc,
    content: paragraphs.map((part) => ({
      type: RichNodeType.Paragraph,
      content: [{ type: RichNodeType.Text, text: part }],
    })),
  };
};

export const richDocFromStored = (value: unknown): RichDoc | null => {
  const rich = richDocSchema.safeParse(value);
  if (rich.success) return isRichDocEmpty(rich.data) ? null : rich.data;
  const legacy = z.union([z.object({ text: z.string() }), z.string()]).safeParse(value);
  if (!legacy.success) return null;
  return richDocFromPlain(typeof legacy.data === "string" ? legacy.data : legacy.data.text);
};

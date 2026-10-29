import type { JSONContent } from "@tiptap/core";
import {
  type RichDoc,
  type RichNode,
  RichMarkType,
  RichNodeType,
  isRichDocEmpty,
} from "@/lib/shared/rich-text/types";

export type ImageRegistry = Map<string, string>;

const EDITOR_NODE = {
  Doc: "doc",
  Paragraph: "paragraph",
  Heading: "heading",
  BulletList: "bulletList",
  OrderedList: "orderedList",
  TaskList: "taskList",
  ListItem: "listItem",
  TaskItem: "taskItem",
  HardBreak: "hardBreak",
  Image: "image",
  Text: "text",
  CodeBlock: "codeBlock",
  HorizontalRule: "horizontalRule",
} as const;

const missingImageSrc = (mediaVersionId: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23ebe1fa'/%3E%3C/svg%3E#${mediaVersionId}`;

const marksOf = (node: JSONContent): { type: RichMarkType }[] => {
  const types = (node.marks ?? []).map((mark) => mark.type);
  const kept: { type: RichMarkType }[] = [];
  if (types.includes(RichMarkType.Bold)) kept.push({ type: RichMarkType.Bold });
  if (types.includes(RichMarkType.Italic)) kept.push({ type: RichMarkType.Italic });
  return kept;
};

const clampHeading = (level: unknown): number => (typeof level === "number" && level >= 3 ? 3 : 2);

const normalizeList = (type: RichNodeType, node: JSONContent, registry: ImageRegistry) => ({
  type,
  content: (node.content ?? []).flatMap((child) => normalizeItem(child, registry)),
});

const normalizeItem = (node: JSONContent, registry: ImageRegistry): RichNode[] => {
  const blocks = normalizeNodes(node.content ?? [], registry);
  return [{ type: RichNodeType.ListItem, content: blocks }];
};

const normalizeText = (node: JSONContent): RichNode[] => {
  if (typeof node.text !== "string" || node.text === "") return [];
  const marks = marksOf(node);
  return [
    {
      type: RichNodeType.Text,
      text: node.text,
      ...(marks.length > 0 ? { marks } : {}),
    },
  ];
};

const normalizeImage = (node: JSONContent, registry: ImageRegistry): RichNode[] => {
  const src = typeof node.attrs?.["src"] === "string" ? node.attrs["src"] : "";
  const mediaVersionId = registry.get(src);
  if (mediaVersionId === undefined) return [];
  const alt = typeof node.attrs?.["alt"] === "string" ? node.attrs["alt"].slice(0, 100) : "";
  return [
    {
      type: RichNodeType.Image,
      attrs: { mediaVersionId, ...(alt === "" ? {} : { alt }) },
    },
  ];
};

const plainOf = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(plainOf).join("");

const normalizeNode = (node: JSONContent, registry: ImageRegistry): RichNode[] => {
  switch (node.type) {
    case EDITOR_NODE.Text:
      return normalizeText(node);
    case EDITOR_NODE.HardBreak:
      return [{ type: RichNodeType.HardBreak }];
    case EDITOR_NODE.Paragraph: {
      const content = normalizeNodes(node.content ?? [], registry);
      return [{ type: RichNodeType.Paragraph, ...(content.length > 0 ? { content } : {}) }];
    }
    case EDITOR_NODE.Heading: {
      const content = normalizeNodes(node.content ?? [], registry);
      return [
        {
          type: RichNodeType.Heading,
          attrs: { level: clampHeading(node.attrs?.["level"]) },
          ...(content.length > 0 ? { content } : {}),
        },
      ];
    }
    case EDITOR_NODE.BulletList:
    case EDITOR_NODE.TaskList:
      return [normalizeList(RichNodeType.BulletList, node, registry)];
    case EDITOR_NODE.OrderedList:
      return [normalizeList(RichNodeType.OrderedList, node, registry)];
    case EDITOR_NODE.ListItem:
    case EDITOR_NODE.TaskItem:
      return normalizeItem(node, registry);
    case EDITOR_NODE.Image:
      return normalizeImage(node, registry);
    case EDITOR_NODE.CodeBlock: {
      const text = plainOf(node);
      return text === ""
        ? []
        : [{ type: RichNodeType.Paragraph, content: [{ type: RichNodeType.Text, text }] }];
    }
    case EDITOR_NODE.HorizontalRule:
      return [];
    default:
      return normalizeNodes(node.content ?? [], registry);
  }
};

const normalizeNodes = (nodes: JSONContent[], registry: ImageRegistry): RichNode[] =>
  nodes.flatMap((node) => normalizeNode(node, registry));

export const fromEditorJson = (json: JSONContent, registry: ImageRegistry): RichDoc | null => {
  const doc: RichDoc = {
    type: RichNodeType.Doc,
    content: normalizeNodes(json.content ?? [], registry),
  };
  return isRichDocEmpty(doc) ? null : doc;
};

const toEditorNode = (
  node: RichNode,
  urlOf: (mediaVersionId: string) => string | undefined,
  registry: ImageRegistry,
): JSONContent => {
  if (node.type === RichNodeType.Text) {
    return {
      type: EDITOR_NODE.Text,
      text: node.text ?? "",
      ...(node.marks === undefined
        ? {}
        : { marks: node.marks.map((mark) => ({ type: mark.type })) }),
    };
  }
  if (node.type === RichNodeType.Image) {
    const id = node.attrs?.mediaVersionId ?? "";
    const src = urlOf(id) ?? missingImageSrc(id);
    registry.set(src, id);
    return { type: EDITOR_NODE.Image, attrs: { src, alt: node.attrs?.alt ?? "" } };
  }
  const attrs =
    node.type === RichNodeType.Heading ? { attrs: { level: node.attrs?.level ?? 2 } } : {};
  const content = node.content?.map((child) => toEditorNode(child, urlOf, registry));
  return { type: node.type, ...attrs, ...(content === undefined ? {} : { content }) };
};

export const toEditorJson = (
  doc: RichDoc | null,
  urlOf: (mediaVersionId: string) => string | undefined,
  registry: ImageRegistry,
): JSONContent => ({
  type: EDITOR_NODE.Doc,
  content:
    doc === null || (doc.content ?? []).length === 0
      ? [{ type: EDITOR_NODE.Paragraph }]
      : (doc.content ?? []).map((node) => toEditorNode(node, urlOf, registry)),
});

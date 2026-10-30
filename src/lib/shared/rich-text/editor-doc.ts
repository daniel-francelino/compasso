import type { JSONContent } from "@tiptap/core";
import {
  type RichDoc,
  type RichNode,
  RichMarkType,
  RichNodeType,
  isRichDocEmpty,
} from "@/lib/shared/rich-text/types";

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

export const missingImageSrc = (mediaVersionId: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='120'%3E%3Crect width='320' height='120' fill='%23ebe1fa'/%3E%3C/svg%3E#${mediaVersionId}`;

const marksOf = (node: JSONContent): { type: RichMarkType }[] => {
  const types = (node.marks ?? []).map((mark) => mark.type);
  const kept: { type: RichMarkType }[] = [];
  if (types.includes(RichMarkType.Bold)) kept.push({ type: RichMarkType.Bold });
  if (types.includes(RichMarkType.Italic)) kept.push({ type: RichMarkType.Italic });
  return kept;
};

const clampHeading = (level: unknown): number => (typeof level === "number" && level >= 3 ? 3 : 2);

const normalizeList = (type: RichNodeType, node: JSONContent) => ({
  type,
  content: (node.content ?? []).flatMap((child) => normalizeItem(child)),
});

const normalizeItem = (node: JSONContent): RichNode[] => {
  const blocks = normalizeNodes(node.content ?? []);
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

const normalizeImage = (node: JSONContent): RichNode[] => {
  const mediaVersionId = node.attrs?.["mediaVersionId"];
  if (typeof mediaVersionId !== "string" || mediaVersionId === "") return [];
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

const normalizeNode = (node: JSONContent): RichNode[] => {
  switch (node.type) {
    case EDITOR_NODE.Text:
      return normalizeText(node);
    case EDITOR_NODE.HardBreak:
      return [{ type: RichNodeType.HardBreak }];
    case EDITOR_NODE.Paragraph: {
      const content = normalizeNodes(node.content ?? []);
      return [{ type: RichNodeType.Paragraph, ...(content.length > 0 ? { content } : {}) }];
    }
    case EDITOR_NODE.Heading: {
      const content = normalizeNodes(node.content ?? []);
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
      return [normalizeList(RichNodeType.BulletList, node)];
    case EDITOR_NODE.OrderedList:
      return [normalizeList(RichNodeType.OrderedList, node)];
    case EDITOR_NODE.ListItem:
    case EDITOR_NODE.TaskItem:
      return normalizeItem(node);
    case EDITOR_NODE.Image:
      return normalizeImage(node);
    case EDITOR_NODE.CodeBlock: {
      const text = plainOf(node);
      return text === ""
        ? []
        : [{ type: RichNodeType.Paragraph, content: [{ type: RichNodeType.Text, text }] }];
    }
    case EDITOR_NODE.HorizontalRule:
      return [];
    default:
      return normalizeNodes(node.content ?? []);
  }
};

const normalizeNodes = (nodes: JSONContent[]): RichNode[] => nodes.flatMap(normalizeNode);

export const fromEditorJson = (json: JSONContent): RichDoc | null => {
  const doc: RichDoc = {
    type: RichNodeType.Doc,
    content: normalizeNodes(json.content ?? []),
  };
  return isRichDocEmpty(doc) ? null : doc;
};

const toEditorNode = (node: RichNode): JSONContent => {
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
    return {
      type: EDITOR_NODE.Image,
      attrs: { src: id, mediaVersionId: id, alt: node.attrs?.alt ?? "" },
    };
  }
  const attrs =
    node.type === RichNodeType.Heading ? { attrs: { level: node.attrs?.level ?? 2 } } : {};
  const content = node.content?.map(toEditorNode);
  return { type: node.type, ...attrs, ...(content === undefined ? {} : { content }) };
};

export const toEditorJson = (doc: RichDoc | null): JSONContent => ({
  type: EDITOR_NODE.Doc,
  content:
    doc === null || (doc.content ?? []).length === 0
      ? [{ type: EDITOR_NODE.Paragraph }]
      : (doc.content ?? []).map(toEditorNode),
});

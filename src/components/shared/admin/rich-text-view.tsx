import type { ReactNode } from "react";
import {
  type RichDoc,
  type RichNode,
  RichMarkType,
  RichNodeType,
} from "@/lib/shared/rich-text/types";

function renderText(node: RichNode, key: number): ReactNode {
  const marks = node.marks?.map((mark) => mark.type) ?? [];
  let content: ReactNode = node.text ?? "";
  if (marks.includes(RichMarkType.Italic)) content = <em>{content}</em>;
  if (marks.includes(RichMarkType.Bold)) content = <strong>{content}</strong>;
  return <span key={key}>{content}</span>;
}

function renderNode(node: RichNode, key: number): ReactNode {
  const children = (node.content ?? []).map(renderNode);
  switch (node.type) {
    case RichNodeType.Text:
      return renderText(node, key);
    case RichNodeType.HardBreak:
      return <br key={key} />;
    case RichNodeType.Paragraph:
      return <p key={key}>{children}</p>;
    case RichNodeType.Heading:
      return node.attrs?.level === 3 ? (
        <h4 key={key} className="font-semibold">
          {children}
        </h4>
      ) : (
        <h3 key={key} className="text-base font-semibold">
          {children}
        </h3>
      );
    case RichNodeType.BulletList:
      return (
        <ul key={key} className="list-disc space-y-1 pl-5">
          {children}
        </ul>
      );
    case RichNodeType.OrderedList:
      return (
        <ol key={key} className="list-decimal space-y-1 pl-5">
          {children}
        </ol>
      );
    case RichNodeType.ListItem:
      return <li key={key}>{children}</li>;
    case RichNodeType.Doc:
      return <div key={key}>{children}</div>;
  }
}

export function RichTextView({ doc }: { doc: RichDoc | null }) {
  if (doc === null) return <span>—</span>;
  return <div className="space-y-2">{(doc.content ?? []).map(renderNode)}</div>;
}

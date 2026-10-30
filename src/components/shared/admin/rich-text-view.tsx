import { RichTextView as LibraryRichTextView } from "lost-ui/editor";
import { missingImageSrc, toEditorJson } from "@/lib/shared/rich-text/editor-doc";
import type { RichDoc } from "@/lib/shared/rich-text/types";

export function RichTextView({
  doc,
  images,
}: {
  doc: RichDoc | null;
  images?: Record<string, string> | undefined;
}) {
  if (doc === null) return <span>—</span>;
  return (
    <LibraryRichTextView
      value={toEditorJson(doc)}
      resolveImageSrc={(attrs) => {
        const id = typeof attrs["mediaVersionId"] === "string" ? attrs["mediaVersionId"] : "";
        return images?.[id] ?? missingImageSrc(id);
      }}
    />
  );
}

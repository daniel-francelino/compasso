import type { ContentMedia } from "@/lib/marketing/content/types";
import { MediaKind } from "@/lib/shared/media/limits";
import { type RichDoc, RichNodeType, richDocImages } from "@/lib/shared/rich-text/types";

export const withPlanImages = (doc: RichDoc | null, media: ContentMedia[]): RichDoc | null => {
  const known = new Set(richDocImages(doc).map((image) => image.mediaVersionId));
  const missing = media.filter(
    (item) => item.kind === MediaKind.Image && !known.has(item.mediaVersionId),
  );
  if (missing.length === 0) return doc;
  return {
    type: RichNodeType.Doc,
    content: [
      ...(doc?.content ?? []),
      ...missing.map((item) => ({
        type: RichNodeType.Image,
        attrs: {
          mediaVersionId: item.mediaVersionId,
          ...((item.altText ?? item.name) === ""
            ? {}
            : { alt: (item.altText ?? item.name).slice(0, 100) }),
        },
      })),
    ],
  };
};

export const planMediaOf = (doc: RichDoc | null) =>
  richDocImages(doc).map((image) => ({
    mediaVersionId: image.mediaVersionId,
    altText: image.alt ?? null,
  }));

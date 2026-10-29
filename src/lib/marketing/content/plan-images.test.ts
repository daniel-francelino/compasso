import { describe, expect, it } from "vitest";
import { planMediaOf, withPlanImages } from "@/lib/marketing/content/plan-images";
import type { ContentMedia } from "@/lib/marketing/content/types";
import { MediaKind } from "@/lib/shared/media/limits";
import { type RichDoc, RichNodeType, richDocImages } from "@/lib/shared/rich-text/types";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const media = (id: string, kind: MediaKind | null): ContentMedia => ({
  mediaVersionId: id,
  altText: null,
  name: `${id.slice(0, 4)}.png`,
  mimeType: "image/png",
  kind,
  available: true,
});

describe("plan images", () => {
  it("appends plan files that are images and are not in the text yet", () => {
    const doc = withPlanImages(null, [
      media(ID_A, MediaKind.Image),
      media(ID_B, MediaKind.Document),
    ]);
    expect(richDocImages(doc).map((image) => image.mediaVersionId)).toEqual([ID_A]);
  });

  it("leaves the text alone when every image is already in it", () => {
    const base: RichDoc = {
      type: RichNodeType.Doc,
      content: [{ type: RichNodeType.Image, attrs: { mediaVersionId: ID_A } }],
    };
    expect(withPlanImages(base, [media(ID_A, MediaKind.Image)])).toBe(base);
  });

  it("derives the plan media from the image nodes, in order", () => {
    const doc = withPlanImages(
      {
        type: RichNodeType.Doc,
        content: [{ type: RichNodeType.Image, attrs: { mediaVersionId: ID_B, alt: "b" } }],
      },
      [media(ID_A, MediaKind.Image)],
    );
    expect(planMediaOf(doc)).toEqual([
      { mediaVersionId: ID_B, altText: "b" },
      { mediaVersionId: ID_A, altText: `${ID_A.slice(0, 4)}.png` },
    ]);
  });
});

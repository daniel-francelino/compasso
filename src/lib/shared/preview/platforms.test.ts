import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChannelPreview } from "@/components/shared/preview/channel-preview";
import { platformFormats } from "@/lib/shared/editorial/editorial";
import { ContentFormat, Platform } from "@/lib/shared/enums";
import { contentFormatLabels, platformLabels } from "@/lib/shared/labels";
import { MediaKind } from "@/lib/shared/media/limits";
import {
  isImmersivePreview,
  previewAspectRatio,
  previewFrameRatio,
} from "@/lib/shared/preview/platforms";

describe("channel preview layouts", () => {
  it("assigns a valid media frame to every available platform and format", () => {
    for (const platform of Object.values(Platform)) {
      for (const format of platformFormats[platform]) {
        const ratio = previewAspectRatio(platform, format).split("/").map(Number);
        expect(ratio).toHaveLength(2);
        expect(ratio.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
      }
    }
  });

  it("renders every offered platform and format with its matching frame", () => {
    for (const platform of Object.values(Platform)) {
      for (const format of platformFormats[platform]) {
        const markup = renderToStaticMarkup(
          createElement(ChannelPreview, {
            platform,
            profileName: "@marca",
            format,
            caption: "Legenda de teste",
            callToAction: null,
            media: [
              {
                versionId: "preview-media",
                kind:
                  format === ContentFormat.Video || format === ContentFormat.Reel
                    ? MediaKind.Video
                    : MediaKind.Image,
                altText: null,
                url: "/preview-media",
              },
            ],
          }),
        );
        const ratio = previewAspectRatio(platform, format).replaceAll(" ", "");
        const plainMarkup = markup.replaceAll(" ", "");
        expect(markup).toContain(platformLabels[platform]);
        expect(markup).toContain(contentFormatLabels[format]);
        expect(plainMarkup).toContain(`aspect-ratio:${ratio}`);
      }
    }
  });

  it("uses feed and video proportions that vary by platform", () => {
    expect(previewAspectRatio(Platform.Instagram, ContentFormat.Image)).toBe("4 / 5");
    expect(previewAspectRatio(Platform.Facebook, ContentFormat.Image)).toBe("1 / 1");
    expect(previewAspectRatio(Platform.Pinterest, ContentFormat.Image)).toBe("2 / 3");
    expect(previewAspectRatio(Platform.Youtube, ContentFormat.Video)).toBe("16 / 9");
    expect(previewAspectRatio(Platform.Tiktok, ContentFormat.Video)).toBe("9 / 16");
  });

  it("marks immersive formats for a narrow preview column", () => {
    expect(isImmersivePreview(Platform.Instagram, ContentFormat.Story)).toBe(true);
    expect(isImmersivePreview(Platform.Youtube, ContentFormat.Reel)).toBe(true);
    expect(isImmersivePreview(Platform.Tiktok, ContentFormat.Video)).toBe(true);
    expect(isImmersivePreview(Platform.Pinterest, ContentFormat.Video)).toBe(true);
    expect(isImmersivePreview(Platform.Youtube, ContentFormat.Video)).toBe(false);
  });

  it("follows the real ratio of the first file on Instagram posts, within what the network accepts", () => {
    const frame = (width: number, height: number, format: ContentFormat = ContentFormat.Image) =>
      Number(previewFrameRatio(Platform.Instagram, format, { width, height }).split("/")[0]) / 1000;
    expect(frame(1080, 1080)).toBeCloseTo(1);
    expect(frame(1080, 1350)).toBeCloseTo(0.8);
    expect(frame(1200, 628)).toBeCloseTo(1.91, 1);
    expect(frame(1000, 2000)).toBeCloseTo(0.8);
    expect(frame(4000, 1000)).toBeCloseTo(1.91);
    expect(frame(1080, 1080, ContentFormat.Carousel)).toBeCloseTo(1);
  });

  it("keeps the fixed frame without dimensions and for formats that are not flexible", () => {
    expect(previewFrameRatio(Platform.Instagram, ContentFormat.Image, undefined)).toBe("4 / 5");
    expect(
      previewFrameRatio(Platform.Instagram, ContentFormat.Image, { width: null, height: null }),
    ).toBe("4 / 5");
    expect(
      previewFrameRatio(Platform.Instagram, ContentFormat.Reel, { width: 1000, height: 1000 }),
    ).toBe("9 / 16");
    expect(
      previewFrameRatio(Platform.Facebook, ContentFormat.Image, { width: 1000, height: 500 }),
    ).toBe("1 / 1");
  });
});

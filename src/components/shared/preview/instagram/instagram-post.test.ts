import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InstagramMedia } from "@/components/shared/preview/instagram/instagram-media";
import { InstagramPost } from "@/components/shared/preview/instagram/instagram-post";
import type { PreviewMedia } from "@/components/shared/preview/media-slide";
import { ContentFormat } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";

const video: PreviewMedia = {
  versionId: "v1",
  kind: MediaKind.Video,
  altText: null,
  url: "https://files.example.test/clip.mp4",
  width: 1080,
  height: 1920,
};

const render = (format: ContentFormat, media: PreviewMedia[], caption: string): string =>
  renderToStaticMarkup(
    createElement(InstagramPost, {
      format,
      profileName: "@aurora",
      brandLogoUrl: null,
      media,
      caption,
      callToAction: null,
      onOpenDetails: () => undefined,
    }),
  );

describe("instagram post", () => {
  it("draws a story caption once, on a single line inside the frame", () => {
    const markup = render(ContentFormat.Story, [video], "Legenda do story");
    expect(markup.split("Legenda do story")).toHaveLength(2);
    expect(markup).toContain("truncate text-sm text-ivory");
    expect(markup).not.toContain("Texto da publicação");
  });

  it("keeps the reel caption and audio line on one line", () => {
    const markup = render(ContentFormat.Reel, [video], "Legenda do reel");
    expect(markup).toContain("block truncate text-xs");
    expect(markup).toContain('truncate">Áudio original');
    expect(markup).not.toContain("line-clamp-2");
  });

  it("draws the caption for a feed post without the profile name in front", () => {
    const markup = render(ContentFormat.Image, [], "Legenda do post");
    expect(markup).toContain("Legenda do post");
    expect(markup).not.toContain('font-semibold">aurora</span> Legenda');
    expect(markup.split("aurora")).toHaveLength(2);
  });

  it("plays a reel with the own player and no native controls", () => {
    const markup = render(ContentFormat.Reel, [video], "Legenda");
    expect(markup).toContain("<video");
    expect(markup).not.toContain("controls");
    expect(markup).toContain("Posição do vídeo");
    expect(markup).toContain("Ativar som");
  });

  it("gives a story the header controls and the reply bar", () => {
    const markup = render(ContentFormat.Story, [video], "");
    expect(markup).toContain("Pausar story");
    expect(markup).toContain("Responder a aurora…");
    expect(markup).not.toContain("Mostrar áreas cobertas");
  });

  it("has the header menu instead of a button under the frame", () => {
    const markup = render(ContentFormat.Reel, [video], "");
    expect(markup).toContain("Mais opções");
    expect(markup).not.toContain("Mostrar áreas cobertas");
  });
});

describe("instagram media fitted to the screen", () => {
  const media = (format: ContentFormat, fitScreen: boolean): string =>
    renderToStaticMarkup(
      createElement(InstagramMedia, {
        format,
        media: [video],
        caption: "",
        profileName: "@aurora",
        brandLogoUrl: null,
        fitScreen,
      }),
    );

  it("fits a story to the height of the screen", () => {
    expect(media(ContentFormat.Story, true)).toContain("calc(88dvh * 0.5625)");
    expect(media(ContentFormat.Story, false)).not.toContain("dvh");
  });

  it("fits a feed video to the height of the screen with the clamped 4:5 frame", () => {
    expect(media(ContentFormat.Video, true)).toContain("min(100%, calc(88dvh * 0.8))");
  });
});

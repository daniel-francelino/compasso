import { describe, expect, it } from "vitest";
import {
  CaptionTokenKind,
  INSTAGRAM_CAROUSEL_MAX_ITEMS,
  collapseInstagramCaption,
  instagramCaptionRule,
  instagramSafeZones,
  tokenizeCaption,
} from "@/lib/shared/preview/instagram";

describe("instagram rules", () => {
  it("keeps the carousel and safe zone constants in range", () => {
    expect(INSTAGRAM_CAROUSEL_MAX_ITEMS).toBe(20);
    expect(
      instagramSafeZones.story.topPercent + instagramSafeZones.story.bottomPercent,
    ).toBeLessThan(50);
    expect(instagramSafeZones.reel.bottomPercent).toBeLessThan(50);
    expect(instagramSafeZones.reel.rightPercent).toBeLessThan(50);
  });

  it("does not truncate a short caption", () => {
    expect(collapseInstagramCaption("Olá, mundo")).toEqual({
      text: "Olá, mundo",
      truncated: false,
    });
  });

  it("truncates after the visible characters", () => {
    const long = "a".repeat(instagramCaptionRule.visibleCharacters + 40);
    const result = collapseInstagramCaption(long);
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(instagramCaptionRule.visibleCharacters);
  });

  it("truncates after the visible lines", () => {
    const result = collapseInstagramCaption("um\ndois\ntrês\nquatro");
    expect(result).toEqual({ text: "um\ndois", truncated: true });
  });

  it("ignores blank lines when counting", () => {
    expect(collapseInstagramCaption("um\n\n\ndois")).toEqual({
      text: "um\ndois",
      truncated: false,
    });
  });

  it("splits hashtags and mentions from plain text", () => {
    expect(tokenizeCaption("Oi @maria veja #novidade hoje.")).toEqual([
      { kind: CaptionTokenKind.Text, text: "Oi " },
      { kind: CaptionTokenKind.Tag, text: "@maria" },
      { kind: CaptionTokenKind.Text, text: " veja " },
      { kind: CaptionTokenKind.Tag, text: "#novidade" },
      { kind: CaptionTokenKind.Text, text: " hoje." },
    ]);
  });

  it("returns a single text token without tags", () => {
    expect(tokenizeCaption("sem marcas")).toEqual([
      { kind: CaptionTokenKind.Text, text: "sem marcas" },
    ]);
  });
});

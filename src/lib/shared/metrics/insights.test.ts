import { describe, expect, it } from "vitest";
import type { BreakdownRow, TopPost } from "@/lib/shared/metrics/dto";
import { bestFormatOf, bestPostOf, bestSlotOf } from "@/lib/shared/metrics/insights";

const row = (key: string, posts: number, average: number): BreakdownRow => ({
  key,
  posts,
  average,
  total: posts * average,
});

const post = (id: string, reach: number): TopPost => ({
  external_media_id: id,
  permalink: null,
  media_type: "IMAGE",
  product_type: "FEED",
  posted_at: "2026-10-12T15:00:00Z",
  caption_excerpt: null,
  metrics: { reach },
  age_bucket: "h24",
  content_channel_id: null,
  item_id: null,
  item_title: null,
});

describe("bestFormatOf", () => {
  it("picks the format with the best average among those with enough posts", () => {
    const best = bestFormatOf([row("REELS", 5, 90), row("FEED", 8, 30), row("STORY", 1, 500)]);
    expect(best).toMatchObject({ label: "Reels", average: 90, posts: 5 });
    expect(best?.others).toBeCloseTo((8 * 30 + 500) / 9);
  });

  it("is empty when no format has enough posts", () => {
    expect(bestFormatOf([row("REELS", 2, 90), row("FEED", 1, 30)])).toBeNull();
  });
});

describe("bestSlotOf", () => {
  it("combines the best weekday and hour", () => {
    expect(bestSlotOf([row("4", 4, 50), row("2", 6, 20)], [row("19", 5, 60)])).toEqual({
      label: "Quintas às 19h",
      posts: 4,
    });
  });

  it("falls back to the one that exists", () => {
    expect(bestSlotOf([row("4", 4, 50)], [row("19", 1, 60)])?.label).toBe("Quintas");
    expect(bestSlotOf([], [row("19", 4, 60)])?.label).toBe("Posts às 19h");
    expect(bestSlotOf([], [])).toBeNull();
  });
});

describe("bestPostOf", () => {
  it("describes the top post by the chosen metric in the brand zone", () => {
    expect(bestPostOf([post("m1", 4820)], "reach", "America/Sao_Paulo")).toEqual({
      externalMediaId: "m1",
      postedLabel: "12/10",
      value: 4820,
    });
  });

  it("ignores a post without the metric or without result", () => {
    expect(bestPostOf([], "reach", "UTC")).toBeNull();
    expect(bestPostOf([post("m1", 0)], "reach", "UTC")).toBeNull();
    expect(bestPostOf([post("m1", 10)], "saves", "UTC")).toBeNull();
  });
});

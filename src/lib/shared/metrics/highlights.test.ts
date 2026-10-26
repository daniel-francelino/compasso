import { describe, expect, it } from "vitest";
import { MetricKey } from "@/lib/shared/enums";
import { deltaOf, Trend, type Overview, type MetricTotal } from "@/lib/shared/metrics/compute";
import { buildHighlights, summarySentence } from "@/lib/shared/metrics/highlights";

const total = (patch: Partial<MetricTotal> = {}): MetricTotal => ({
  sum: 100,
  avg: 10,
  days: 10,
  first: 1000,
  last: 1100,
  ...patch,
});

const overview = (patch: Partial<Overview> = {}): Overview => ({
  timezone: "America/Sao_Paulo",
  from: "2026-10-01",
  to: "2026-10-10",
  previous_from: "2026-09-21",
  previous_to: "2026-09-30",
  granularity: "day",
  first_day: "2026-09-01",
  last_day: "2026-10-10",
  totals: {
    [MetricKey.Reach]: total({ avg: 150 }),
    [MetricKey.FollowersTotal]: total({ first: 1000, last: 1214 }),
    [MetricKey.Interactions]: total({ sum: 300 }),
  },
  previous_totals: {
    [MetricKey.Reach]: total({ avg: 100 }),
    [MetricKey.FollowersTotal]: total({ first: 900, last: 1000 }),
    [MetricKey.Interactions]: total({ sum: 200 }),
  },
  series: {},
  previous_series: null,
  posts_published: 9,
  previous_posts_published: 14,
  ...patch,
});

const base = { periodLabel: "Em outubro", bestPost: null, bestFormat: null, bestSlot: null };

describe("deltaOf", () => {
  it("reports growth, drop and flat", () => {
    expect(deltaOf(120, 100)).toEqual({ absolute: 20, percent: 0.2, trend: Trend.Up });
    expect(deltaOf(80, 100).trend).toBe(Trend.Down);
    expect(deltaOf(100, 100).trend).toBe(Trend.Flat);
    expect(deltaOf(100.2, 100).trend).toBe(Trend.Flat);
  });

  it("has no percent when the previous value is zero", () => {
    expect(deltaOf(5, 0)).toEqual({ absolute: 5, percent: null, trend: Trend.Up });
  });

  it("has no trend when a value is missing", () => {
    expect(deltaOf(undefined, 10).trend).toBe(Trend.None);
    expect(deltaOf(10, undefined).trend).toBe(Trend.None);
  });
});

describe("buildHighlights", () => {
  it("states the follower gain with the comparison", () => {
    const items = buildHighlights({ ...base, overview: overview() });
    const followers = items.find((item) => item.id === "followers");
    expect(followers?.text).toContain("ganhou 214 seguidores");
    expect(followers?.text).toContain("mais que no período anterior");
  });

  it("states reach and interaction growth above the threshold", () => {
    const items = buildHighlights({ ...base, overview: overview() });
    expect(items.find((item) => item.id === "reach")?.text).toContain("cresceu 50%");
    expect(items.find((item) => item.id === "interactions")?.text).toContain("cresceu 50%");
  });

  it("skips a change below the threshold", () => {
    const flat = overview({
      previous_totals: {
        [MetricKey.Reach]: total({ avg: 148 }),
        [MetricKey.FollowersTotal]: total({ first: 900, last: 1000 }),
        [MetricKey.Interactions]: total({ sum: 295 }),
      },
    });
    const ids = buildHighlights({ ...base, overview: flat }).map((item) => item.id);
    expect(ids).not.toContain("reach");
    expect(ids).not.toContain("interactions");
  });

  it("raises a drop as the most important fact", () => {
    const drop = overview({
      totals: {
        [MetricKey.Reach]: total({ avg: 70 }),
        [MetricKey.FollowersTotal]: total({ first: 1000, last: 1000 }),
      },
    });
    const items = buildHighlights({ ...base, overview: drop });
    const reach = items.find((item) => item.id === "reach");
    expect(reach?.tone).toBe("bad");
    expect(reach?.importance).toBe(1);
  });

  it("compares formats and slots only with enough posts", () => {
    const few = buildHighlights({
      ...base,
      overview: overview(),
      bestFormat: { label: "Carrosséis", average: 90, others: 30, posts: 2 },
      bestSlot: { label: "Quintas às 19h", posts: 1 },
    });
    expect(few.map((item) => item.id)).not.toContain("best-format");
    expect(few.map((item) => item.id)).not.toContain("best-slot");

    const enough = buildHighlights({
      ...base,
      overview: overview(),
      bestFormat: { label: "Carrosséis", average: 90, others: 30, posts: 4 },
      bestSlot: { label: "Quintas às 19h", posts: 4 },
    });
    expect(enough.find((item) => item.id === "best-format")?.text).toContain("3,0 vezes");
    expect(enough.map((item) => item.id)).toContain("best-slot");
  });

  it("explains the posting rhythm and never invents a cause", () => {
    const items = buildHighlights({ ...base, overview: overview() });
    const rhythm = items.find((item) => item.id === "rhythm");
    expect(rhythm?.text).toBe("Foram 9 posts, contra 14 no período anterior.");
    expect(items.every((item) => !/porque|devido|por causa/i.test(item.text))).toBe(true);
  });

  it("asks for patience when there is little data", () => {
    const thin = overview({
      totals: {
        [MetricKey.Reach]: total({ days: 1 }),
        [MetricKey.FollowersTotal]: total({ days: 1 }),
      },
    });
    const items = buildHighlights({ ...base, overview: thin });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("little-data");
  });

  it("returns at most five facts, most important first", () => {
    const items = buildHighlights({
      ...base,
      overview: overview(),
      bestPost: { externalMediaId: "m1", postedLabel: "12/10", value: 4820 },
      bestFormat: { label: "Reels", average: 90, others: 30, posts: 5 },
      bestSlot: { label: "Quintas às 19h", posts: 5 },
    });
    expect(items.length).toBeLessThanOrEqual(5);
    const order = items.map((item) => item.importance);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("summarySentence", () => {
  it("joins the follower gain and the reach change", () => {
    expect(summarySentence(overview(), "Em outubro")).toBe(
      "Em outubro, o perfil ganhou 214 seguidores e o alcance cresceu 50%.",
    );
  });

  it("is empty when nothing is worth saying", () => {
    const quiet = overview({
      totals: { [MetricKey.FollowersTotal]: total({ first: 1000, last: 1000 }) },
      previous_totals: null,
    });
    expect(summarySentence(quiet, "Em outubro")).toBeNull();
  });
});

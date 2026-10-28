import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentFormat } from "@/lib/shared/enums";
import { classifyFailure } from "@/lib/shared/social/graph.server";
import {
  fetchAccountDay,
  fetchAudience,
  fetchPostMetrics,
} from "@/lib/shared/social/instagram-insights.server";
import {
  JPEG_MIME,
  MAX_IMAGE_BYTES,
  VIDEO_MIME,
  checkRequest,
  getPublishingQuota,
  startPublication,
} from "@/lib/shared/social/instagram-publish.server";
import { exchangeCode, getProfile, refreshToken } from "@/lib/shared/social/instagram.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";

type Call = { url: string; body: string | null };

const respondWith = (...replies: { status?: number; body: unknown }[]): Call[] => {
  const calls: Call[] = [];
  const queue = [...replies];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string, init?: { body?: URLSearchParams }) => {
      calls.push({ url: String(input), body: init?.body?.toString() ?? null });
      const reply = queue.shift() ?? { status: 500, body: {} };
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
    }),
  );
  return calls;
};

const image = { mimeType: JPEG_MIME, sizeBytes: 1000, url: "https://signed.example/a.jpg" };
const video = { mimeType: VIDEO_MIME, sizeBytes: 5000, url: "https://signed.example/v.mp4" };
const config = { appId: "app", appSecret: "secret", tokenKey: "key" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("classifyFailure", () => {
  it("maps an invalid token to a lost connection", () => {
    expect(classifyFailure(400, { error: { code: 190, message: "expired" } })).toMatchObject({
      code: PublishErrorCode.ConnectionExpired,
      transient: false,
    });
    expect(classifyFailure(401, null).code).toBe(PublishErrorCode.ConnectionExpired);
  });

  it("maps the daily post limit", () => {
    expect(classifyFailure(400, { error: { code: 9, error_subcode: 2207042 } }).code).toBe(
      PublishErrorCode.LimitReached,
    );
  });

  it("treats throttling and server errors as transient", () => {
    expect(classifyFailure(400, { error: { code: 4 } })).toMatchObject({
      code: PublishErrorCode.Unavailable,
      transient: true,
    });
    expect(classifyFailure(503, null).transient).toBe(true);
  });

  it("maps a download failure to media not ready", () => {
    expect(classifyFailure(400, { error: { code: 9004 } }).code).toBe(
      PublishErrorCode.MediaNotReady,
    );
  });

  it("falls back to a rejection and keeps the provider text short", () => {
    const failure = classifyFailure(400, { error: { code: 100, message: "x".repeat(500) } });
    expect(failure.code).toBe(PublishErrorCode.Rejected);
    expect(failure.provider.length).toBeLessThanOrEqual(200);
  });
});

describe("checkRequest", () => {
  it("accepts one JPEG as an image", () => {
    expect(checkRequest({ format: ContentFormat.Image, caption: "oi", media: [image] }).ok).toBe(
      true,
    );
  });

  it("accepts one MP4 video in a post", () => {
    expect(checkRequest({ format: ContentFormat.Image, caption: "oi", media: [video] }).ok).toBe(
      true,
    );
  });

  it("refuses two videos in a post", () => {
    expect(
      checkRequest({ format: ContentFormat.Image, caption: "", media: [video, video] }).ok,
    ).toBe(false);
  });

  it("refuses an image that is not a JPEG", () => {
    const webp = { ...image, mimeType: "image/webp" };
    expect(checkRequest({ format: ContentFormat.Image, caption: "", media: [webp] })).toEqual({
      ok: false,
      code: PublishErrorCode.MediaNotReady,
    });
  });

  it("refuses an image above the size limit", () => {
    const big = { ...image, sizeBytes: MAX_IMAGE_BYTES + 1 };
    expect(checkRequest({ format: ContentFormat.Image, caption: "", media: [big] }).ok).toBe(false);
  });

  it("needs at least two images in a carousel", () => {
    expect(checkRequest({ format: ContentFormat.Carousel, caption: "", media: [image] }).ok).toBe(
      false,
    );
    expect(
      checkRequest({ format: ContentFormat.Carousel, caption: "", media: [image, image] }).ok,
    ).toBe(true);
  });

  it("needs one MP4 for a reel", () => {
    expect(checkRequest({ format: ContentFormat.Reel, caption: "", media: [video] }).ok).toBe(true);
    expect(checkRequest({ format: ContentFormat.Reel, caption: "", media: [image] }).ok).toBe(
      false,
    );
  });

  it("refuses formats it cannot publish", () => {
    expect(checkRequest({ format: ContentFormat.Text, caption: "", media: [image] })).toEqual({
      ok: false,
      code: PublishErrorCode.FormatNotSupported,
    });
  });

  it("refuses a caption beyond the platform limits", () => {
    const long = "a".repeat(2201);
    expect(checkRequest({ format: ContentFormat.Image, caption: long, media: [image] }).ok).toBe(
      false,
    );
    const tags = Array.from({ length: 31 }, (_, index) => `#tag${index}`).join(" ");
    expect(checkRequest({ format: ContentFormat.Image, caption: tags, media: [image] }).ok).toBe(
      false,
    );
  });
});

describe("startPublication", () => {
  it("creates an image container with the caption", async () => {
    const calls = respondWith({ body: { id: "c1" } });
    const result = await startPublication("tok", "ig1", {
      format: ContentFormat.Image,
      caption: "Legenda",
      media: [image],
    });
    expect(result).toEqual({ ok: true, data: { id: "c1" } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/ig1/media");
    expect(calls[0]?.body).toContain("image_url=");
    expect(calls[0]?.body).toContain("caption=Legenda");
  });

  it("creates children first and then the carousel container", async () => {
    const calls = respondWith(
      { body: { id: "k1" } },
      { body: { id: "k2" } },
      { body: { id: "parent" } },
    );
    const result = await startPublication("tok", "ig1", {
      format: ContentFormat.Carousel,
      caption: "x",
      media: [image, image],
    });
    expect(result).toEqual({ ok: true, data: { id: "parent" } });
    expect(calls[0]?.body).toContain("is_carousel_item=true");
    expect(calls[2]?.body).toContain("media_type=CAROUSEL");
    expect(calls[2]?.body).toContain("children=k1%2Ck2");
  });

  it("creates a reel container from a video", async () => {
    const calls = respondWith({ body: { id: "r1" } });
    await startPublication("tok", "ig1", {
      format: ContentFormat.Reel,
      caption: "r",
      media: [video],
    });
    expect(calls[0]?.body).toContain("media_type=REELS");
    expect(calls[0]?.body).toContain("video_url=");
  });

  it("stops at the first child that fails", async () => {
    const calls = respondWith({ status: 400, body: { error: { code: 9004 } } });
    const result = await startPublication("tok", "ig1", {
      format: ContentFormat.Carousel,
      caption: "x",
      media: [image, image],
    });
    expect(result).toMatchObject({ ok: false, code: PublishErrorCode.MediaNotReady });
    expect(calls).toHaveLength(1);
  });

  it("reports a network failure as transient", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await startPublication("tok", "ig1", {
      format: ContentFormat.Image,
      caption: "",
      media: [image],
    });
    expect(result).toMatchObject({ ok: false, transient: true });
  });
});

describe("quota and profile", () => {
  it("reads the publishing quota", async () => {
    respondWith({ body: { data: [{ quota_usage: 12, config: { quota_total: 100 } }] } });
    expect(await getPublishingQuota("tok", "ig1")).toEqual({
      ok: true,
      data: { used: 12, total: 100 },
    });
  });

  it("reads the profile", async () => {
    respondWith({
      body: { user_id: "17841", username: "aurora", account_type: "BUSINESS", followers_count: 10 },
    });
    expect(await getProfile("tok")).toEqual({
      ok: true,
      data: {
        accountId: "17841",
        username: "aurora",
        displayName: null,
        accountType: "BUSINESS",
        followersCount: 10,
      },
    });
  });
});

describe("oauth", () => {
  it("exchanges the code for a long-lived token", async () => {
    respondWith(
      { body: { data: [{ access_token: "short", user_id: 1, permissions: "a,b" }] } },
      { body: { access_token: "long", expires_in: 5184000 } },
    );
    const result = await exchangeCode(config, "https://app.example/cb", "code123");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.token).toBe("long");
    expect(result.data.scopes).toEqual(["a", "b"]);
    expect(result.data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 5_000_000_000);
  });

  it("accepts the flat short-token shape", async () => {
    respondWith(
      { body: { access_token: "short", user_id: 1 } },
      { body: { access_token: "long", expires_in: 100 } },
    );
    expect((await exchangeCode(config, "https://app.example/cb", "c")).ok).toBe(true);
  });

  it("fails when the code is refused", async () => {
    respondWith({ status: 400, body: { error: { code: 100, message: "bad code" } } });
    expect(await exchangeCode(config, "https://app.example/cb", "c")).toMatchObject({ ok: false });
  });

  it("refreshes a token", async () => {
    respondWith({ body: { access_token: "renewed", expires_in: 5184000 } });
    const result = await refreshToken("old");
    expect(result.ok && result.data.token).toBe("renewed");
  });
});

describe("insights", () => {
  it("maps the account totals of a day to the stored metrics", async () => {
    respondWith({
      body: {
        data: [
          { name: "reach", total_value: { value: 120 } },
          { name: "total_interactions", total_value: { value: 30 } },
          { name: "unknown_metric", total_value: { value: 1 } },
        ],
      },
    });
    expect(await fetchAccountDay("tok", "ig1", "2026-10-01")).toEqual({
      ok: true,
      data: [
        { day: "2026-10-01", metric: "reach", value: 120 },
        { day: "2026-10-01", metric: "interactions", value: 30 },
      ],
    });
  });

  it("reads post metrics and falls back to a smaller set", async () => {
    respondWith(
      { status: 400, body: { error: { code: 100 } } },
      {
        body: {
          data: [
            { name: "reach", values: [{ value: 500 }] },
            { name: "saves", values: [{ value: 7 }] },
          ],
        },
      },
    );
    expect(await fetchPostMetrics("tok", "m1")).toEqual({
      ok: true,
      data: { reach: 500, saves: 7 },
    });
  });

  it("builds the audience from the breakdowns that answer", async () => {
    const breakdown = (key: string, value: number) => ({
      body: {
        data: [
          {
            name: "follower_demographics",
            total_value: { breakdowns: [{ results: [{ dimension_values: [key], value }] }] },
          },
        ],
      },
    });
    respondWith(
      breakdown("BR", 90),
      { status: 400, body: {} },
      breakdown("25-34", 40),
      breakdown("F", 60),
    );
    const result = await fetchAudience("tok", "ig1");
    expect(result.ok && result.data.map((row) => row.dimension)).toEqual(["country", "age_gender"]);
  });
});

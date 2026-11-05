import { describe, expect, it } from "vitest";
import {
  FEED_PREFETCH_POSTS,
  FeedPostKind,
  channelCaption,
  feedPostKind,
  shouldLoadMore,
} from "@/lib/portal/approvals/feed";
import type { PortalChannel, PortalMedia, PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalRequestStatus, ApprovalStage } from "@/lib/shared/enums";

const media: PortalMedia = {
  versionId: "m1",
  position: 0,
  altText: null,
  mimeType: "image/jpeg",
  width: 800,
  height: 1000,
  name: "arte.jpg",
  hasThumb: true,
  hasDisplay: true,
};

const channel = (overrides: Partial<PortalChannel> = {}): PortalChannel => ({
  rowId: "c1",
  platform: "instagram",
  profileName: "@aurora",
  format: "image",
  caption: null,
  plannedAt: null,
  plannedTimezone: null,
  ...overrides,
});

const request = (overrides: Partial<PortalRequest>): PortalRequest => ({
  id: "r1",
  itemId: "i1",
  revisionId: "v1",
  stage: ApprovalStage.Art,
  status: ApprovalRequestStatus.Pending,
  title: "Teste",
  planSummary: null,
  caption: "",
  commentCount: 0,
  decisionComment: null,
  channels: [channel()],
  media: [],
  brandTimezone: null,
  revisionNo: 1,
  dueDate: null,
  requestedAt: "2026-11-01T10:00:00Z",
  decidedAt: null,
  canDecide: true,
  decidedByName: null,
  decidedOnBehalf: false,
  ...overrides,
});

describe("feedPostKind", () => {
  it("draws the full post with caption and files", () => {
    expect(feedPostKind(request({ caption: "Texto", media: [media] }))).toBe(FeedPostKind.Full);
  });

  it("draws the post without caption when there are only files", () => {
    expect(feedPostKind(request({ media: [media] }))).toBe(FeedPostKind.MediaOnly);
  });

  it("uses the fallback when there is only a caption", () => {
    expect(feedPostKind(request({ caption: "Texto" }))).toBe(FeedPostKind.CaptionOnly);
  });

  it("draws the planning card for a plan version even with reference files", () => {
    expect(feedPostKind(request({ stage: ApprovalStage.Plan, media: [media] }))).toBe(
      FeedPostKind.Plan,
    );
  });

  it("counts a caption written only on a channel row", () => {
    const withRowCaption = request({
      media: [media],
      channels: [channel({ caption: "Só no canal" })],
    });
    expect(feedPostKind(withRowCaption)).toBe(FeedPostKind.Full);
  });
});

describe("channelCaption", () => {
  it("prefers the channel adjustment", () => {
    const row = channel({ caption: "Ajuste" });
    expect(channelCaption(request({ caption: "Base", channels: [row] }), row)).toBe("Ajuste");
  });

  it("falls back to the base caption", () => {
    const row = channel({ caption: "  " });
    expect(channelCaption(request({ caption: "Base", channels: [row] }), row)).toBe("Base");
  });
});

describe("shouldLoadMore", () => {
  const base = { loaded: 20, hasNextPage: true, fetching: false, failed: false };

  it("loads the next page when the last visible post is near the end", () => {
    expect(shouldLoadMore({ ...base, lastVisibleIndex: 20 - FEED_PREFETCH_POSTS })).toBe(true);
    expect(shouldLoadMore({ ...base, lastVisibleIndex: 19 })).toBe(true);
  });

  it("waits while the reader is still far from the end", () => {
    expect(shouldLoadMore({ ...base, lastVisibleIndex: 5 })).toBe(false);
  });

  it("does not load without a next page, while fetching or after a failure", () => {
    expect(shouldLoadMore({ ...base, lastVisibleIndex: 19, hasNextPage: false })).toBe(false);
    expect(shouldLoadMore({ ...base, lastVisibleIndex: 19, fetching: true })).toBe(false);
    expect(shouldLoadMore({ ...base, lastVisibleIndex: 19, failed: true })).toBe(false);
  });
});

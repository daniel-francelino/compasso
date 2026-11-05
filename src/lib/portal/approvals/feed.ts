import type { PortalChannel, PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalStage } from "@/lib/shared/enums";
import type { ValueOf } from "@/lib/shared/utils";

export const FeedPostKind = {
  Full: "full",
  MediaOnly: "media_only",
  CaptionOnly: "caption_only",
  Plan: "plan",
} as const;
export type FeedPostKind = ValueOf<typeof FeedPostKind>;

export const channelCaption = (request: PortalRequest, channel: PortalChannel): string => {
  const own = channel.caption ?? "";
  return own.trim() === "" ? request.caption : own;
};

const hasCaption = (request: PortalRequest): boolean =>
  request.caption.trim() !== "" ||
  request.channels.some((channel) => (channel.caption ?? "").trim() !== "");

export const feedPostKind = (request: PortalRequest): FeedPostKind => {
  if (request.stage === ApprovalStage.Plan) return FeedPostKind.Plan;
  if (request.media.length === 0) return FeedPostKind.CaptionOnly;
  return hasCaption(request) ? FeedPostKind.Full : FeedPostKind.MediaOnly;
};

export const FEED_PREFETCH_POSTS = 3;

export const shouldLoadMore = (state: {
  lastVisibleIndex: number;
  loaded: number;
  hasNextPage: boolean;
  fetching: boolean;
  failed: boolean;
}): boolean => {
  if (!state.hasNextPage || state.fetching || state.failed) return false;
  return state.lastVisibleIndex >= state.loaded - FEED_PREFETCH_POSTS;
};

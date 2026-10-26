import type { ValueOf } from "@/lib/shared/utils";

export const PublishErrorCode = {
  ConnectionExpired: "connection_expired",
  ConnectionMissing: "connection_missing",
  FormatNotSupported: "format_not_supported",
  MediaNotReady: "media_not_ready",
  LimitReached: "publish_limit_reached",
  Rejected: "instagram_rejected",
  Unavailable: "instagram_unavailable",
  Uncertain: "publish_uncertain",
  Stuck: "publish_stuck",
  TooLate: "publish_too_late",
} as const;
export type PublishErrorCode = ValueOf<typeof PublishErrorCode>;

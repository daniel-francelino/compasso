import type { ApprovalOutcome, ApprovalRequestStatus } from "@/lib/shared/enums";

export type PortalBrand = { id: string; name: string; pendingCount: number };

export type PortalRequest = {
  id: string;
  variantId: string;
  status: ApprovalRequestStatus;
  title: string;
  format: string;
  platform: string;
  profileName: string;
  plannedAt: string | null;
  plannedTimezone: string | null;
  brandTimezone: string | null;
  revisionNo: number;
  dueDate: string | null;
  requestedAt: string;
  decidedAt: string | null;
  isMine: boolean;
  approverName: string | null;
};

export type PortalMedia = {
  versionId: string;
  position: number;
  altText: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  name: string;
  hasThumb: boolean;
  hasDisplay: boolean;
};

export type PortalApproval = {
  request: PortalRequest;
  brandId: string;
  brandName: string;
  message: string | null;
  caption: string;
  callToAction: string | null;
  revisionId: string;
  isCurrent: boolean;
  currentRequestId: string | null;
  isDesignated: boolean;
  canDecide: boolean;
  media: PortalMedia[];
  decision: {
    outcome: ApprovalOutcome;
    comment: string | null;
    decidedAt: string;
    decidedByName: string | null;
  } | null;
  history: {
    requestId: string;
    revisionNo: number;
    status: ApprovalRequestStatus;
    requestedAt: string;
    decidedAt: string | null;
    comment: string | null;
  }[];
};

export type PortalComment = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  mine: boolean;
  fromTeam: boolean;
  revisionNo: number | null;
};

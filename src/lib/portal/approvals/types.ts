import type {
  ApprovalOutcome,
  ApprovalRequestStatus,
  ApprovalStage,
  ContentObjective,
} from "@/lib/shared/enums";

export type PortalBrand = {
  id: string;
  name: string;
  clientName: string;
  logoUrl: string | null;
  pendingCount: number;
};

export type PortalBrandChannel = {
  platform: string;
  profileName: string;
  profileUrl: string | null;
};

export type PortalBrandProfile = {
  id: string;
  name: string;
  clientName: string;
  logoUrl: string | null;
  description: string | null;
  targetAudience: string | null;
  toneOfVoice: string | null;
  objectives: string | null;
  timezone: string;
  channels: PortalBrandChannel[];
};

export type PortalChannel = {
  rowId: string;
  platform: string;
  profileName: string;
  format: string;
  caption: string | null;
  plannedAt: string | null;
  plannedTimezone: string | null;
};

export type PortalRequest = {
  id: string;
  itemId: string;
  revisionId: string;
  stage: ApprovalStage;
  status: ApprovalRequestStatus;
  title: string;
  objectiveKind: ContentObjective | null;
  planSummary: string | null;
  channels: PortalChannel[];
  media: PortalMedia[];
  brandTimezone: string | null;
  revisionNo: number;
  dueDate: string | null;
  requestedAt: string;
  decidedAt: string | null;
  canDecide: boolean;
  decidedByName: string | null;
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
  planSummary: string | null;
  objectiveKind: ContentObjective | null;
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

import type {
  ApprovalOutcome,
  ApprovalRequestStatus,
  ApprovalStage,
  CommentVisibility,
  ContentFormat,
  EditorialStatus,
  Platform,
  PublicationStatus,
} from "@/lib/shared/enums";
import type { ContentTypeRow } from "@/lib/shared/content-types/content-types.functions";
import type { MediaKind } from "@/lib/shared/media/limits";
import type { RichDoc } from "@/lib/shared/rich-text/types";

export type ContentMedia = {
  mediaVersionId: string;
  altText: string | null;
  name: string;
  mimeType: string;
  kind: MediaKind | null;
  available: boolean;
};

export type SnapshotChannel = {
  rowId: string;
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  caption: string | null;
  plannedAt: string | null;
  plannedTimezone: string | null;
};

export type RevisionSnapshot = {
  title: string;
  planSummary: RichDoc | null;
  caption: string;
  callToAction: string | null;
  channels: SnapshotChannel[];
};

export type RevisionRow = {
  id: string;
  revisionNo: number;
  stage: ApprovalStage;
  createdAt: string;
  snapshot: RevisionSnapshot;
  media: ContentMedia[];
};

export type RequestRow = {
  id: string;
  revisionId: string;
  revisionNo: number;
  stage: ApprovalStage;
  status: ApprovalRequestStatus;
  decidedById: string | null;
  decidedByName: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  requestedAt: string;
  dueDate: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  outcome: ApprovalOutcome | null;
  decisionComment: string | null;
  cancelledReason: string | null;
};

export type ChannelSummary = {
  id: string;
  channelId: string;
  platform: Platform;
  profileName: string;
  format: ContentFormat;
  publicationStatus: PublicationStatus;
  plannedAt: string | null;
  plannedTimezone: string | null;
};

export type ChannelRowDetail = ChannelSummary & {
  channelArchived: boolean;
  caption: string;
  version: number;
  published: { at: string; url: string | null; note: string | null } | null;
};

export type ContentDetail = {
  id: string;
  version: number;
  brandId: string;
  brandName: string;
  brandTimezone: string;
  title: string;
  internalNotes: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  publishDate: string | null;
  types: ContentTypeRow[];
  cancelled: boolean;
  editorialStatus: EditorialStatus;
  planRequired: boolean;
  planSummary: RichDoc | null;
  planMedia: ContentMedia[];
  planApprovedRevisionId: string | null;
  approvalDueDate: string | null;
  caption: string;
  callToAction: string | null;
  media: ContentMedia[];
  channels: ChannelRowDetail[];
  currentRevisionId: string | null;
  approvedRevisionId: string | null;
  nextRevisionNo: number;
  hasUnsentChanges: boolean;
  revisions: RevisionRow[];
  requests: RequestRow[];
  updatedAt: string;
};

export type CommentRow = {
  id: string;
  visibility: CommentVisibility;
  body: string;
  createdAt: string;
  editedAt: string | null;
  parentId: string | null;
  deleted: boolean;
  authorId: string;
  authorName: string;
  revisionNo: number | null;
  mine: boolean;
};

export type FileItem = {
  mediaVersionId: string;
  altText: string;
  name: string;
  kind: MediaKind | null;
};

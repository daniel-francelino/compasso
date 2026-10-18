import type {
  ApprovalOutcome,
  ApprovalRequestStatus,
  ContentFormat,
  EditorialStatus,
  Platform,
  PublicationStatus,
} from "@/lib/shared/enums";
import type { MediaKind } from "@/lib/shared/media/limits";

export type VariantMedia = {
  mediaVersionId: string;
  altText: string | null;
  name: string;
  mimeType: string;
  kind: MediaKind | null;
  available: boolean;
};

export type RevisionSnapshot = {
  title: string;
  format: ContentFormat;
  caption: string;
  callToAction: string | null;
  plannedAt: string | null;
  plannedTimezone: string | null;
  platform: Platform;
  profileName: string;
};

export type RevisionRow = {
  id: string;
  revisionNo: number;
  createdAt: string;
  snapshot: RevisionSnapshot;
  media: VariantMedia[];
};

export type RequestRow = {
  id: string;
  revisionId: string;
  revisionNo: number;
  status: ApprovalRequestStatus;
  approverName: string | null;
  requestedByName: string | null;
  requestedAt: string;
  dueDate: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  outcome: ApprovalOutcome | null;
  decisionComment: string | null;
  cancelledReason: string | null;
};

export type VariantDetail = {
  id: string;
  version: number;
  brandId: string;
  brandName: string;
  brandTimezone: string;
  itemId: string;
  itemTitle: string;
  itemCancelled: boolean;
  channelId: string;
  platform: Platform;
  profileName: string;
  channelArchived: boolean;
  format: ContentFormat;
  editorialStatus: EditorialStatus;
  publicationStatus: PublicationStatus;
  plannedAt: string | null;
  plannedTimezone: string | null;
  approvalDueDate: string | null;
  caption: string;
  callToAction: string | null;
  media: VariantMedia[];
  currentRevisionId: string | null;
  approvedRevisionId: string | null;
  nextRevisionNo: number;
  hasUnsentChanges: boolean;
  published: { at: string; url: string | null; note: string | null } | null;
  revisions: RevisionRow[];
  requests: RequestRow[];
};

export type CommentRow = {
  id: string;
  visibility: "internal" | "external";
  body: string;
  createdAt: string;
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

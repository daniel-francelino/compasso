import {
  Ban,
  CalendarClock,
  CalendarX,
  CircleCheck,
  Eye,
  FileText,
  Hammer,
  Hourglass,
  Replace,
  Send,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/shared/admin/status-badge";
import { ApprovalRequestStatus, EditorialStatus, PublicationStatus } from "@/lib/shared/enums";
import {
  approvalRequestStatusLabels,
  editorialStatusLabels,
  publicationStatusLabels,
} from "@/lib/shared/labels";

type Style = { tone: StatusTone; icon: LucideIcon };

const editorialStyles: Record<EditorialStatus, Style> = {
  [EditorialStatus.Draft]: { tone: "draft", icon: FileText },
  [EditorialStatus.InProduction]: { tone: "info", icon: Hammer },
  [EditorialStatus.InternalReview]: { tone: "info", icon: Eye },
  [EditorialStatus.AwaitingApproval]: { tone: "warning", icon: Hourglass },
  [EditorialStatus.ChangesRequested]: { tone: "negative", icon: Undo2 },
  [EditorialStatus.Approved]: { tone: "success", icon: CircleCheck },
  [EditorialStatus.Cancelled]: { tone: "neutral", icon: Ban },
};

const publicationStyles: Record<PublicationStatus, Style> = {
  [PublicationStatus.Unplanned]: { tone: "neutral", icon: CalendarX },
  [PublicationStatus.Planned]: { tone: "info", icon: CalendarClock },
  [PublicationStatus.PublishedManually]: { tone: "success", icon: Send },
  [PublicationStatus.Cancelled]: { tone: "neutral", icon: Ban },
};

const requestStyles: Record<ApprovalRequestStatus, Style> = {
  [ApprovalRequestStatus.Pending]: { tone: "warning", icon: Hourglass },
  [ApprovalRequestStatus.Approved]: { tone: "success", icon: CircleCheck },
  [ApprovalRequestStatus.ChangesRequested]: { tone: "negative", icon: Undo2 },
  [ApprovalRequestStatus.Superseded]: { tone: "neutral", icon: Replace },
  [ApprovalRequestStatus.Cancelled]: { tone: "neutral", icon: Ban },
};

export function EditorialStatusBadge({ status }: { status: EditorialStatus }) {
  const style = editorialStyles[status];
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {editorialStatusLabels[status]}
    </StatusBadge>
  );
}

export function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const style = publicationStyles[status];
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {publicationStatusLabels[status]}
    </StatusBadge>
  );
}

export function RequestStatusBadge({ status }: { status: ApprovalRequestStatus }) {
  const style = requestStyles[status];
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {approvalRequestStatusLabels[status]}
    </StatusBadge>
  );
}

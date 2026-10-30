import {
  Ban,
  CalendarClock,
  CalendarX,
  CircleCheck,
  ClipboardList,
  Hammer,
  Hourglass,
  Replace,
  Send,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { ApprovalRequestStatus, EditorialStatus, PublicationStatus } from "@/lib/shared/enums";

export type Style = { tone: StatusTone; icon: LucideIcon };

const editorialStyles: Record<EditorialStatus, Style> = {
  [EditorialStatus.Planning]: { tone: "info", icon: ClipboardList },
  [EditorialStatus.InProduction]: { tone: "info", icon: Hammer },
  [EditorialStatus.AwaitingApproval]: { tone: "warning", icon: Hourglass },
  [EditorialStatus.ChangesRequested]: { tone: "negative", icon: Undo2 },
  [EditorialStatus.Approved]: { tone: "success", icon: CircleCheck },
  [EditorialStatus.Published]: { tone: "success", icon: Send },
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

export const editorialStyle = (status: EditorialStatus): Style => editorialStyles[status];

export const publicationStyle = (status: PublicationStatus): Style => publicationStyles[status];

export const requestStyle = (status: ApprovalRequestStatus): Style => requestStyles[status];

import { StatusBadge } from "@/components/shared/admin/status-badge";
import {
  editorialStyle,
  publicationStyle,
  requestStyle,
} from "@/components/shared/content/status-styles";
import type { ApprovalRequestStatus, EditorialStatus, PublicationStatus } from "@/lib/shared/enums";
import {
  approvalRequestStatusLabels,
  editorialStatusLabels,
  publicationStatusLabels,
} from "@/lib/shared/labels";

export function EditorialStatusBadge({ status }: { status: EditorialStatus }) {
  const style = editorialStyle(status);
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {editorialStatusLabels[status]}
    </StatusBadge>
  );
}

export function PublicationStatusBadge({ status }: { status: PublicationStatus }) {
  const style = publicationStyle(status);
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {publicationStatusLabels[status]}
    </StatusBadge>
  );
}

export function RequestStatusBadge({ status }: { status: ApprovalRequestStatus }) {
  const style = requestStyle(status);
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {approvalRequestStatusLabels[status]}
    </StatusBadge>
  );
}

import type { PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalRequestStatus } from "@/lib/shared/enums";
import { todayInZone } from "@/lib/shared/format";

const DEFAULT_ZONE = "America/Sao_Paulo";

export const isOverdue = (request: PortalRequest): boolean =>
  request.status === ApprovalRequestStatus.Pending &&
  request.dueDate !== null &&
  request.dueDate < todayInZone(request.brandTimezone ?? DEFAULT_ZONE);

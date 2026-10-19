import type { PortalRequest } from "@/lib/portal/approvals/types";
import { ApprovalRequestStatus } from "@/lib/shared/enums";
import { formatDateOnly, todayInZone } from "@/lib/shared/format";

const DEFAULT_ZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;

export const DeadlineUrgency = {
  Overdue: "overdue",
  Soon: "soon",
  Later: "later",
} as const;
export type DeadlineUrgency = (typeof DeadlineUrgency)[keyof typeof DeadlineUrgency];

export type ResponseDeadline = { urgency: DeadlineUrgency; label: string };

const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

const plural = (days: number): string => (days === 1 ? "1 dia" : `${days} dias`);

export const responseDeadline = (request: PortalRequest): ResponseDeadline | null => {
  if (request.status !== ApprovalRequestStatus.Pending || request.dueDate === null) return null;
  const today = todayInZone(request.brandTimezone ?? DEFAULT_ZONE);
  const days = dayNumber(request.dueDate) - dayNumber(today);

  if (days < 0) {
    return {
      urgency: DeadlineUrgency.Overdue,
      label: `Prazo vencido há ${plural(-days)}`,
    };
  }
  if (days === 0) return { urgency: DeadlineUrgency.Soon, label: "Responder até hoje" };
  if (days === 1) return { urgency: DeadlineUrgency.Soon, label: "Responder até amanhã" };
  return {
    urgency: DeadlineUrgency.Later,
    label: `Responder até ${formatDateOnly(request.dueDate)}`,
  };
};

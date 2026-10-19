import { AlarmClock, Clock, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { DeadlineUrgency, responseDeadline } from "@/lib/portal/approvals/deadline";
import type { PortalRequest } from "@/lib/portal/approvals/types";

const style = {
  [DeadlineUrgency.Overdue]: { tone: "negative", icon: TriangleAlert },
  [DeadlineUrgency.Soon]: { tone: "warning", icon: AlarmClock },
  [DeadlineUrgency.Later]: { tone: "info", icon: Clock },
} as const satisfies Record<DeadlineUrgency, { tone: StatusTone; icon: typeof Clock }>;

export function ResponseDeadlineBadge({ request }: { request: PortalRequest }) {
  const deadline = responseDeadline(request);
  if (deadline === null) return null;
  const { tone, icon } = style[deadline.urgency];
  return (
    <StatusBadge tone={tone} icon={icon}>
      {deadline.label}
    </StatusBadge>
  );
}

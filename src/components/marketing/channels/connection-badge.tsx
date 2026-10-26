import { AlertTriangle, CheckCircle2, Clock, PlugZap } from "lucide-react";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import type { StatusTone } from "@/components/shared/admin/status-tones";
import { ConnectionStatus } from "@/lib/shared/enums";

const badges = {
  [ConnectionStatus.Active]: { tone: "success", icon: CheckCircle2, label: "Conectado" },
  [ConnectionStatus.Expiring]: { tone: "warning", icon: Clock, label: "Perto de expirar" },
  [ConnectionStatus.Expired]: { tone: "negative", icon: AlertTriangle, label: "Reconectar" },
  [ConnectionStatus.Revoked]: { tone: "negative", icon: PlugZap, label: "Acesso removido" },
} as const satisfies Record<
  ConnectionStatus,
  { tone: StatusTone; icon: typeof CheckCircle2; label: string }
>;

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const badge = badges[status];
  return (
    <StatusBadge tone={badge.tone} icon={badge.icon}>
      {badge.label}
    </StatusBadge>
  );
}

import { BellRing, Check, Clock } from "lucide-react";
import { Button } from "@/components/shared/ui/button";
import { NotificationSeverity } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import type { NotificationRow } from "@/lib/shared/notifications/notifications.functions";
import { cn } from "@/lib/shared/utils";

const severityLabel: Record<NotificationSeverity, string> = {
  [NotificationSeverity.Info]: "Aviso",
  [NotificationSeverity.Warning]: "Atenção",
  [NotificationSeverity.Urgent]: "Urgente",
};

export function NotificationItem({
  notification,
  onOpen,
  onRead,
  onSnooze,
}: {
  notification: NotificationRow;
  onOpen: (notification: NotificationRow) => void;
  onRead: (notification: NotificationRow) => void;
  onSnooze: (notification: NotificationRow) => void;
}) {
  const unread = notification.readAt === null;
  return (
    <li className="flex gap-3 border-b border-border p-3 last:border-b-0">
      <span
        className={cn(
          "mt-1.5 size-2.5 shrink-0 rounded-full",
          unread ? "bg-violet" : "bg-transparent",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => onOpen(notification)}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
            {notification.title}
            <span className="text-xs font-normal text-muted-foreground">
              {severityLabel[notification.severity]}
            </span>
            {unread ? <span className="sr-only">(não lida)</span> : null}
          </span>
          {notification.body ? (
            <span className="mt-0.5 block text-sm text-muted-foreground">{notification.body}</span>
          ) : null}
        </button>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <span>{formatDateTime(notification.createdAt)}</span>
          {unread ? (
            <Button variant="ghost" size="sm" onClick={() => onRead(notification)}>
              <Check aria-hidden="true" /> Marcar como lida
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => onSnooze(notification)}>
            <Clock aria-hidden="true" /> Adiar para amanhã
          </Button>
        </div>
      </div>
    </li>
  );
}

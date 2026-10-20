import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import { NotificationItem } from "@/components/shared/notifications/notification-item";
import { Button } from "@/components/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import { useNotificationActions } from "@/hooks/shared/use-notification-actions";
import { useUnreadCount } from "@/hooks/shared/use-notifications";
import {
  NotificationFilter,
  listNotifications,
} from "@/lib/shared/notifications/notifications.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

const MAX_BADGE = 9;
const PANEL_SIZE = 8;

export function NotificationBell({
  userId,
  notificationsTo = AppRoute.Notifications,
}: {
  userId: string;
  notificationsTo?: typeof AppRoute.Notifications | typeof AppRoute.PortalNotifications;
}) {
  const unread = useUnreadCount(userId);
  const actions = useNotificationActions();
  const filters = { filter: NotificationFilter.All, page: 1 };
  const latest = useQuery({
    queryKey: QueryKey.Notifications.list(filters),
    queryFn: async () => unwrapResult(await listNotifications({ data: filters })),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-11"
          aria-label={unread > 0 ? `Avisos: ${unread} não lidos` : "Avisos"}
        >
          <Bell aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-violet px-1 text-xs font-medium text-primary-foreground">
              {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="font-medium">Avisos</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void actions.readAll()}
            disabled={unread === 0 || actions.busy}
          >
            <CheckCheck aria-hidden="true" />
            Marcar todos como lidos
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(latest.data?.rows ?? []).slice(0, PANEL_SIZE).map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpen={(item) => void actions.open(item)}
              onRead={(item) => void actions.read(item)}
              onSnooze={(item) => void actions.snooze(item)}
            />
          ))}
        </ul>
        {latest.isPending ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : null}
        {latest.isError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            {latest.error.message}
          </p>
        ) : null}
        {latest.data?.rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nada novo por aqui.</p>
        ) : null}
        <div className="border-t border-border p-2 text-center">
          <Button asChild variant="ghost" size="sm">
            <Link to={notificationsTo}>
              <ArrowRight aria-hidden="true" />
              Ver todos
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useRouter } from "@tanstack/react-router";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type NotificationRow,
  markAllRead,
  markRead,
  snoozeNotification,
} from "@/lib/shared/notifications/notifications.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { toIso, tomorrowAtHour } from "@/lib/shared/dates";

const TOMORROW_HOUR = 9;

const tomorrowMorning = (): string => toIso(tomorrowAtHour(TOMORROW_HOUR));

export const useNotificationActions = () => {
  const router = useRouter();
  const { run, busy } = useServerAction();
  const invalidate = [QueryKey.Notifications.all()];

  const read = (notification: NotificationRow) =>
    run(() => markRead({ data: { ids: [notification.id] } }), { invalidate });

  return {
    busy,
    read,
    readAll: () => run(() => markAllRead(), { invalidate, success: "Tudo marcado como lido." }),
    snooze: (notification: NotificationRow) =>
      run(() => snoozeNotification({ data: { id: notification.id, until: tomorrowMorning() } }), {
        invalidate,
        success: "Aviso adiado para amanhã.",
      }),
    open: async (notification: NotificationRow) => {
      if (notification.readAt === null) await read(notification);
      const link = notification.link;
      if (link !== null && link.startsWith("/") && !link.startsWith("//"))
        router.history.push(link);
    },
  };
};

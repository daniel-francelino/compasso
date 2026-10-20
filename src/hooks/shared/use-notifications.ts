import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { countUnread } from "@/lib/shared/notifications/notifications.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { browserClient } from "@/lib/shared/supabase/client";

const POLL_MS = 60_000;
const REALTIME_CHANNEL = "compasso-notifications";

export const useUnreadCount = (userId: string) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QueryKey.Notifications.unread(),
    queryFn: async () => unwrapResult(await countUnread()).count,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    const client = browserClient();
    const channel = client
      .channel(`${REALTIME_CHANNEL}-${userId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void queryClient.invalidateQueries({ queryKey: QueryKey.Notifications.all() }),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query.data ?? 0;
};

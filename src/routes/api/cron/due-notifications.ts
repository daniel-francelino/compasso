import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCron } from "@/lib/shared/jobs/cron-auth.server";
import { runDueNotifications } from "@/lib/shared/jobs/due-notifications.server";

export const Route = createFileRoute("/api/cron/due-notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorizedCron(request.headers.get("authorization"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await runDueNotifications();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});

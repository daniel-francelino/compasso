import { createFileRoute } from "@tanstack/react-router";
import { runChannelRenewal } from "@/lib/shared/jobs/channel-connections.server";
import { runCollectMetrics } from "@/lib/shared/jobs/collect-metrics.server";
import { isAuthorizedCron } from "@/lib/shared/jobs/cron-auth.server";
import { runPublishDue } from "@/lib/shared/jobs/publish-due.server";

export const Route = createFileRoute("/api/cron/publish-due")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorizedCron(request.headers.get("authorization"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const publishing = await runPublishDue();
        const renewal = await runChannelRenewal();
        const metrics = await runCollectMetrics();
        const ok = publishing.ok && renewal.ok && metrics.ok;
        return Response.json({ publishing, renewal, metrics }, { status: ok ? 200 : 500 });
      },
    },
  },
});

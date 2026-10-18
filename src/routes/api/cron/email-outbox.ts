import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCron } from "@/lib/shared/jobs/cron-auth.server";
import { processEmailOutbox } from "@/lib/shared/jobs/email-outbox.server";

export const Route = createFileRoute("/api/cron/email-outbox")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorizedCron(request.headers.get("authorization"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const origin = process.env["SITE_URL"] ?? new URL(request.url).origin;
        const result = await processEmailOutbox(origin.replace(/\/+$/, ""));
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});

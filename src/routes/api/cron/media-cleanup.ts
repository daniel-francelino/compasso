import { createFileRoute } from "@tanstack/react-router";
import { cleanupExpiredUploads, isAuthorizedCron } from "@/lib/shared/media/cleanup.server";

export const Route = createFileRoute("/api/cron/media-cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorizedCron(request.headers.get("authorization"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await cleanupExpiredUploads();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});

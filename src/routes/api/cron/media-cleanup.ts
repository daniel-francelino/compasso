import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCron } from "@/lib/shared/jobs/cron-auth.server";
import { cleanupExpiredUploads, purgePublishedMedia } from "@/lib/shared/media/cleanup.server";

export const Route = createFileRoute("/api/cron/media-cleanup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthorizedCron(request.headers.get("authorization"))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const uploads = await cleanupExpiredUploads();
        const published = await purgePublishedMedia();
        return Response.json(
          { uploads, published },
          { status: uploads.ok && published.ok ? 200 : 500 },
        );
      },
    },
  },
});

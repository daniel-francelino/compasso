import { createStart } from "@tanstack/react-start";
import { siteStatusMiddleware } from "@/lib/site/response-status-middleware";

export const startInstance = createStart(() => ({
  requestMiddleware: [siteStatusMiddleware],
}));

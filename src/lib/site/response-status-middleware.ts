import { createMiddleware } from "@tanstack/react-start";

export const siteStatusMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const result = await next();
    const { markedResponseStatus } = await import("@/lib/site/response-status.server");
    const code = markedResponseStatus(request);
    if (code === undefined) return result;
    const headers = new Headers(result.response.headers);
    headers.set("x-robots-tag", "noindex");
    if (code === 503) headers.set("retry-after", "120");
    return {
      ...result,
      response: new Response(result.response.body, { status: code, headers }),
    };
  },
);

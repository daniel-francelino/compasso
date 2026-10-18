import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const statuses = new WeakMap<Request, number>();

export const markResponseStatus = (code: number): void => {
  statuses.set(getRequest(), code);
};

export const siteStatusMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next, request }) => {
    const result = await next();
    const code = statuses.get(request);
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

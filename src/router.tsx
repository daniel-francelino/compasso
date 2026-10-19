import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { AdminErrorPage } from "@/components/shared/admin/admin-fallbacks";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: AdminErrorPage,
  });
};

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    fullScreen?: boolean;
  }
}

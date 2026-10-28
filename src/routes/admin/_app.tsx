import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { AdminErrorPage, AdminNotFoundPage } from "@/components/shared/admin/admin-fallbacks";
import { AdminBackoffice } from "@/components/shared/admin/admin-backoffice";
import { BreadcrumbProvider } from "@/components/shared/admin/page-header";
import { UploadTrayProvider } from "@/components/shared/media/upload-tray-provider";
import { useAdminSpace } from "@/hooks/shared/use-admin-space";
import { blockedDestination, homeFor } from "@/lib/shared/auth/redirect";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { ProfileKind } from "@/lib/shared/enums";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/_app")({
  beforeLoad: async ({ location }) => {
    const auth = await getAuthState();
    const destination = blockedDestination(auth);

    if (destination === AppRoute.Login) {
      throw redirect({ to: AppRoute.Login, search: { redirect: location.href } });
    }
    if (destination !== null) throw redirect({ to: destination });
    if (auth.profile?.kind === ProfileKind.External) throw redirect({ to: homeFor(auth) });

    return { auth };
  },
  staleTime: 30_000,
  notFoundComponent: AdminNotFoundPage,
  errorComponent: AdminErrorPage,
  component: AdminLayout,
});

function AdminLayout() {
  const { auth } = Route.useRouteContext();
  const space = useAdminSpace();
  const fullScreen = useRouterState({
    select: (state) => state.matches.some((match) => match.staticData.fullScreen === true),
  });
  const fullWidth = useRouterState({
    select: (state) => {
      const pathname = (state.resolvedLocation ?? state.location).pathname;
      const brandDetail =
        pathname.startsWith("/admin/marketing/brands/") &&
        pathname !== "/admin/marketing/brands/new";
      return (
        brandDetail ||
        pathname.startsWith("/admin/marketing/content") ||
        pathname.startsWith("/admin/marketing/calendar")
      );
    },
  });

  return (
    <BreadcrumbProvider>
      <UploadTrayProvider>
        <AdminBackoffice auth={auth} space={space} fullScreen={fullScreen} fullWidth={fullWidth}>
          <Outlet />
        </AdminBackoffice>
      </UploadTrayProvider>
    </BreadcrumbProvider>
  );
}

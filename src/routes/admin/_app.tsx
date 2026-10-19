import { Outlet, createFileRoute, redirect, useRouterState } from "@tanstack/react-router";
import { AdminErrorPage, AdminNotFoundPage } from "@/components/shared/admin/admin-fallbacks";
import { AppSidebar } from "@/components/shared/admin/app-sidebar";
import { availableSpaces } from "@/components/shared/admin/nav-config";
import { SpaceSwitcher } from "@/components/shared/admin/space-switcher";
import { AppBreadcrumbs, BreadcrumbProvider } from "@/components/shared/admin/page-header";
import { NotificationBell } from "@/components/shared/notifications/notification-bell";
import { Separator } from "@/components/shared/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/shared/ui/sidebar";
import { Toaster } from "@/components/shared/ui/sonner";
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

  if (fullScreen) {
    return (
      <>
        <main id="main-content" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Saltar para o conteúdo
        </a>
        <AppSidebar auth={auth} space={space} />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background px-4 pointer-coarse:h-16">
            <SidebarTrigger aria-label="Abrir ou fechar a barra lateral" />
            <Separator orientation="vertical" className="h-5" />
            <AppBreadcrumbs />
            <SpaceSwitcher spaces={availableSpaces(auth)} current={space} />
            {auth.user ? <NotificationBell userId={auth.user.id} /> : null}
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
          >
            <Outlet />
          </main>
        </SidebarInset>
        <Toaster position="top-right" />
      </SidebarProvider>
    </BreadcrumbProvider>
  );
}

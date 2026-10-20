import type { ReactNode } from "react";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalBreadcrumbs } from "@/components/portal/portal-breadcrumbs";
import { NotificationBell } from "@/components/shared/notifications/notification-bell";
import { Separator } from "@/components/shared/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/shared/ui/sidebar";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { AppRoute } from "@/lib/shared/routes";

export function PortalShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar para o conteúdo
      </a>
      <PortalSidebar auth={auth} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background px-4 pointer-coarse:h-16">
          <SidebarTrigger aria-label="Abrir ou fechar a barra lateral" />
          <Separator orientation="vertical" className="h-5" />
          <PortalBreadcrumbs />
          {auth.user ? (
            <NotificationBell
              userId={auth.user.id}
              notificationsTo={AppRoute.PortalNotifications}
            />
          ) : null}
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

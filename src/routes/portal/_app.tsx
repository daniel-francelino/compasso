import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { Toaster } from "@/components/shared/ui/sonner";
import { Action } from "@/lib/shared/auth/actions";
import { blockedDestination } from "@/lib/shared/auth/redirect";
import { can } from "@/lib/shared/auth/permissions";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/portal/_app")({
  beforeLoad: async ({ location }) => {
    const auth = await getAuthState();
    const destination = blockedDestination(auth);

    if (destination === AppRoute.Login) {
      throw redirect({ to: AppRoute.Login, search: { redirect: location.href } });
    }
    if (destination !== null) throw redirect({ to: destination });
    if (!can(auth, Action.Portal.View)) throw redirect({ to: AppRoute.AccessDenied });

    return { auth };
  },
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <>
      <PortalShell>
        <Outlet />
      </PortalShell>
      <Toaster position="top-right" />
    </>
  );
}

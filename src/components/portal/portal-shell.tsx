import { Link } from "@tanstack/react-router";
import { Bell, LogOut, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { PortalBrandSwitcher } from "@/components/portal/brands/portal-brand-switcher";
import { Button } from "@/components/shared/ui/button";
import { useUnreadCount } from "@/hooks/shared/use-notifications";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";
import { AppRoute } from "@/lib/shared/routes";

const MAX_BADGE = 9;

function UnreadBadge({ userId }: { userId: string }) {
  const unread = useUnreadCount(userId);
  if (unread === 0) return null;
  return (
    <span className="rounded-full bg-violet px-1.5 text-xs font-medium text-primary-foreground">
      {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
    </span>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const signOut = useSignOut();
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar para o conteúdo
      </a>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <Link to={AppRoute.Portal} className="heading-card text-foreground">
              Portal do Cliente
            </Link>
            <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
            <PortalBrandSwitcher />
          </div>
          <nav aria-label="Portal" className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" className="min-h-11">
              <Link to="/portal/notifications">
                <Bell aria-hidden="true" />
                Avisos
                {auth.user ? <UnreadBadge userId={auth.user.id} /> : null}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="min-h-11">
              <Link to="/portal/profile">
                <UserRound aria-hidden="true" />
                Meu perfil
              </Link>
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" />
              Sair
            </Button>
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-4 py-6 outline-none sm:py-8"
      >
        {children}
      </main>
    </>
  );
}

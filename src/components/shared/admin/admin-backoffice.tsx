import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BackofficeLayout } from "lost-ui/templates/backoffice/backoffice-layout";
import type { NavSection } from "lost-ui/app/app-nav";
import { renderAuthLink } from "@/components/shared/admin/render-auth-link";
import {
  type AdminSpace,
  availableSpaces,
  visibleGroups,
} from "@/components/shared/admin/nav-config";
import { useBreadcrumbItems } from "@/components/shared/admin/breadcrumb-context";
import { NotificationBell } from "@/components/shared/notifications/notification-bell";
import { Toaster } from "@/components/shared/ui/sonner";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";
import type { AuthState } from "@/lib/shared/auth/types";
import { Space } from "@/lib/shared/enums";
import { AppRoute } from "@/lib/shared/routes";

const spaceTile: Record<AdminSpace, string> = {
  [Space.Marketing]: "bg-primary text-primary-foreground",
  [Space.Cms]: "bg-secondary text-secondary-foreground",
};

const userItems = [{ title: "Meu perfil", to: AppRoute.Profile }];

type AdminBackofficeProps = {
  auth: AuthState;
  space: AdminSpace;
  fullScreen: boolean;
  fullWidth: boolean;
  children: ReactNode;
};

export function AdminBackoffice({
  auth,
  space,
  fullScreen,
  fullWidth,
  children,
}: AdminBackofficeProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  const avatars = useAvatarUrls([auth.profile?.id]);
  const crumbs = useBreadcrumbItems();

  const sections: NavSection[] = visibleGroups(auth, space).map((group) => ({
    ...(group.label ? { label: group.label } : {}),
    items: group.items.map((item) => ({
      title: item.title,
      to: item.to,
      ...(item.exact ? { exact: true } : {}),
      icon: <item.icon aria-hidden="true" />,
    })),
  }));

  const spaces = availableSpaces(auth).map((entry) => ({
    id: entry.key,
    title: entry.title,
    to: entry.to,
    icon: <entry.icon className="size-6" aria-hidden="true" />,
    tileClassName: spaceTile[entry.key],
  }));

  const avatarUrl = auth.profile ? avatars[auth.profile.id] : undefined;
  const user = auth.profile
    ? { name: auth.profile.name, ...(avatarUrl ? { avatarUrl } : {}) }
    : undefined;

  return (
    <BackofficeLayout
      sections={sections}
      pathname={pathname}
      renderLink={renderAuthLink}
      fullScreen={fullScreen}
      fullWidth={fullWidth}
      logo={
        <div className="grid gap-0.5">
          <img
            src="/aura-creative-logo.png"
            alt="Aura Creative"
            className="h-auto w-32 px-2 pt-1"
          />
        </div>
      }
      {...(user ? { user } : {})}
      userItems={userItems}
      onSignOut={signOut}
      breadcrumbs={crumbs}
      spaces={spaces}
      currentSpace={space}
      topbarActions={auth.user ? <NotificationBell userId={auth.user.id} /> : null}
      overlay={<Toaster position={fullScreen ? "top-center" : "top-right"} />}
    >
      {children}
    </BackofficeLayout>
  );
}

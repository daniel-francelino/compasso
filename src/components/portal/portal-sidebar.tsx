import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { PortalBrandSwitcher } from "@/components/portal/brands/portal-brand-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/shared/ui/sidebar";
import { useUnreadCount } from "@/hooks/shared/use-notifications";
import { listPortalBrands } from "@/lib/portal/approvals/portal.functions";
import type { AuthState } from "@/lib/shared/auth/types";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const MAX_BADGE = 9;
const BRANDS_STALE_MS = 60_000;

type BrandLink = {
  title: string;
  icon: LucideIcon;
  to:
    | "/portal/brands/$brandId"
    | "/portal/brands/$brandId/approvals"
    | "/portal/brands/$brandId/calendar";
  exact?: boolean;
};

const brandLinks: BrandLink[] = [
  { title: "Painel", icon: LayoutDashboard, to: "/portal/brands/$brandId", exact: true },
  { title: "Aprovações", icon: ClipboardCheck, to: "/portal/brands/$brandId/approvals" },
  { title: "Calendário", icon: CalendarDays, to: "/portal/brands/$brandId/calendar" },
];

const hrefOf = (to: string, brandId: string): string => to.replace("$brandId", brandId);

function UnreadBadge({ userId }: { userId: string }) {
  const unread = useUnreadCount(userId);
  if (unread === 0) return null;
  return (
    <SidebarMenuBadge className="rounded-full bg-violet text-primary-foreground peer-hover/menu-button:!text-primary-foreground peer-data-[active=true]/menu-button:!text-primary-foreground">
      {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
    </SidebarMenuBadge>
  );
}

function useActiveBrandId(): string | null {
  const { brandId } = useParams({ strict: false });
  const brands = useQuery({
    queryKey: QueryKey.Portal.brands(),
    queryFn: async () => unwrapResult(await listPortalBrands()).brands,
    staleTime: BRANDS_STALE_MS,
  });
  return brandId ?? brands.data?.[0]?.id ?? null;
}

export function PortalSidebar({ auth }: { auth: AuthState }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  const avatars = useAvatarUrls([auth.profile?.id]);
  const brandId = useActiveBrandId();

  return (
    <Sidebar>
      <SidebarHeader className="gap-1">
        <p className="heading-card px-2 pt-1 text-sidebar-foreground">Portal do Cliente</p>
        <PortalBrandSwitcher />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {brandId ? (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>Marca</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {brandLinks.map((item) => {
                  const href = hrefOf(item.to, brandId);
                  const active =
                    item.exact === true ? pathname === href : pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={item.to} params={{ brandId }}>
                          <item.icon aria-hidden="true" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel>Conta</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/portal/notifications")}
                  className="pr-8"
                >
                  <Link to="/portal/notifications">
                    <Bell aria-hidden="true" />
                    <span>Avisos</span>
                  </Link>
                </SidebarMenuButton>
                {auth.user ? <UnreadBadge userId={auth.user.id} /> : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/portal/profile")}>
                  <Link to="/portal/profile">
                    <UserRound aria-hidden="true" />
                    <span>Meu perfil</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2">
          <PersonAvatar
            name={auth.profile?.name ?? ""}
            url={avatars[auth.profile?.id ?? ""]}
            size="sm"
          />
          <p className="truncate text-xs text-sidebar-foreground">{auth.profile?.name}</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut aria-hidden="true" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

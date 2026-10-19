import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { type AdminSpace, adminSpaces, visibleGroups } from "@/components/shared/admin/nav-config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/shared/ui/sidebar";
import type { AuthState } from "@/lib/shared/auth/types";
import { useSignOut } from "@/lib/shared/auth/use-sign-out";

export function AppSidebar({ auth, space }: { auth: AuthState; space: AdminSpace }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  const groups = visibleGroups(auth, space);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0.5">
        <p className="heading-card px-2 pt-1 text-sidebar-foreground">Compasso</p>
        <p className="truncate px-2 text-xs text-sidebar-foreground">
          {adminSpaces.find((entry) => entry.key === space)?.title}
        </p>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label ?? group.items[0]?.to}>
            {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    item.exact === true ? pathname === item.to : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.to}>
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
        ))}
      </SidebarContent>
      <SidebarFooter>
        <p className="truncate px-2 text-xs text-sidebar-foreground">{auth.profile?.name}</p>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair">
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

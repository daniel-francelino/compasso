import { LayoutDashboard, Palette, type LucideIcon } from "lucide-react";
import type { ActionKey } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import type { AuthState } from "@/lib/shared/auth/types";
import { Space } from "@/lib/shared/enums";
import { AppRoute } from "@/lib/shared/routes";
import type { FileRoutesByTo } from "@/routeTree.gen";

export type AdminSpace = typeof Space.Marketing | typeof Space.Cms;

export type NavItem = {
  title: string;
  icon: LucideIcon;
  to: keyof FileRoutesByTo;
  action?: ActionKey;
  exact?: boolean;
  developmentOnly?: boolean;
};

export type NavGroup = {
  space: AdminSpace | typeof Space.Shared;
  label?: string;
  items: NavItem[];
};

export const adminSpaces: { key: AdminSpace; title: string }[] = [
  { key: Space.Marketing, title: "Gestão de Marketing" },
  { key: Space.Cms, title: "Site e CMS" },
];

export const navGroups: NavGroup[] = [
  {
    space: Space.Shared,
    items: [{ title: "Início", icon: LayoutDashboard, to: AppRoute.Admin, exact: true }],
  },
  {
    space: Space.Shared,
    label: "Desenvolvimento",
    items: [{ title: "Design system", icon: Palette, to: AppRoute.Design, developmentOnly: true }],
  },
];

const isVisible = (item: NavItem, auth: AuthState): boolean => {
  if (item.developmentOnly === true && !import.meta.env.DEV) return false;
  return item.action === undefined || can(auth, item.action);
};

export const visibleGroups = (auth: AuthState, space: AdminSpace): NavGroup[] =>
  navGroups
    .filter((group) => group.space === space || group.space === Space.Shared)
    .map((group) => ({ ...group, items: group.items.filter((item) => isVisible(item, auth)) }))
    .filter((group) => group.items.length > 0);

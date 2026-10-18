import {
  Bell,
  BellRing,
  Building2,
  Building,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Images,
  LayoutDashboard,
  Palette,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Action, type ActionKey } from "@/lib/shared/auth/actions";
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
    items: [
      { title: "Início", icon: LayoutDashboard, to: AppRoute.Admin, exact: true },
      {
        title: "Biblioteca de Mídia",
        icon: Images,
        to: AppRoute.Library,
        action: Action.Media.View,
      },
    ],
  },
  {
    space: Space.Marketing,
    label: "Clientes e marcas",
    items: [
      { title: "Clientes", icon: Building2, to: AppRoute.Clients, action: Action.Clients.View },
      { title: "Marcas", icon: Tag, to: AppRoute.Brands, action: Action.Brands.View },
    ],
  },
  {
    space: Space.Marketing,
    label: "Produção",
    items: [
      { title: "Conteúdos", icon: FileText, to: AppRoute.Content, action: Action.Content.View },
      {
        title: "Calendário",
        icon: CalendarDays,
        to: AppRoute.Calendar,
        action: Action.Calendar.View,
      },
      {
        title: "Aprovações",
        icon: ClipboardCheck,
        to: AppRoute.Approvals,
        action: Action.Approvals.View,
      },
    ],
  },
  {
    space: Space.Shared,
    label: "Configurações",
    items: [
      { title: "Pessoas", icon: Users, to: AppRoute.Users, action: Action.Users.View },
      { title: "Perfis", icon: ShieldCheck, to: AppRoute.Roles, action: Action.Roles.Manage },
      {
        title: "Organização",
        icon: Building,
        to: AppRoute.Organization,
        action: Action.Settings.Manage,
      },
      {
        title: "Políticas",
        icon: SlidersHorizontal,
        to: AppRoute.Policies,
        action: Action.Settings.Manage,
      },
      {
        title: "Avisos padrão",
        icon: BellRing,
        to: AppRoute.NotificationDefaults,
        action: Action.Notifications.Configure,
      },
      { title: "Auditoria", icon: ScrollText, to: AppRoute.Audit, action: Action.Audit.View },
    ],
  },
  {
    space: Space.Shared,
    label: "Minha conta",
    items: [
      { title: "Avisos", icon: Bell, to: AppRoute.Notifications },
      { title: "Meu perfil", icon: UserRound, to: AppRoute.Profile },
    ],
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

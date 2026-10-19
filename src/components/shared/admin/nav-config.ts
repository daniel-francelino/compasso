import {
  ArrowRightLeft,
  BellRing,
  Building2,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Globe,
  History,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  ListTree,
  Mail,
  Palette,
  Quote,
  Search,
  ScrollText,
  ShieldCheck,
  Settings2,
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

export type SpaceEntry = {
  key: AdminSpace;
  title: string;
  icon: LucideIcon;
  to: keyof FileRoutesByTo;
};

export const adminSpaces: SpaceEntry[] = [
  {
    key: Space.Marketing,
    title: "Gestão de Marketing",
    icon: LayoutDashboard,
    to: AppRoute.Marketing,
  },
  { key: Space.Cms, title: "Site e CMS", icon: Globe, to: AppRoute.Site },
];

export const spaceOfPath = (pathname: string): AdminSpace | null => {
  if (pathname === AppRoute.Site || pathname.startsWith(`${AppRoute.Site}/`)) return Space.Cms;
  if (pathname === AppRoute.Marketing || pathname.startsWith(`${AppRoute.Marketing}/`))
    return Space.Marketing;
  return null;
};

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
    space: Space.Cms,
    label: "Conteúdo do site",
    items: [
      {
        title: "Visão geral",
        icon: Globe,
        to: AppRoute.Site,
        action: Action.Site.View,
        exact: true,
      },
      { title: "Páginas", icon: LayoutTemplate, to: AppRoute.SitePages, action: Action.Site.View },
      { title: "Serviços", icon: Briefcase, to: AppRoute.SiteServices, action: Action.Site.View },
      {
        title: "Depoimentos",
        icon: Quote,
        to: AppRoute.SiteTestimonials,
        action: Action.Site.View,
      },
      { title: "Portfólio", icon: FileText, to: AppRoute.SitePortfolio, action: Action.Site.View },
      { title: "Mensagens", icon: Mail, to: AppRoute.SiteMessages, action: Action.Site.View },
    ],
  },
  {
    space: Space.Cms,
    label: "Ajustes do site",
    items: [
      {
        title: "Menu e rodapé",
        icon: ListTree,
        to: AppRoute.SiteNavigation,
        action: Action.Site.Settings,
      },
      {
        title: "Configurações",
        icon: Settings2,
        to: AppRoute.SiteSettings,
        action: Action.Site.Settings,
      },
      { title: "SEO", icon: Search, to: AppRoute.SiteSeo, action: Action.Site.Settings },
      {
        title: "Redirecionamentos",
        icon: ArrowRightLeft,
        to: AppRoute.SiteRedirects,
        action: Action.Site.Settings,
      },
      {
        title: "Publicações",
        icon: History,
        to: AppRoute.SitePublications,
        action: Action.Site.Publish,
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
    items: [{ title: "Meu perfil", icon: UserRound, to: AppRoute.Profile }],
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

export const availableSpaces = (auth: AuthState): SpaceEntry[] =>
  adminSpaces.filter((entry) =>
    navGroups.some(
      (group) => group.space === entry.key && group.items.some((item) => isVisible(item, auth)),
    ),
  );

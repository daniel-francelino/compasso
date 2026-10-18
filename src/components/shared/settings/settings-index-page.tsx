import { Link } from "@tanstack/react-router";
import {
  BellRing,
  Building,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Action, type ActionKey } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { AppRoute } from "@/lib/shared/routes";

type Entry = {
  title: string;
  description: string;
  icon: LucideIcon;
  to:
    | "/admin/settings/users"
    | "/admin/settings/roles"
    | "/admin/settings/organization"
    | "/admin/settings/policies"
    | "/admin/settings/audit"
    | "/admin/settings/notifications";
  action: ActionKey;
};

const entries: Entry[] = [
  {
    title: "Pessoas",
    description: "Convites, perfis de cada pessoa e acessos suspensos.",
    icon: Users,
    to: AppRoute.Users,
    action: Action.Users.View,
  },
  {
    title: "Perfis",
    description: "O que cada perfil pode fazer no Compasso.",
    icon: ShieldCheck,
    to: AppRoute.Roles,
    action: Action.Roles.Manage,
  },
  {
    title: "Organização",
    description: "Nome, documento, fuso horário e contato da empresa.",
    icon: Building,
    to: AppRoute.Organization,
    action: Action.Settings.Manage,
  },
  {
    title: "Políticas",
    description: "Prazos, limites de arquivos, retenção e segurança.",
    icon: SlidersHorizontal,
    to: AppRoute.Policies,
    action: Action.Settings.Manage,
  },
  {
    title: "Avisos padrão",
    description: "Como cada tipo de aviso começa para as pessoas.",
    icon: BellRing,
    to: AppRoute.NotificationDefaults,
    action: Action.Notifications.Configure,
  },
  {
    title: "Auditoria",
    description: "O histórico de tudo que mudou.",
    icon: ScrollText,
    to: AppRoute.Audit,
    action: Action.Audit.View,
  },
];

export function SettingsIndexPage() {
  const auth = useAuth();
  const visible = entries.filter((entry) => can(auth, entry.action));

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Ajustes da organização e dos acessos." />
      <ul className="grid gap-4 md:grid-cols-2">
        {visible.map((entry) => (
          <li key={entry.to}>
            <Link
              to={entry.to}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SectionCard as="div" title={entry.title} icon={entry.icon}>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </SectionCard>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

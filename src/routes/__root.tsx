import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LostI18nProvider } from "lost-ui/i18n";
import { UnsavedChangesProvider } from "@/components/shared/admin/unsaved-changes-provider";
import { TooltipProvider } from "@/components/shared/ui/tooltip";
import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: `${pageTitle(matches.at(-1)?.routeId ?? "")} | Aura Creative` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/aura-mark.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500..700&family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

const NEW_SEGMENT = "new";

const newPageTitles: Record<string, string> = {
  content: "Novo conteúdo",
  brands: "Nova marca",
  clients: "Novo cliente",
};

function pageTitle(routeId: string) {
  const segments = routeId
    .split("/")
    .filter((part) => part && part !== "index" && !part.startsWith("$") && !part.startsWith("("));
  const segment = segments.at(-1);
  if (!segment || segment === "__root") return "Início";
  const created = segment === NEW_SEGMENT ? newPageTitles[segments.at(-2) ?? ""] : undefined;
  if (created !== undefined) return created;
  const names: Record<string, string> = {
    brands: "Marcas",
    clients: "Clientes",
    content: "Conteúdos",
    calendar: "Calendário",
    approvals: "Aprovações",
    settings: "Configurações",
    library: "Biblioteca de Mídia",
    profile: "Meu perfil",
    users: "Pessoas",
    roles: "Perfis",
    audit: "Auditoria",
    pages: "Páginas",
    services: "Serviços",
    portfolio: "Portfólio",
    messages: "Mensagens",
    site: "Visão geral",
    notifications: "Avisos",
    login: "Entrar",
    "recover-password": "Recuperar senha",
    "reset-password": "Redefinir senha",
    "confirm-email": "Confirmar e-mail",
    invite: "Convite",
    "access-denied": "Acesso negado",
    forbidden: "Acesso negado",
  };
  return (
    names[segment] ??
    segment.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <UnsavedChangesProvider>
          <LostI18nProvider language="pt-BR">
            <Outlet />
          </LostI18nProvider>
        </UnsavedChangesProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

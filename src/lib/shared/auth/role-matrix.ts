import type { ActionInfo } from "@/lib/shared/auth/roles.functions";
import { Action } from "@/lib/shared/auth/actions";

export type ModuleGroup = { module: string; actions: ActionInfo[] };

export const ROLE_DESCRIPTION_LABELS: Record<string, string> = {
  owner: "Acesso completo a tudo",
  manager: "Gerencia clientes, marcas, conteúdos e calendário",
  collaborator: "Cria e edita conteúdos",
  external_approver: "Aprova conteúdos no portal",
  external_commenter: "Comenta no portal",
  site_editor: "Edita o site sem publicá-lo",
};

export const ACTION_DESCRIPTION_LABELS: Record<string, string> = {
  [Action.Clients.View]: "Visualizar clientes",
  [Action.Clients.Create]: "Cadastrar clientes",
  [Action.Clients.Update]: "Editar clientes",
  [Action.Clients.Delete]: "Excluir clientes",
  [Action.Brands.View]: "Visualizar marcas",
  [Action.Brands.Create]: "Cadastrar marcas",
  [Action.Brands.Update]: "Editar marcas",
  [Action.Brands.Delete]: "Excluir marcas",
  [Action.Brands.ManageMembers]: "Gerenciar membros das marcas",
  [Action.Channels.View]: "Visualizar canais",
  [Action.Channels.Create]: "Cadastrar canais",
  [Action.Channels.Update]: "Editar canais",
  [Action.Channels.Delete]: "Excluir canais",
  [Action.Channels.Connect]: "Conectar canais às plataformas",
  [Action.Metrics.View]: "Visualizar as métricas das redes sociais",
  [Action.Metrics.Report]: "Anotar métricas e publicar relatórios para o cliente",
  [Action.Metrics.PortalView]: "Ver relatórios de resultados no portal",
  [Action.Content.View]: "Visualizar conteúdos",
  [Action.Content.Create]: "Criar conteúdos",
  [Action.Content.Update]: "Editar conteúdos",
  [Action.Content.Delete]: "Excluir conteúdos",
  [Action.Content.Submit]: "Enviar conteúdos para aprovação",
  [Action.Content.Cancel]: "Cancelar conteúdos",
  [Action.Content.Reopen]: "Reabrir conteúdos",
  [Action.Content.PublishManual]: "Marcar conteúdos como publicados manualmente",
  [Action.Approvals.View]: "Visualizar aprovações",
  [Action.Approvals.Decide]: "Aprovar ou solicitar alterações no portal",
  [Action.Comments.CreateInternal]: "Escrever comentários internos",
  [Action.Comments.CreateExternal]: "Escrever comentários no portal",
  [Action.Portal.View]: "Acessar o portal do cliente",
  [Action.Calendar.View]: "Visualizar o calendário",
  [Action.Calendar.Manage]: "Reagendar pelo calendário",
  [Action.Media.View]: "Visualizar a biblioteca de mídia",
  [Action.Media.Upload]: "Enviar arquivos para a biblioteca de mídia",
  [Action.Media.Update]: "Editar arquivos da biblioteca de mídia",
  [Action.Media.Delete]: "Excluir arquivos da biblioteca de mídia",
  [Action.Media.Publish]: "Publicar arquivos no site",
  [Action.Media.Share]: "Compartilhar arquivos e pastas por link",
  [Action.Site.View]: "Visualizar o site e o CMS",
  [Action.Site.Edit]: "Editar páginas do site",
  [Action.Site.Settings]: "Editar configurações do site",
  [Action.Site.Structure]: "Alterar a estrutura do site",
  [Action.Site.Publish]: "Publicar o site",
  [Action.Notifications.Configure]: "Configurar avisos padrão",
  [Action.Audit.View]: "Visualizar e exportar o histórico de auditoria",
  [Action.Invitations.Create]: "Convidar pessoas",
  [Action.Users.View]: "Visualizar pessoas",
  [Action.Users.Approve]: "Aprovar acessos",
  [Action.Users.Manage]: "Gerenciar pessoas",
  [Action.Roles.Manage]: "Gerenciar perfis",
  [Action.Settings.Manage]: "Gerenciar configurações da organização",
};

export const MODULE_LABELS: Record<string, string> = {
  clients: "Clientes",
  brands: "Marcas",
  channels: "Canais",
  metrics: "Métricas",
  content: "Conteúdos",
  approvals: "Aprovações",
  comments: "Comentários",
  portal: "Portal do cliente",
  calendar: "Calendário",
  media: "Biblioteca de mídia",
  site: "Site e CMS",
  notifications: "Avisos",
  audit: "Auditoria",
  invitations: "Convites",
  users: "Pessoas",
  roles: "Perfis",
  settings: "Configurações",
};

export const visibleActions = (catalog: ActionInfo[], portalOnly: boolean): ActionInfo[] =>
  catalog.filter((action) => !action.adminOnly && (!portalOnly || action.portal));

export const groupByModule = (actions: ActionInfo[]): ModuleGroup[] => {
  const groups = new Map<string, ActionInfo[]>();
  for (const action of actions) {
    groups.set(action.module, [...(groups.get(action.module) ?? []), action]);
  }
  return [...groups.entries()].map(([module, items]) => ({ module, actions: items }));
};

export const withDependencies = (
  selected: ReadonlySet<string>,
  catalog: ActionInfo[],
  keys: string[],
): Set<string> => {
  const result = new Set(selected);
  const byKey = new Map(catalog.map((action) => [action.key, action]));
  const pending = [...keys];
  while (pending.length > 0) {
    const key = pending.pop();
    if (key === undefined || (result.has(key) && !keys.includes(key))) continue;
    result.add(key);
    for (const required of byKey.get(key)?.requires ?? []) {
      if (!result.has(required)) pending.push(required);
    }
  }
  return result;
};

export const withoutDependents = (
  selected: ReadonlySet<string>,
  catalog: ActionInfo[],
  keys: string[],
): Set<string> => {
  const result = new Set(selected);
  for (const key of keys) result.delete(key);
  let changed = true;
  while (changed) {
    changed = false;
    for (const action of catalog) {
      if (result.has(action.key) && action.requires.some((required) => !result.has(required))) {
        result.delete(action.key);
        changed = true;
      }
    }
  }
  return result;
};

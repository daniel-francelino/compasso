import type { ActionInfo } from "@/lib/shared/auth/roles.functions";

export type ModuleGroup = { module: string; actions: ActionInfo[] };

export const MODULE_LABELS: Record<string, string> = {
  clients: "Clientes",
  brands: "Marcas",
  channels: "Canais",
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

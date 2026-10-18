import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { roleIdSchema, saveRoleSchema } from "@/lib/shared/auth/schemas";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { type Result, denied, fail, parseOutput } from "@/lib/shared/server-utils";

export type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  portalOnly: boolean;
  actions: string[];
  userCount: number;
};

export type ActionInfo = {
  key: string;
  module: string;
  description: string;
  adminOnly: boolean;
  portal: boolean;
  requires: string[];
};

const savedSchema = z.object({ id: z.string().uuid() });

export const listRoles = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ roles: RoleRow[]; catalog: ActionInfo[] }>> => {
    const caller = await requireActionServer(Action.Roles.Manage);
    if (caller === null) return denied;

    const [roles, actions, profiles] = await Promise.all([
      caller.supabase
        .from("roles")
        .select("id, key, name, description, is_system, portal_only, role_actions(action_key)")
        .order("is_system", { ascending: false })
        .order("name"),
      caller.supabase
        .from("actions")
        .select("key, module, description, admin_only, portal, requires")
        .order("module")
        .order("key"),
      caller.supabase.from("profiles").select("role_id"),
    ]);
    if (roles.error) return fail(roles.error);
    if (actions.error) return fail(actions.error);
    if (profiles.error) return fail(profiles.error);

    const counts = new Map<string, number>();
    for (const profile of profiles.data) {
      if (profile.role_id !== null)
        counts.set(profile.role_id, (counts.get(profile.role_id) ?? 0) + 1);
    }
    return {
      ok: true,
      roles: roles.data.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.is_system,
        portalOnly: role.portal_only,
        actions: role.role_actions.map((row) => row.action_key),
        userCount: counts.get(role.id) ?? 0,
      })),
      catalog: actions.data.map((action) => ({
        key: action.key,
        module: action.module,
        description: action.description,
        adminOnly: action.admin_only,
        portal: action.portal,
        requires: action.requires,
      })),
    };
  },
);

export const listAssignableRoles = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ roles: { id: string; name: string; portalOnly: boolean }[] }>> => {
    const caller = await requireActionServer(Action.Invitations.Create);
    if (caller === null) return denied;
    const isOwner = await caller.supabase.rpc("is_admin");
    const { data, error } = await caller.supabase
      .from("roles")
      .select("id, name, is_system, portal_only, role_actions(actions(admin_only))")
      .order("name");
    if (error) return fail(error);
    const assignable = data.filter(
      (role) =>
        isOwner.data === true ||
        (!role.is_system && !role.role_actions.some((row) => row.actions?.admin_only === true)),
    );
    return {
      ok: true,
      roles: assignable.map((role) => ({
        id: role.id,
        name: role.name,
        portalOnly: role.portal_only,
      })),
    };
  },
);

export const saveRole = createServerFn({ method: "POST" })
  .validator(saveRoleSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Roles.Manage);
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase.rpc("role_save", {
      p_role: {
        ...(data.id === undefined ? {} : { id: data.id }),
        name: data.name,
        description: data.description ?? null,
        portal_only: data.portalOnly,
        actions: data.actions,
      },
    });
    if (error) return fail(error);
    return parseOutput(savedSchema, row);
  });

export const deleteRole = createServerFn({ method: "POST" })
  .validator(roleIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Roles.Manage);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("role_delete", { p_role: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

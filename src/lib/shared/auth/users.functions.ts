import { createServerFn } from "@tanstack/react-start";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { setAccessSchema } from "@/lib/shared/auth/schemas";
import { InvitationStatus, ProfileStatus } from "@/lib/shared/enums";
import { PAGE_SIZE, listRequestSchema } from "@/lib/shared/list-search";
import {
  type Page,
  type Result,
  cleanSearch,
  denied,
  fail,
  pageOf,
  rangeOf,
} from "@/lib/shared/server-utils";

export const UsersTab = { Active: "active", Inactive: "inactive" } as const;

export type UserRow = {
  id: string;
  fullName: string;
  email: string;
  status: ProfileStatus;
  kind: string;
  roleName: string | null;
  createdAt: string;
};

export type InvitationRow = {
  id: string;
  email: string;
  roleName: string | null;
  status: InvitationStatus;
  expiresAt: string;
  invitedByName: string | null;
  createdAt: string;
};

export const listUsers = createServerFn({ method: "GET" })
  .validator(listRequestSchema)
  .handler(async ({ data }): Promise<Result<Page<UserRow>>> => {
    const caller = await requireActionServer(Action.Users.View);
    if (caller === null) return denied;

    const search = cleanSearch(data.search);
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    let query = caller.supabase
      .from("profiles")
      .select("id, full_name, email, status, kind, created_at, roles(name)", { count: "exact" });
    query =
      data.status === UsersTab.Inactive
        ? query.in("status", [
            ProfileStatus.Pending,
            ProfileStatus.Rejected,
            ProfileStatus.Suspended,
          ])
        : query.eq("status", ProfileStatus.Approved);
    if (search !== "") query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const {
      data: rows,
      count,
      error,
    } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) return fail(error);

    const mapped = (rows ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      status: row.status as ProfileStatus,
      kind: row.kind,
      roleName: row.roles?.name ?? null,
      createdAt: row.created_at,
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const listInvitations = createServerFn({ method: "GET" })
  .validator(listRequestSchema)
  .handler(async ({ data }): Promise<Result<Page<InvitationRow>>> => {
    const caller = await requireActionServer(Action.Users.View);
    if (caller === null) return denied;

    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    const {
      data: rows,
      count,
      error,
    } = await caller.supabase
      .from("invitations")
      .select(
        "id, email, status, expires_at, created_at, roles(name), inviter:profiles!invitations_invited_by_fkey(full_name)",
        { count: "exact" },
      )
      .neq("status", InvitationStatus.Accepted)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) return fail(error);

    const now = Date.now();
    const mapped = (rows ?? []).map((row) => {
      const expired =
        row.status === InvitationStatus.Pending && new Date(row.expires_at).getTime() <= now;
      return {
        id: row.id,
        email: row.email,
        roleName: row.roles?.name ?? null,
        status: expired ? InvitationStatus.Expired : (row.status as InvitationStatus),
        expiresAt: row.expires_at,
        invitedByName: row.inviter?.full_name ?? null,
        createdAt: row.created_at,
      };
    });
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const setUserAccess = createServerFn({ method: "POST" })
  .validator(setAccessSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Users.View);
    if (caller === null) return denied;

    const { error } = await caller.supabase.rpc("profile_set_access", {
      p_profile: data.profileId,
      p_status: data.status,
      ...(data.roleId === undefined ? {} : { p_role: data.roleId }),
    });
    if (error) return fail(error);
    return { ok: true };
  });

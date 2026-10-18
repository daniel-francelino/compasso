import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { type Caller, requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { PAGE_SIZE } from "@/lib/shared/list-search";
import {
  type Page,
  type Result,
  cleanSearch,
  denied,
  fail,
  pageOf,
  parseOutput,
  rangeOf,
} from "@/lib/shared/server-utils";
import {
  ClientStatusFilter,
  archiveClientSchema,
  clientIdSchema,
  contactIdSchema,
  listClientsSchema,
  saveClientSchema,
  saveContactSchema,
  similarClientsSchema,
} from "@/lib/marketing/clients/schemas";

export type ClientRow = {
  id: string;
  name: string;
  ownerName: string | null;
  brandCount: number;
  contactCount: number;
  archived: boolean;
  updatedAt: string;
};

export type PortalAccess = { state: "none" | "pending" | "active"; brands: number };

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  isPrimary: boolean;
  portalAccess: PortalAccess | null;
};

export type ClientDetail = {
  id: string;
  name: string;
  ownerUserId: string | null;
  ownerName: string | null;
  internalNotes: string | null;
  tags: string[];
  version: number;
  archived: boolean;
  createdAt: string;
  contacts: ContactRow[];
  brands: { id: string; name: string; archived: boolean }[];
};

const savedClientSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int(),
  brand_id: z.string().uuid().nullable(),
});
const idSchema = z.object({ id: z.string().uuid() });
const versionSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

type Supabase = Caller["supabase"];

const portalAccessByEmail = async (
  supabase: Supabase,
  emails: string[],
): Promise<Map<string, PortalAccess>> => {
  const result = new Map<string, PortalAccess>();
  if (emails.length === 0) return result;

  const [pending, profiles] = await Promise.all([
    supabase.from("invitations").select("email").eq("status", "pending").in("email", emails),
    supabase.from("profiles").select("id, email").in("email", emails),
  ]);
  for (const row of pending.data ?? []) {
    result.set(row.email.toLowerCase(), { state: "pending", brands: 0 });
  }
  const ids = (profiles.data ?? []).map((profile) => profile.id);
  const members =
    ids.length === 0
      ? { data: [] }
      : await supabase
          .from("brand_members")
          .select("user_id")
          .eq("status", "active")
          .in("user_id", ids);
  for (const profile of profiles.data ?? []) {
    const brands = (members.data ?? []).filter((member) => member.user_id === profile.id).length;
    result.set(profile.email.toLowerCase(), { state: brands > 0 ? "active" : "none", brands });
  }
  return result;
};

export const listClients = createServerFn({ method: "GET" })
  .validator(listClientsSchema)
  .handler(async ({ data }): Promise<Result<Page<ClientRow>>> => {
    const caller = await requireActionServer(Action.Clients.View);
    if (caller === null) return denied;

    const search = cleanSearch(data.search);
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    let query = caller.supabase
      .from("clients")
      .select(
        "id, name, archived_at, updated_at, owner:profiles!clients_owner_user_id_fkey(full_name), brands(count), client_contacts(count)",
        { count: "exact" },
      );
    query =
      data.status === ClientStatusFilter.Archived
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);
    if (search !== "") query = query.ilike("name", `%${search}%`);
    if (data.ownerId !== undefined) query = query.eq("owner_user_id", data.ownerId);
    if (data.tag !== undefined && data.tag !== "") query = query.contains("tags", [data.tag]);

    const {
      data: rows,
      count,
      error,
    } = await query.order("name", { ascending: data.dir !== "desc" }).range(from, to);
    if (error) return fail(error);

    const mapped = (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      ownerName: row.owner?.full_name ?? null,
      brandCount: row.brands[0]?.count ?? 0,
      contactCount: row.client_contacts[0]?.count ?? 0,
      archived: row.archived_at !== null,
      updatedAt: row.updated_at,
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const getClient = createServerFn({ method: "GET" })
  .validator(clientIdSchema)
  .handler(async ({ data }): Promise<Result<{ client: ClientDetail }>> => {
    const caller = await requireActionServer(Action.Clients.View);
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase
      .from("clients")
      .select(
        "id, name, owner_user_id, internal_notes, tags, version, archived_at, created_at, owner:profiles!clients_owner_user_id_fkey(full_name), client_contacts(id, name, email, phone, role_title, is_primary), brands(id, name, archived_at)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });

    const access = await portalAccessByEmail(
      caller.supabase,
      row.client_contacts.flatMap((contact) =>
        contact.email ? [contact.email.toLowerCase()] : [],
      ),
    );
    return {
      ok: true,
      client: {
        id: row.id,
        name: row.name,
        ownerUserId: row.owner_user_id,
        ownerName: row.owner?.full_name ?? null,
        internalNotes: row.internal_notes,
        tags: row.tags,
        version: row.version,
        archived: row.archived_at !== null,
        createdAt: row.created_at,
        contacts: row.client_contacts
          .map((contact) => ({
            id: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            roleTitle: contact.role_title,
            isPrimary: contact.is_primary,
            portalAccess: access.get((contact.email ?? "").toLowerCase()) ?? null,
          }))
          .sort(
            (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name),
          ),
        brands: row.brands
          .map((brand) => ({
            id: brand.id,
            name: brand.name,
            archived: brand.archived_at !== null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    };
  });

export const findSimilarClients = createServerFn({ method: "GET" })
  .validator(similarClientsSchema)
  .handler(async ({ data }): Promise<Result<{ matches: { id: string; name: string }[] }>> => {
    const caller = await requireActionServer(Action.Clients.View);
    if (caller === null) return denied;

    const term = cleanSearch(data.name);
    let query = caller.supabase
      .from("clients")
      .select("id, name")
      .ilike("name", `%${term}%`)
      .limit(5);
    if (data.excludeId !== undefined) query = query.neq("id", data.excludeId);
    const { data: rows, error } = await query;
    if (error) return fail(error);
    return { ok: true, matches: rows ?? [] };
  });

export const saveClient = createServerFn({ method: "POST" })
  .validator(saveClientSchema)
  .handler(
    async ({ data }): Promise<Result<{ id: string; version: number; brandId: string | null }>> => {
      const caller = await requireActionServer(
        data.id === undefined ? Action.Clients.Create : Action.Clients.Update,
      );
      if (caller === null) return denied;

      const { data: row, error } = await caller.supabase.rpc("client_save", {
        p_client: {
          ...(data.id === undefined ? {} : { id: data.id }),
          name: data.name,
          owner_user_id: data.ownerUserId ?? null,
          internal_notes: data.internalNotes ?? null,
          tags: data.tags,
          ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
        },
        p_create_brand: data.createFirstBrand,
      });
      if (error) return fail(error);
      const saved = parseOutput(savedClientSchema, row);
      return saved.ok
        ? { ok: true, id: saved.id, version: saved.version, brandId: saved.brand_id }
        : saved;
    },
  );

export const setClientArchived = createServerFn({ method: "POST" })
  .validator(archiveClientSchema)
  .handler(async ({ data }): Promise<Result<{ version: number }>> => {
    const caller = await requireActionServer(Action.Clients.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("client_set_archived", {
      p_client: data.id,
      p_archived: data.archived,
      p_archive_brands: data.archiveBrands,
    });
    if (error) return fail(error);
    const parsed = parseOutput(versionSchema, row);
    return parsed.ok ? { ok: true, version: parsed.version } : parsed;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .validator(clientIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Clients.Delete);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("client_delete", { p_client: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const saveClientContact = createServerFn({ method: "POST" })
  .validator(saveContactSchema)
  .handler(async ({ data }): Promise<Result<{ id: string }>> => {
    const caller = await requireActionServer(Action.Clients.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("client_contact_save", {
      p_contact: {
        ...(data.id === undefined ? {} : { id: data.id }),
        client_id: data.clientId,
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        role_title: data.roleTitle ?? null,
        is_primary: data.isPrimary,
      },
    });
    if (error) return fail(error);
    return parseOutput(idSchema, row);
  });

export const deleteClientContact = createServerFn({ method: "POST" })
  .validator(contactIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Clients.Update);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("client_contact_delete", { p_contact: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const listOwnerOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ people: { id: string; name: string }[] }>> => {
    const caller = await requireActionServer(Action.Clients.View);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("profiles")
      .select("id, full_name")
      .eq("status", "approved")
      .eq("kind", "internal")
      .order("full_name")
      .limit(200);
    if (error) return fail(error);
    return { ok: true, people: data.map((row) => ({ id: row.id, name: row.full_name })) };
  },
);

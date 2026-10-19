import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { BrandMemberStatus, type ProfileKind } from "@/lib/shared/enums";
import { brandLogoUrls } from "@/lib/shared/brands/brand-logos.server";
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
  BrandStatusFilter,
  archiveBrandSchema,
  brandIdSchema,
  listBrandsSchema,
  memberCandidatesSchema,
  saveBrandSchema,
  setBrandLogoSchema,
  setMemberSchema,
  visualIdentitySchema,
  type VisualIdentity,
} from "@/lib/marketing/brands/schemas";

export type BrandRow = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  channelCount: number;
  timezone: string;
  archived: boolean;
  logoUrl: string | null;
};

export type BrandDetail = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  description: string | null;
  targetAudience: string | null;
  toneOfVoice: string | null;
  objectives: string | null;
  referencesNotes: string | null;
  visualIdentity: VisualIdentity;
  logoVersionId: string | null;
  logoUrl: string | null;
  timezone: string;
  version: number;
  archived: boolean;
  channelCount: number;
  memberCount: number;
};

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  kind: ProfileKind;
  canDecide: boolean;
  status: BrandMemberStatus;
  grantedAt: string;
};

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

export const listBrands = createServerFn({ method: "GET" })
  .validator(listBrandsSchema)
  .handler(async ({ data }): Promise<Result<Page<BrandRow>>> => {
    const caller = await requireActionServer(Action.Brands.View);
    if (caller === null) return denied;

    const search = cleanSearch(data.search);
    const [from, to] = rangeOf(data.page, PAGE_SIZE);
    let query = caller.supabase
      .from("brands")
      .select("id, name, client_id, timezone, archived_at, clients(name), channels(count)", {
        count: "exact",
      });
    query =
      data.status === BrandStatusFilter.Archived
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);
    if (data.clientId !== undefined) query = query.eq("client_id", data.clientId);
    const withPlatform =
      data.platform === undefined
        ? null
        : await caller.supabase
            .from("channels")
            .select("brand_id")
            .eq("platform", data.platform)
            .is("archived_at", null);
    if (withPlatform?.error) return fail(withPlatform.error);
    if (withPlatform)
      query = query.in("id", [...new Set(withPlatform.data.map((row) => row.brand_id))]);
    if (search !== "") query = query.ilike("name", `%${search}%`);

    const { data: rows, count, error } = await query.order("name").range(from, to);
    if (error) return fail(error);

    const logos = await brandLogoUrls(
      caller.supabase,
      (rows ?? []).map((row) => row.id),
    );
    const mapped = (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      clientId: row.client_id,
      clientName: row.clients?.name ?? "",
      channelCount: row.channels[0]?.count ?? 0,
      timezone: row.timezone,
      archived: row.archived_at !== null,
      logoUrl: logos.get(row.id) ?? null,
    }));
    return { ok: true, ...pageOf(mapped, count ?? 0, { page: data.page, pageSize: PAGE_SIZE }) };
  });

export const getBrand = createServerFn({ method: "GET" })
  .validator(brandIdSchema)
  .handler(async ({ data }): Promise<Result<{ brand: BrandDetail }>> => {
    const caller = await requireActionServer(Action.Brands.View);
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase
      .from("brands")
      .select("*, clients(name), channels(count), brand_members(count)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });

    const identity = visualIdentitySchema.safeParse(row.visual_identity);
    const logos = await brandLogoUrls(caller.supabase, [row.id]);
    return {
      ok: true,
      brand: {
        id: row.id,
        name: row.name,
        clientId: row.client_id,
        clientName: row.clients?.name ?? "",
        description: row.description,
        targetAudience: row.target_audience,
        toneOfVoice: row.tone_of_voice,
        objectives: row.objectives,
        referencesNotes: row.references_notes,
        visualIdentity: identity.success
          ? identity.data
          : { colors: [], fonts: [], guidelinesUrl: "" },
        logoVersionId: row.logo_media_version_id,
        logoUrl: logos.get(row.id) ?? null,
        timezone: row.timezone,
        version: row.version,
        archived: row.archived_at !== null,
        channelCount: row.channels[0]?.count ?? 0,
        memberCount: row.brand_members[0]?.count ?? 0,
      },
    };
  });

export const setBrandLogo = createServerFn({ method: "POST" })
  .validator(setBrandLogoSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(Action.Brands.Update);
    if (caller === null) return denied;
    const { data: row, error } = await caller.supabase.rpc("brand_set_logo", {
      p_brand: data.brandId,
      p_version: data.versionId,
    });
    if (error) return fail(error);
    return parseOutput(savedSchema, row);
  });

export const saveBrand = createServerFn({ method: "POST" })
  .validator(saveBrandSchema)
  .handler(async ({ data }): Promise<Result<{ id: string; version: number }>> => {
    const caller = await requireActionServer(
      data.id === undefined ? Action.Brands.Create : Action.Brands.Update,
    );
    if (caller === null) return denied;

    const { data: row, error } = await caller.supabase.rpc("brand_save", {
      p_brand: {
        ...(data.id === undefined ? {} : { id: data.id }),
        client_id: data.clientId,
        name: data.name,
        description: data.description ?? null,
        target_audience: data.targetAudience ?? null,
        tone_of_voice: data.toneOfVoice ?? null,
        objectives: data.objectives ?? null,
        references_notes: data.referencesNotes ?? null,
        visual_identity: data.visualIdentity ?? {},
        timezone: data.timezone,
        ...(data.expectedVersion === undefined ? {} : { expected_version: data.expectedVersion }),
      },
    });
    if (error) return fail(error);
    const saved = parseOutput(savedSchema, row);
    return saved.ok ? { ok: true, id: saved.id, version: saved.version } : saved;
  });

export const setBrandArchived = createServerFn({ method: "POST" })
  .validator(archiveBrandSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Brands.Update);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("brand_set_archived", {
      p_brand: data.id,
      p_archived: data.archived,
    });
    if (error) return fail(error);
    return { ok: true };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .validator(brandIdSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Brands.Delete);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("brand_delete", { p_brand: data.id });
    if (error) return fail(error);
    return { ok: true };
  });

export const listBrandMembers = createServerFn({ method: "GET" })
  .validator(brandIdSchema)
  .handler(async ({ data }): Promise<Result<{ members: MemberRow[] }>> => {
    const caller = await requireActionServer(Action.Brands.View);
    if (caller === null) return denied;

    const { data: rows, error } = await caller.supabase
      .from("brand_members")
      .select(
        "user_id, kind, can_decide, status, granted_at, profiles!brand_members_user_id_fkey(full_name, email)",
      )
      .eq("brand_id", data.id)
      .order("granted_at");
    if (error) return fail(error);

    return {
      ok: true,
      members: rows.map((row) => ({
        userId: row.user_id,
        name: row.profiles?.full_name ?? "",
        email: row.profiles?.email ?? "",
        kind: row.kind as ProfileKind,
        canDecide: row.can_decide,
        status: row.status as BrandMemberStatus,
        grantedAt: row.granted_at,
      })),
    };
  });

export const listMemberCandidates = createServerFn({ method: "GET" })
  .validator(memberCandidatesSchema)
  .handler(
    async ({
      data,
    }): Promise<
      Result<{ people: { id: string; name: string; email: string; kind: ProfileKind }[] }>
    > => {
      const caller = await requireActionServer(Action.Brands.ManageMembers);
      if (caller === null) return denied;

      const search = cleanSearch(data.search);
      let query = caller.supabase
        .from("profiles")
        .select("id, full_name, email, kind")
        .eq("status", "approved")
        .limit(20);
      if (search !== "") query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data: people, error } = await query.order("full_name");
      if (error) return fail(error);

      const { data: current } = await caller.supabase
        .from("brand_members")
        .select("user_id")
        .eq("brand_id", data.brandId)
        .eq("status", BrandMemberStatus.Active);
      const linked = new Set((current ?? []).map((row) => row.user_id));
      return {
        ok: true,
        people: people
          .filter((person) => !linked.has(person.id))
          .map((person) => ({
            id: person.id,
            name: person.full_name,
            email: person.email,
            kind: person.kind as ProfileKind,
          })),
      };
    },
  );

export const setBrandMember = createServerFn({ method: "POST" })
  .validator(setMemberSchema)
  .handler(async ({ data }): Promise<Result> => {
    const caller = await requireActionServer(Action.Brands.ManageMembers);
    if (caller === null) return denied;
    const { error } = await caller.supabase.rpc("brand_member_set", {
      p_brand: data.brandId,
      p_user: data.userId,
      p_kind: data.kind,
      p_can_decide: data.canDecide,
      p_status: data.status,
    });
    if (error) return fail(error);
    return { ok: true };
  });

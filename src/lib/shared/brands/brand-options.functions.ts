import { createServerFn } from "@tanstack/react-start";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { brandLogoUrls } from "@/lib/shared/brands/brand-logos.server";
import { type Result, denied, fail } from "@/lib/shared/server-utils";

export type BrandOption = { id: string; name: string; clientName: string; logoUrl: string | null };

export const listBrandOptions = createServerFn({ method: "GET" }).handler(
  async (): Promise<Result<{ brands: BrandOption[] }>> => {
    const caller = await requireActionServer(Action.Brands.View);
    if (caller === null) return denied;
    const { data, error } = await caller.supabase
      .from("brands")
      .select("id, name, clients(name)")
      .is("archived_at", null)
      .order("name")
      .limit(200);
    if (error) return fail(error);
    const logos = await brandLogoUrls(
      caller.supabase,
      data.map((row) => row.id),
    );
    return {
      ok: true,
      brands: data.map((row) => ({
        id: row.id,
        name: row.name,
        clientName: row.clients?.name ?? "",
        logoUrl: logos.get(row.id) ?? null,
      })),
    };
  },
);

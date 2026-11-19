import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Action } from "@/lib/shared/auth/actions";
import { requireActionServer } from "@/lib/shared/auth/server-guards.server";
import { appendBrandColors } from "@/lib/shared/design/brand-colors-merge";
import { toJson } from "@/lib/shared/content/published";
import { sanitizeColorName } from "@/lib/shared/design/import/sanitize";
import { visualIdentitySchema } from "@/lib/shared/brands/visual-identity";
import { type Result, denied, fail, invalid, parseOutput } from "@/lib/shared/server-utils";

export const BRAND_COLOR_LIMIT = 12;
const FALLBACK_NAME = "Cor";

export const addDesignBrandColorsSchema = z.object({
  designId: z.string().uuid(),
  colors: z
    .array(
      z.object({
        name: z.string().min(1).max(400),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .min(1)
    .max(BRAND_COLOR_LIMIT),
});

const savedSchema = z.object({ id: z.string().uuid(), version: z.number().int() });

const BRAND_FIELDS =
  "id, client_id, name, description, target_audience, tone_of_voice, objectives, references_notes, visual_identity, timezone, version";

export const addDesignBrandColors = createServerFn({ method: "POST" })
  .validator(addDesignBrandColorsSchema)
  .handler(async ({ data }): Promise<Result<{ added: number }>> => {
    const editor = await requireActionServer(Action.Design.Update);
    if (editor === null) return denied;
    const caller = await requireActionServer(Action.Brands.Update);
    if (caller === null) return denied;
    const { data: design, error: designError } = await caller.supabase
      .from("designs")
      .select("brand_id")
      .eq("id", data.designId)
      .is("trashed_at", null)
      .maybeSingle();
    if (designError) return fail(designError);
    if (design === null) return fail({ message: "not_found" });
    const { data: row, error } = await caller.supabase
      .from("brands")
      .select(BRAND_FIELDS)
      .eq("id", design.brand_id)
      .maybeSingle();
    if (error) return fail(error);
    if (row === null) return fail({ message: "not_found" });
    const identity = visualIdentitySchema.safeParse(row.visual_identity);
    if (!identity.success) return invalid("invalid_input");
    const known = new Set(identity.data.colors.map((color) => color.hex.toLowerCase()));
    const fresh = data.colors.filter((color, index, all) => {
      const hex = color.hex.toLowerCase();
      return !known.has(hex) && all.findIndex((other) => other.hex.toLowerCase() === hex) === index;
    });
    const room = Math.max(0, BRAND_COLOR_LIMIT - identity.data.colors.length);
    const added = fresh.slice(0, room).map((color) => ({
      name: sanitizeColorName(color.name) || FALLBACK_NAME,
      hex: color.hex.toLowerCase(),
    }));
    if (added.length === 0) return { ok: true, added: 0 };
    const { error: saveError, data: saved } = await caller.supabase.rpc("brand_save", {
      p_brand: {
        id: row.id,
        client_id: row.client_id,
        name: row.name,
        description: row.description,
        target_audience: row.target_audience,
        tone_of_voice: row.tone_of_voice,
        objectives: row.objectives,
        references_notes: row.references_notes,
        visual_identity: toJson(appendBrandColors(row.visual_identity, added)),
        timezone: row.timezone,
        expected_version: row.version,
      },
    });
    if (saveError) return fail(saveError);
    const parsed = parseOutput(savedSchema, saved);
    return parsed.ok ? { ok: true, added: added.length } : parsed;
  });

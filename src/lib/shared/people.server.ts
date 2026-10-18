import { z } from "zod";
import type { Caller } from "@/lib/shared/auth/server-guards.server";

const namesSchema = z.record(z.string(), z.string());

export const personNames = async (
  supabase: Caller["supabase"],
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, string>> => {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.rpc("person_names", { p_ids: unique });
  if (error) return new Map();
  const parsed = namesSchema.safeParse(data);
  return parsed.success ? new Map(Object.entries(parsed.data)) : new Map();
};

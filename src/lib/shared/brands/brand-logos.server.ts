import type { SupabaseClient } from "@supabase/supabase-js";
import { INTERNAL_URL_SECONDS } from "@/lib/shared/media/limits";
import { serverStorage } from "@/lib/shared/storage/server-storage.server";
import type { Database } from "@/lib/shared/supabase/database.types";

export const brandLogoUrls = async (
  supabase: SupabaseClient<Database>,
  brandIds: string[],
): Promise<Map<string, string>> => {
  const urls = new Map<string, string>();
  const storage = serverStorage();
  if (storage === null || brandIds.length === 0) return urls;
  const { data, error } = await supabase.rpc("brand_logo_keys", { p_brands: brandIds });
  if (error) return urls;
  const signed = await storage.signUrls(
    data.map((row) => row.thumb_key),
    INTERNAL_URL_SECONDS,
  );
  for (const row of data) {
    const url = signed.get(row.thumb_key);
    if (url !== undefined) urls.set(row.brand_id, url);
  }
  return urls;
};

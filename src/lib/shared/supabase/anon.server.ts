import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/shared/env";
import type { Database } from "@/lib/shared/supabase/database.types";

export const anonClient = () =>
  createClient<Database>(clientEnv().VITE_SUPABASE_URL, clientEnv().VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

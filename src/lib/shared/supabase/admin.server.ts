import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/shared/env";
import { serverEnv } from "@/lib/shared/env.server";
import type { Database } from "@/lib/shared/supabase/database.types";

export const adminClient = () =>
  createClient<Database>(clientEnv().VITE_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

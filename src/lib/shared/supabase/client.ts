import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/shared/env";
import type { Database } from "@/lib/shared/supabase/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export const browserClient = () => {
  const env = clientEnv();
  client ??= createBrowserClient<Database>(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
};

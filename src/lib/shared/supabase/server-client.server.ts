import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { clientEnv } from "@/lib/shared/env";
import type { Database } from "@/lib/shared/supabase/database.types";

export const serverClient = () => {
  const env = clientEnv();
  return createServerClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => setCookie(name, value, options));
      },
    },
  });
};

export type ServerSupabase = ReturnType<typeof serverClient>;

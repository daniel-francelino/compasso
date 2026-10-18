import { createServerFn } from "@tanstack/react-start";
import { loginSchema } from "@/lib/shared/auth/schemas";
import { logError } from "@/lib/shared/logger";
import { type Result, fail } from "@/lib/shared/server-utils";
import { serverClient } from "@/lib/shared/supabase/server-client.server";

const TOO_MANY_REQUESTS = 429;

export const signIn = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<Result> => {
    try {
      const { error } = await serverClient().auth.signInWithPassword(data);
      if (error === null) return { ok: true };
      if (error.status === TOO_MANY_REQUESTS) return fail({ message: "rate_limited" });
      return fail({ message: "invalid_credentials" });
    } catch (error) {
      logError("signIn failed", error);
      return fail({ message: "unknown" });
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(async (): Promise<Result> => {
  const { error } = await serverClient().auth.signOut();
  if (error === null) return { ok: true };
  logError("signOut failed", error);
  return fail({ message: "unknown" });
});

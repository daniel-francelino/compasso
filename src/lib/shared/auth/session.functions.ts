import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ActionKey } from "@/lib/shared/auth/actions";
import { isActionKey } from "@/lib/shared/auth/permissions";
import { type AuthState, signedOut } from "@/lib/shared/auth/types";
import { ProfileKind, ProfileStatus } from "@/lib/shared/enums";
import { logError } from "@/lib/shared/logger";
import { serverClient } from "@/lib/shared/supabase/server-client.server";

const profileRowSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  status: z.nativeEnum(ProfileStatus),
  kind: z.nativeEnum(ProfileKind),
  roles: z.object({ key: z.string(), name: z.string() }).nullable(),
});

export const getAuthState = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthState> => {
    const supabase = serverClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (user === null) return signedOut;

    const { data: row, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, status, kind, roles(key, name)")
      .eq("id", user.id)
      .maybeSingle();
    const { data: actionRows, error: actionsError } = await supabase.rpc("my_actions");
    if (profileError !== null || actionsError !== null) {
      logError("getAuthState failed", profileError ?? actionsError);
      throw new Error("auth_state_unavailable");
    }

    const parsed = profileRowSchema.safeParse(row);
    const actions: ActionKey[] = (actionRows ?? []).filter(isActionKey);

    return {
      user: { id: user.id, email: user.email ?? "" },
      profile: parsed.success
        ? {
            id: parsed.data.id,
            name: parsed.data.full_name,
            email: parsed.data.email,
            status: parsed.data.status,
            kind: parsed.data.kind,
            role: parsed.data.roles,
          }
        : null,
      actions,
    };
  },
);

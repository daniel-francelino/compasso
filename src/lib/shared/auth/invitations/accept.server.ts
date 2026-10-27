import { z } from "zod";
import { hashInvitationToken } from "@/lib/shared/auth/invitations/token.server";
import { logError } from "@/lib/shared/logger";
import { type Result, fail, parseOutput } from "@/lib/shared/server-utils";
import { adminClient } from "@/lib/shared/supabase/admin.server";
import { serverClient } from "@/lib/shared/supabase/server-client.server";
import { hasPassed } from "@/lib/shared/dates";

const acceptedSchema = z.object({ profile_id: z.string().uuid(), kind: z.string() });

export type InvitationPreview = { email: string; roleName: string };

export const findPendingInvitation = async (token: string): Promise<InvitationPreview | null> => {
  const { data } = await adminClient()
    .from("invitations")
    .select("email, expires_at, roles(name)")
    .eq("token_hash", hashInvitationToken(token))
    .eq("status", "pending")
    .maybeSingle();
  if (data === null || hasPassed(data.expires_at)) return null;
  return { email: data.email, roleName: data.roles?.name ?? "" };
};

export const acceptInvitationWithPassword = async (input: {
  token: string;
  fullName: string;
  password: string;
}): Promise<Result<{ kind: string }>> => {
  const preview = await findPendingInvitation(input.token);
  if (preview === null) return fail({ message: "invitation_invalid" });

  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email: preview.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (created.error !== null || created.data.user === null) {
    logError("invitation: could not create the auth user", created.error?.code);
    return fail({ message: "invitation_invalid" });
  }
  const userId = created.data.user.id;

  const supabase = serverClient();
  const signedIn = await supabase.auth.signInWithPassword({
    email: preview.email,
    password: input.password,
  });
  if (signedIn.error !== null) {
    await admin.auth.admin.deleteUser(userId);
    logError("invitation: could not sign in the new user", signedIn.error.code);
    return fail({ message: "unknown" });
  }

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token_hash: hashInvitationToken(input.token),
  });
  if (error) {
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(userId);
    return fail(error);
  }
  const parsed = parseOutput(acceptedSchema, data);
  return parsed.ok ? { ok: true, kind: parsed.kind } : parsed;
};

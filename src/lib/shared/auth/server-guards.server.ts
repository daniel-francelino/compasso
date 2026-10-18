import { ProfileStatus } from "@/lib/shared/enums";
import type { ActionKey } from "@/lib/shared/auth/actions";
import { type ServerSupabase, serverClient } from "@/lib/shared/supabase/server-client.server";

export type Caller = { supabase: ServerSupabase; userId: string };

export const requireActionServer = async (action: ActionKey): Promise<Caller | null> => {
  const supabase = serverClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) return null;
  const { data: allowed } = await supabase.rpc("has_action", { p_action: action });
  return allowed === true ? { supabase, userId: data.user.id } : null;
};

export const requireApprovedServer = async (): Promise<Caller | null> => {
  const supabase = serverClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  return profile?.status === ProfileStatus.Approved ? { supabase, userId: data.user.id } : null;
};

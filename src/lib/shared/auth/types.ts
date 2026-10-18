import type { ActionKey } from "@/lib/shared/auth/actions";
import type { ProfileKind, ProfileStatus } from "@/lib/shared/enums";

export type AuthRole = { key: string; name: string };

export type AuthProfile = {
  id: string;
  name: string;
  email: string;
  status: ProfileStatus;
  kind: ProfileKind;
  role: AuthRole | null;
};

export type AuthState = {
  user: { id: string; email: string } | null;
  profile: AuthProfile | null;
  actions: ActionKey[];
};

export const signedOut: AuthState = { user: null, profile: null, actions: [] };

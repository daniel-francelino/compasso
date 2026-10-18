import { ACTION_KEYS, type ActionKey } from "@/lib/shared/auth/actions";
import type { AuthState } from "@/lib/shared/auth/types";

export const can = (auth: AuthState, action: ActionKey): boolean => auth.actions.includes(action);

export const isActionKey = (value: string): value is ActionKey =>
  (ACTION_KEYS as readonly string[]).includes(value);

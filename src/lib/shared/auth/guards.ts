import { redirect } from "@tanstack/react-router";
import type { ActionKey } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import type { AuthState } from "@/lib/shared/auth/types";
import { AppRoute } from "@/lib/shared/routes";

export const requireAction = (context: { auth: AuthState }, action: ActionKey) => {
  if (!can(context.auth, action)) throw redirect({ to: AppRoute.Forbidden });
};

import type { AuthState } from "@/lib/shared/auth/types";
import { ProfileKind, ProfileStatus } from "@/lib/shared/enums";
import { AppRoute } from "@/lib/shared/routes";

const ALLOWED_PREFIXES: string[] = [AppRoute.Admin, AppRoute.Portal];

export const safeRedirect = (target: string | undefined, fallback: string = AppRoute.Admin) => {
  if (target === undefined || target.startsWith("//")) return fallback;
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => target === prefix || target.startsWith(`${prefix}/`),
  );
  return allowed ? target : fallback;
};

export const blockedDestination = (auth: AuthState): string | null => {
  if (auth.user === null) return AppRoute.Login;
  const status = auth.profile?.status ?? ProfileStatus.Pending;
  if (status === ProfileStatus.Approved && auth.profile?.role) return null;
  if (status === ProfileStatus.Rejected || status === ProfileStatus.Suspended) {
    return AppRoute.AccessDenied;
  }
  return AppRoute.Pending;
};

export const homeFor = (auth: AuthState): string =>
  auth.profile?.kind === ProfileKind.External ? AppRoute.Portal : AppRoute.Admin;

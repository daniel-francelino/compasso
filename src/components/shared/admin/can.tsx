import type { ReactNode } from "react";
import type { ActionKey } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";

export function Can({
  action,
  fallback = null,
  children,
}: {
  action: ActionKey;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const auth = useAuth();
  return <>{can(auth, action) ? children : fallback}</>;
}

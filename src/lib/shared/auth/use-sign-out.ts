import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { signOut } from "@/lib/shared/auth/login.functions";
import { AppRoute } from "@/lib/shared/routes";

export const useSignOut = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await signOut();
    queryClient.clear();
    await router.navigate({ to: AppRoute.Login, replace: true });
  }, [router, queryClient]);
};

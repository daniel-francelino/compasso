import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { ResetPasswordPage } from "lost-ui/templates/auth/reset-password-page";
import { AuthAside, AuthLogo } from "@/components/shared/admin/auth-brand";
import { resetPassword } from "@/lib/shared/auth/recovery.functions";
import { MIN_PASSWORD_LENGTH } from "@/lib/shared/auth/schemas";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";
import { failureMessage } from "@/lib/shared/server-utils";

export const Route = createFileRoute("/admin/reset-password")({
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (auth.user === null) throw redirect({ to: AppRoute.RecoverPassword });
  },
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const router = useRouter();

  return (
    <ResetPasswordPage
      logo={<AuthLogo />}
      aside={<AuthAside />}
      title="Nova senha"
      description={`Escolha uma senha com pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
      minPasswordLength={MIN_PASSWORD_LENGTH}
      onSubmit={async ({ password }) => {
        const result = await resetPassword({ data: { password, confirmation: password } });
        if (result.ok) router.history.push(AppRoute.Admin);
        return failureMessage(result);
      }}
    />
  );
}

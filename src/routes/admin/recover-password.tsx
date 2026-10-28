import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "lost-ui/templates/auth/forgot-password-page";
import { AuthAside, AuthLogo } from "@/components/shared/admin/auth-brand";
import { renderAuthLink } from "@/components/shared/admin/render-auth-link";
import { requestPasswordReset } from "@/lib/shared/auth/recovery.functions";
import { AppRoute } from "@/lib/shared/routes";
import { failureMessage } from "@/lib/shared/server-utils";

export const Route = createFileRoute("/admin/recover-password")({
  component: RecoverPasswordRoute,
});

function RecoverPasswordRoute() {
  return (
    <ForgotPasswordPage
      logo={<AuthLogo />}
      aside={<AuthAside />}
      title="Recuperar senha"
      description="Informe o e-mail da sua conta. Se ele existir, enviaremos um link."
      loginHref={AppRoute.Login}
      renderLink={renderAuthLink}
      onSubmit={async ({ email }) =>
        failureMessage(await requestPasswordReset({ data: { email } }))
      }
    />
  );
}

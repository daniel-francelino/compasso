import { MailCheck } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthMessagePage } from "lost-ui/templates/auth/auth-message-page";
import { AuthAside, AuthLogo, AuthTextLink } from "@/components/shared/admin/auth-brand";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/confirm-email")({
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  return (
    <AuthMessagePage
      logo={<AuthLogo />}
      aside={<AuthAside />}
      icon={<MailCheck />}
      title="Verifique seu e-mail"
      description="Enviamos uma mensagem com um link. Abra-o neste mesmo navegador para continuar."
      footer={<AuthTextLink href={AppRoute.Login}>Voltar para o login</AuthTextLink>}
    />
  );
}

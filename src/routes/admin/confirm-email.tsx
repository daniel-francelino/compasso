import { Link, createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/shared/admin/auth-shell";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/confirm-email")({
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  return (
    <AuthShell
      title="Verifique seu e-mail"
      description="Enviamos uma mensagem com um link. Abra-o neste mesmo navegador para continuar."
      footer={
        <Link to={AppRoute.Login} className="text-primary underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <span />
    </AuthShell>
  );
}

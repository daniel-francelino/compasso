import { KeyRound } from "lucide-react";
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field, FormError, PasswordField } from "@/components/shared/admin/auth-shell";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { acceptInvitation, previewInvitation } from "@/lib/shared/auth/invitations.functions";
import { homeFor } from "@/lib/shared/auth/redirect";
import { acceptInvitationSchema } from "@/lib/shared/auth/schemas";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/invite/$token")({
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (auth.user !== null) throw redirect({ to: homeFor(auth) });
  },
  loader: async ({ params }) => ({
    preview: await previewInvitation({ data: { token: params.token } }),
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { preview } = Route.useLoaderData();
  const router = useRouter();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  if (!preview.ok) {
    return (
      <AuthShell
        title="Convite indisponível"
        description="Este convite expirou ou já foi usado. Peça um novo convite a quem o enviou."
        footer={
          <Link to={AppRoute.Login} className="text-primary underline-offset-4 hover:underline">
            Ir para o login
          </Link>
        }
      >
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Bem-vindo(a) ? Aura Creative"
      description="Você foi convidado(a) para acessar a Aura Creative. Defina uma senha para entrar."
    >
      <form
        ref={formRef}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            acceptInvitationSchema,
            { token, fullName, password },
            (data) => acceptInvitation({ data }),
            () => router.history.push(AppRoute.Admin),
          );
        }}
      >
        <Field id="invite-email" label="E-mail" value={preview.email} readOnly />
        <Field
          id="fullName"
          label="Nome completo"
          autoComplete="name"
          required
          value={fullName}
          error={errors["fullName"]}
          onChange={(event) => setFullName(event.target.value)}
        />
        <PasswordField
          id="password"
          label="Senha"
          autoComplete="new-password"
          required
          hint="Pelo menos 10 caracteres."
          value={password}
          error={errors["password"]}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy}>
          <KeyRound aria-hidden="true" />
          {busy ? "Criando acesso…" : "Criar acesso"}
        </Button>
      </form>
    </AuthShell>
  );
}

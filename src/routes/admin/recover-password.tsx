import { Send } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, Field, FormError } from "@/components/shared/admin/auth-shell";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { recoverPasswordSchema, requestPasswordReset } from "@/lib/shared/auth/recovery.functions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/recover-password")({
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const back = (
    <Link to={AppRoute.Login} className="text-primary underline-offset-4 hover:underline">
      Voltar para o login
    </Link>
  );

  if (sent) {
    return (
      <AuthShell
        title="Verifique seu e-mail"
        description="Enviamos um link para o seu e-mail. Abra-o para criar uma nova senha."
        footer={back}
      >
        <span />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recuperar senha"
      description="Informe o e-mail da sua conta. Se ele existir, enviaremos um link."
      footer={back}
    >
      <form
        ref={formRef}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            recoverPasswordSchema,
            { email },
            (data) => requestPasswordReset({ data }),
            () => setSent(true),
          );
        }}
      >
        <Field
          id="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          error={errors["email"]}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy}>
          <Send aria-hidden="true" />
          {busy ? "Enviando…" : "Enviar link"}
        </Button>
      </form>
    </AuthShell>
  );
}

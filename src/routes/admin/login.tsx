import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthShell, Field, FormError, PasswordField } from "@/components/shared/admin/auth-shell";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { signIn } from "@/lib/shared/auth/login.functions";
import { safeRedirect } from "@/lib/shared/auth/redirect";
import { loginSchema } from "@/lib/shared/auth/schemas";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/login")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (auth.user !== null) throw redirect({ to: AppRoute.Admin });
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthShell
      title="Entrar"
      description="Use o e-mail do seu convite para acessar o Compasso."
      footer={
        <Link
          to={AppRoute.RecoverPassword}
          className="text-primary underline-offset-4 hover:underline"
        >
          Esqueci minha senha
        </Link>
      }
    >
      <form
        ref={formRef}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            loginSchema,
            { email, password },
            (data) => signIn({ data }),
            () => router.history.push(safeRedirect(search.redirect)),
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
        <PasswordField
          id="password"
          label="Senha"
          autoComplete="current-password"
          required
          value={password}
          error={errors["password"]}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  );
}

import { Save } from "lucide-react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, FormError, PasswordField } from "@/components/shared/admin/auth-shell";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { resetPassword, resetPasswordSchema } from "@/lib/shared/auth/recovery.functions";
import { getAuthState } from "@/lib/shared/auth/session.functions";
import { AppRoute } from "@/lib/shared/routes";

export const Route = createFileRoute("/admin/reset-password")({
  beforeLoad: async () => {
    const auth = await getAuthState();
    if (auth.user === null) throw redirect({ to: AppRoute.RecoverPassword });
  },
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <AuthShell title="Nova senha" description="Escolha uma senha com pelo menos 10 caracteres.">
      <form
        ref={formRef}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            resetPasswordSchema,
            { password, confirmation },
            (data) => resetPassword({ data }),
            () => router.history.push(AppRoute.Admin),
          );
        }}
      >
        <PasswordField
          id="password"
          label="Nova senha"
          autoComplete="new-password"
          required
          value={password}
          error={errors["password"]}
          onChange={(event) => setPassword(event.target.value)}
        />
        <PasswordField
          id="confirmation"
          label="Repita a nova senha"
          autoComplete="new-password"
          required
          value={confirmation}
          error={errors["confirmation"]}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <FormError message={error} />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy}>
          <Save aria-hidden="true" />
          {busy ? "Salvando…" : "Salvar senha"}
        </Button>
      </form>
    </AuthShell>
  );
}

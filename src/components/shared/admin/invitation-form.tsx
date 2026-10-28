import { KeyRound } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Form } from "lost-ui/forms/form";
import { FormInput } from "lost-ui/forms/form-input";
import { FormInputPassword } from "lost-ui/forms/form-input-password";
import { rules } from "lost-ui/forms/rules";
import { AuthLayout } from "lost-ui/templates/auth/auth-layout";
import { AuthAside, AuthLogo } from "@/components/shared/admin/auth-brand";
import { AuthImage } from "@/components/shared/admin/auth-images";
import { FormError } from "@/components/shared/admin/auth-shell";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { acceptInvitation } from "@/lib/shared/auth/invitations.functions";
import { MIN_PASSWORD_LENGTH, acceptInvitationSchema } from "@/lib/shared/auth/schemas";
import { AppRoute } from "@/lib/shared/routes";

export function InvitationForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const { error, busy, submit } = useFormSubmit();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthLayout
      logo={<AuthLogo />}
      aside={<AuthAside image={AuthImage.Analytics} />}
      title="Bem-vindo(a) à Aura Creative"
      description="Você foi convidado(a) para acessar a Aura Creative. Defina uma senha para entrar."
    >
      <Form
        className="grid gap-6"
        noValidate
        onSubmit={() => {
          void submit(
            acceptInvitationSchema,
            { token, fullName, password },
            (data) => acceptInvitation({ data }),
            () => router.history.push(AppRoute.Admin),
          );
        }}
      >
        <FormInput name="email" label="E-mail" value={email} readOnly />
        <FormInput
          name="fullName"
          label="Nome completo"
          autoComplete="name"
          rules={[rules.required(), rules.minLength(2)]}
          value={fullName}
          onValueChange={setFullName}
        />
        <FormInputPassword
          name="password"
          label="Senha"
          autoComplete="new-password"
          help={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`}
          rules={[rules.required(), rules.minLength(MIN_PASSWORD_LENGTH)]}
          value={password}
          onValueChange={setPassword}
        />
        <FormError message={error} />
        <Button type="submit" className="h-11 w-full md:h-10" disabled={busy}>
          <KeyRound aria-hidden="true" />
          {busy ? "Criando acesso…" : "Criar acesso"}
        </Button>
      </Form>
    </AuthLayout>
  );
}

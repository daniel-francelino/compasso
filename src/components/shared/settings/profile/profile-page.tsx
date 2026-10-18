import { useState } from "react";
import { toast } from "sonner";
import { FormError, PasswordField } from "@/components/shared/admin/auth-shell";
import { TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PreferencesSection } from "@/components/shared/notifications/preferences-section";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useAuth } from "@/lib/shared/auth/use-auth";
import {
  changePassword,
  changePasswordSchema,
  updateProfile,
  updateProfileSchema,
} from "@/lib/shared/auth/profile.functions";

function NameForm({ initialName }: { initialName: string }) {
  const { errors, error, busy, submit } = useFormSubmit();
  const [fullName, setFullName] = useState(initialName);

  return (
    <SectionCard
      as="form"
      noValidate
      title="Seus dados"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          updateProfileSchema,
          { fullName },
          (data) => updateProfile({ data }),
          () => {
            toast.success("Dados salvos.");
          },
        );
      }}
    >
      <TextField
        id="profile-name"
        label="Nome"
        required
        value={fullName}
        onValueChange={setFullName}
        maxLength={120}
        error={errors["fullName"]}
      />
      <FormError message={error} />
      <Button type="submit" loading={busy} disabled={busy || fullName === initialName}>
        Salvar
      </Button>
    </SectionCard>
  );
}

function PasswordForm() {
  const { errors, error, busy, submit } = useFormSubmit();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <SectionCard
      as="form"
      noValidate
      title="Senha"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          changePasswordSchema,
          { password, confirmation },
          (data) => changePassword({ data }),
          () => {
            toast.success("Senha alterada.");
            setPassword("");
            setConfirmation("");
          },
        );
      }}
    >
      <PasswordField
        id="new-password"
        label="Nova senha"
        autoComplete="new-password"
        hint="Pelo menos 10 caracteres."
        value={password}
        error={errors["password"]}
        onChange={(event) => setPassword(event.target.value)}
      />
      <PasswordField
        id="confirm-password"
        label="Repita a nova senha"
        autoComplete="new-password"
        value={confirmation}
        error={errors["confirmation"]}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <FormError message={error} />
      <Button type="submit" loading={busy} disabled={busy || password === ""}>
        Alterar senha
      </Button>
    </SectionCard>
  );
}

export function ProfilePage() {
  const auth = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description={auth.profile?.email} />
      <div className="grid gap-4 lg:grid-cols-2">
        <NameForm initialName={auth.profile?.name ?? ""} />
        <PasswordForm />
      </div>
      <PreferencesSection />
    </div>
  );
}

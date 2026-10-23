import { Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormError, PasswordField } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { ProfileAvatarField } from "@/components/shared/settings/profile/profile-avatar-field";
import { PreferencesFields } from "@/components/shared/notifications/preferences-section";
import { Button } from "@/components/shared/ui/button";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  changePassword,
  changePasswordSchema,
  updateProfile,
  updateProfileSchema,
} from "@/lib/shared/auth/profile.functions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { zodFieldErrors } from "@/lib/shared/forms";
import {
  type PreferenceRow,
  listPreferences,
  savePreference,
} from "@/lib/shared/notifications/notifications.functions";
import {
  type PreferenceDraft,
  draftChanged,
  draftInvalid,
  draftLeadDays,
  draftOf,
} from "@/lib/shared/notifications/preference-drafts";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function ProfileForm({
  initialName,
  preferences,
  notificationChannelLabel,
}: {
  initialName: string;
  preferences: PreferenceRow[];
  notificationChannelLabel: string;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [drafts, setDrafts] = useState<Record<string, PreferenceDraft>>(() =>
    Object.fromEntries(preferences.map((row) => [row.kind, draftOf(row)])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changedRows = preferences.filter((row) => draftChanged(row, drafts[row.kind]));
  const nameChanged = fullName !== savedName;
  const passwordFilled = password !== "" || confirmation !== "";
  const dirty = nameChanged || passwordFilled || changedRows.length > 0;
  const draftsInvalid = changedRows.some((row) => draftInvalid(row, drafts[row.kind]));
  useUnsavedChanges(dirty);

  const patchDraft = (kind: string, change: Partial<PreferenceDraft>) =>
    setDrafts((current) => ({
      ...current,
      [kind]: { enabled: false, email: false, days: "", ...current[kind], ...change },
    }));

  function validate(): boolean {
    const nameCheck = updateProfileSchema.safeParse({ fullName });
    const passwordCheck = changePasswordSchema.safeParse({ password, confirmation });
    const found: Record<string, string> = {
      ...(nameChanged && !nameCheck.success ? zodFieldErrors(nameCheck.error) : {}),
      ...(passwordFilled && !passwordCheck.success ? zodFieldErrors(passwordCheck.error) : {}),
    };
    setErrors(found);
    return Object.keys(found).length === 0;
  }

  const steps = (): (() => Promise<string | null>)[] => {
    const list: (() => Promise<string | null>)[] = [];
    if (nameChanged) {
      list.push(async () => {
        const result = await updateProfile({ data: { fullName } });
        if (result.ok) setSavedName(fullName);
        return result.ok ? null : result.message;
      });
    }
    if (passwordFilled) {
      list.push(async () => {
        const result = await changePassword({ data: { password, confirmation } });
        if (!result.ok) return result.message;
        setPassword("");
        setConfirmation("");
        return null;
      });
    }
    for (const row of changedRows) {
      const draft = drafts[row.kind];
      if (draft === undefined) continue;
      list.push(async () => {
        const result = await savePreference({
          data: {
            kind: row.kind,
            enabled: draft.enabled,
            email: draft.email,
            leadDays: draftLeadDays(row, draft),
          },
        });
        return result.ok ? null : result.message;
      });
    }
    return list;
  };

  async function save() {
    if (busy || !dirty || draftsInvalid || !validate()) return;
    setBusy(true);
    setError(null);
    let failure: string | null = null;
    for (const step of steps()) {
      failure = await step();
      if (failure !== null) break;
    }

    await queryClient.invalidateQueries({ queryKey: QueryKey.Notifications.preferences() });
    setBusy(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    toast.success("Alterações salvas.");
  }

  return (
    <SectionCard
      as="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="profile-data" className="space-y-3">
          <h2 id="profile-data" className="heading-card text-foreground">
            Seus dados
          </h2>
          <ProfileAvatarField />
          <TextField
            id="profile-name"
            label="Nome"
            required
            value={fullName}
            onValueChange={setFullName}
            maxLength={120}
            error={errors["fullName"]}
          />
        </section>

        <section aria-labelledby="profile-password" className="space-y-3">
          <h2 id="profile-password" className="heading-card text-foreground">
            Senha
          </h2>
          <PasswordField
            id="new-password"
            label="Nova senha"
            autoComplete="new-password"
            hint="Deixe em branco para manter a atual. Pelo menos 10 caracteres."
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
        </section>
      </div>

      <section
        aria-labelledby="profile-notifications"
        className="space-y-3 border-t border-border pt-6"
      >
        <h2 id="profile-notifications" className="heading-card text-foreground">
          Avisos
        </h2>
        <PreferencesFields
          rows={preferences}
          drafts={drafts}
          onChange={patchDraft}
          disabled={busy}
          channelLabel={notificationChannelLabel}
        />
      </section>

      <FormError message={error} />
      <FormActions>
        <Button type="submit" loading={busy} disabled={!dirty || draftsInvalid || busy}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      </FormActions>
    </SectionCard>
  );
}

export function ProfilePage({
  notificationChannelLabel = "Na Aura Creative",
}: {
  notificationChannelLabel?: string;
}) {
  const auth = useAuth();
  const query = useQuery({
    queryKey: QueryKey.Notifications.preferences(),
    queryFn: async () => unwrapResult(await listPreferences()).preferences,
  });
  const preferences = query.data ?? [];
  const formKey = preferences
    .map((row) => `${row.kind}-${row.enabled}-${row.email}-${(row.leadDays ?? []).join()}`)
    .join("|");

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description={auth.profile?.email} />
      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.isPending ? null : (
        <ProfileForm
          key={formKey}
          initialName={auth.profile?.name ?? ""}
          preferences={preferences}
          notificationChannelLabel={notificationChannelLabel}
        />
      )}
    </div>
  );
}

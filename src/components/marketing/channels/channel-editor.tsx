import { useEffect, useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { EditorSheet } from "@/components/shared/admin/editor-sheet";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { type ChannelRow, saveChannel } from "@/lib/marketing/channels/channels.functions";
import { saveChannelSchema } from "@/lib/marketing/channels/schemas";
import { Platform } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { platformDescriptors } from "@/lib/shared/preview/platforms";

const platformOptions = Object.values(Platform).map((platform) => ({
  value: platform,
  label: platformLabels[platform],
}));

const isPlatform = (value: string): value is Platform =>
  Object.values(Platform).some((platform) => platform === value);

export function ChannelEditor({
  brandId,
  channel,
  onClose,
  onDirtyChange,
  onSaved,
  restoreFocus,
}: {
  brandId: string;
  channel?: ChannelRow | undefined;
  onClose: () => void;
  onDirtyChange: (state: { dirty: boolean; busy: boolean }) => void;
  onSaved: () => void;
  restoreFocus: (event: Event) => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [platform, setPlatform] = useState<string>(channel?.platform ?? "");
  const [profileName, setProfileName] = useState(channel?.profileName ?? "");
  const [profileUrl, setProfileUrl] = useState(channel?.profileUrl ?? "");
  const [externalId, setExternalId] = useState(channel?.externalId ?? "");
  const [notes, setNotes] = useState(channel?.notes ?? "");

  const dirty =
    platform !== (channel?.platform ?? "") ||
    profileName !== (channel?.profileName ?? "") ||
    profileUrl !== (channel?.profileUrl ?? "") ||
    externalId !== (channel?.externalId ?? "") ||
    notes !== (channel?.notes ?? "");

  useEffect(() => {
    onDirtyChange({ dirty, busy });
  }, [dirty, busy, onDirtyChange]);

  const handlePrefix = isPlatform(platform) && platformDescriptors[platform].handlePrefix;

  return (
    <EditorSheet
      open
      onClose={onClose}
      restoreFocus={restoreFocus}
      title={channel ? "Editar canal" : "Novo canal"}
      description="Um canal é um perfil ou destino da marca. Cadastrar não conecta a plataforma."
      formId="channel-form"
      busy={busy}
    >
      <form
        id="channel-form"
        ref={formRef}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(
            saveChannelSchema,
            {
              ...(channel ? { id: channel.id, expectedVersion: channel.version } : {}),
              brandId,
              platform,
              profileName,
              profileUrl,
              externalId,
              notes,
            },
            (data) => saveChannel({ data }),
            onSaved,
          );
        }}
      >
        <SelectField
          id="channel-platform"
          label="Plataforma"
          required
          value={platform}
          onValueChange={setPlatform}
          options={platformOptions}
          placeholder="Escolha a plataforma"
          error={errors["platform"]}
        />
        <TextField
          id="channel-name"
          label="Nome do perfil"
          required
          value={profileName}
          onValueChange={setProfileName}
          maxLength={120}
          hint={handlePrefix ? "O @ é colocado automaticamente." : undefined}
          error={errors["profileName"]}
        />
        <TextField
          id="channel-url"
          label="Link do perfil"
          value={profileUrl}
          onValueChange={setProfileUrl}
          placeholder="https://"
          error={errors["profileUrl"]}
        />
        <TextField
          id="channel-external"
          label="Identificador na plataforma"
          value={externalId}
          onValueChange={setExternalId}
          maxLength={120}
          error={errors["externalId"]}
        />
        <TextAreaField
          id="channel-notes"
          label="Notas internas"
          value={notes}
          onValueChange={setNotes}
          maxLength={2000}
          rows={3}
        />
        <FormError message={error} />
      </form>
    </EditorSheet>
  );
}

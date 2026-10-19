import { useEffect, useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { EditorSheet } from "@/components/shared/admin/editor-sheet";
import { TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { type ChannelRow, saveChannel } from "@/lib/marketing/channels/channels.functions";
import { saveChannelSchema } from "@/lib/marketing/channels/schemas";
import { Platform } from "@/lib/shared/enums";
import { platformLabels } from "@/lib/shared/labels";
import { platformDescriptors } from "@/lib/shared/preview/platforms";

const isPlatform = (value: string): value is Platform =>
  Object.values(Platform).some((platform) => platform === value);

export function ChannelEditor({
  brandId,
  channel,
  initialPlatform,
  onClose,
  onDirtyChange,
  onSaved,
  restoreFocus,
}: {
  brandId: string;
  channel?: ChannelRow | undefined;
  initialPlatform?: Platform;
  onClose: () => void;
  onDirtyChange: (state: { dirty: boolean; busy: boolean }) => void;
  onSaved: () => void;
  restoreFocus: (event: Event) => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const initialPlatformValue = channel?.platform ?? initialPlatform ?? "";
  const [platform] = useState<string>(initialPlatformValue);
  const [profileName, setProfileName] = useState(channel?.profileName ?? "");
  const [profileUrl, setProfileUrl] = useState(channel?.profileUrl ?? "");
  const [externalId, setExternalId] = useState(channel?.externalId ?? "");
  const [notes, setNotes] = useState(channel?.notes ?? "");

  const dirty =
    platform !== initialPlatformValue ||
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
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Plataforma</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground">
              {isPlatform(platform) ? (
                <PlatformIcon platform={platform} className="size-4" />
              ) : null}
            </span>
            {isPlatform(platform) ? platformLabels[platform] : ""}
          </div>
          {errors["platform"] ? (
            <p className="text-xs text-destructive">{errors["platform"]}</p>
          ) : null}
        </div>
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

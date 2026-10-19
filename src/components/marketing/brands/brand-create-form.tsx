import { X, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { saveBrand } from "@/lib/marketing/brands/brands.functions";
import { saveBrandSchema } from "@/lib/marketing/brands/schemas";
import { listClients } from "@/lib/marketing/clients/clients.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { timezoneOptions } from "@/lib/shared/timezones";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const CLIENT_OPTIONS = { search: "", page: 1, status: "active" } as const;

export function BrandCreateForm({
  initialClientId,
  onSaved,
  onCancel,
}: {
  initialClientId?: string | undefined;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const zones = useMemo(() => timezoneOptions(), []);

  const clients = useQuery({
    queryKey: QueryKey.Clients.list(CLIENT_OPTIONS),
    queryFn: async () => unwrapResult(await listClients({ data: CLIENT_OPTIONS })),
  });

  useUnsavedChanges(name !== "" && !busy);

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          saveBrandSchema,
          { clientId, name, timezone },
          (data) => saveBrand({ data }),
          (result) => onSaved(result.id),
        );
      }}
    >
      <SelectField
        id="brand-client"
        label="Cliente"
        required
        value={clientId}
        onValueChange={setClientId}
        options={(clients.data?.rows ?? []).map((client) => ({
          value: client.id,
          label: client.name,
        }))}
        placeholder={clients.isPending ? "Carregando…" : "Escolha o cliente"}
        error={errors["clientId"]}
      />
      <TextField
        id="brand-name"
        label="Nome da marca"
        required
        value={name}
        onValueChange={setName}
        maxLength={120}
        error={errors["name"]}
      />
      <SelectField
        id="brand-timezone"
        label="Fuso horário"
        required
        value={timezone}
        onValueChange={setTimezone}
        options={zones}
        error={errors["timezone"]}
        tip={{
          label: "Sobre o fuso horário",
          content: "Usado no calendário e nos prazos desta marca.",
        }}
      />
      <FormError message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          <X aria-hidden="true" />
          Cancelar
        </Button>
        <Button type="submit" loading={busy} disabled={busy}>
          <Plus aria-hidden="true" />
          Criar marca
        </Button>
      </div>
    </form>
  );
}

import { X, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { TagInputField } from "@/components/shared/admin/tag-input-field";
import { Button } from "@/components/shared/ui/button";
import { useDebouncedValue } from "@/hooks/shared/use-debounced-value";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  type ClientDetail,
  findSimilarClients,
  listOwnerOptions,
  saveClient,
} from "@/lib/marketing/clients/clients.functions";
import {
  CLIENT_TAG_LENGTH,
  CLIENT_TAG_LIMIT,
  saveClientSchema,
} from "@/lib/marketing/clients/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const NO_OWNER = "none";

export function ClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client?: ClientDetail;
  onSaved: (saved: { id: string }) => void;
  onCancel?: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(client?.name ?? "");
  const [ownerId, setOwnerId] = useState(client?.ownerUserId ?? NO_OWNER);
  const [notes, setNotes] = useState(client?.internalNotes ?? "");
  const [tags, setTags] = useState(client?.tags ?? []);
  const debouncedName = useDebouncedValue(name.trim(), 400);

  const owners = useQuery({
    queryKey: QueryKey.Clients.owners(),
    queryFn: async () => unwrapResult(await listOwnerOptions()).people,
  });
  const similar = useQuery({
    queryKey: QueryKey.Clients.options(debouncedName),
    queryFn: async () =>
      unwrapResult(
        await findSimilarClients({
          data: { name: debouncedName, ...(client ? { excludeId: client.id } : {}) },
        }),
      ).matches,
    enabled: debouncedName.length >= 2 && debouncedName !== client?.name,
  });

  const dirty =
    name !== (client?.name ?? "") ||
    notes !== (client?.internalNotes ?? "") ||
    JSON.stringify(tags) !== JSON.stringify(client?.tags ?? []) ||
    ownerId !== (client?.ownerUserId ?? NO_OWNER);
  useUnsavedChanges(dirty && !busy);

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          saveClientSchema,
          {
            ...(client ? { id: client.id, expectedVersion: client.version } : {}),
            name,
            ownerUserId: ownerId === NO_OWNER ? null : ownerId,
            internalNotes: notes,
            tags,
          },
          (data) => saveClient({ data }),
          (result) => onSaved({ id: result.id }),
        );
      }}
    >
      <TextField
        id="client-name"
        label="Nome do cliente"
        required
        value={name}
        onValueChange={setName}
        maxLength={120}
        error={errors["name"]}
      />
      {similar.data && similar.data.length > 0 ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          Já existe cliente com nome parecido:{" "}
          {similar.data.map((match, index) => (
            <span key={match.id}>
              {index > 0 ? ", " : ""}
              <Link
                to="/admin/marketing/clients/$clientId"
                params={{ clientId: match.id }}
                className="text-primary underline-offset-4 hover:underline"
              >
                {match.name}
              </Link>
            </span>
          ))}
          . Você pode continuar mesmo assim.
        </p>
      ) : null}
      <SelectField
        id="client-owner"
        label="Responsável interno"
        value={ownerId}
        onValueChange={setOwnerId}
        emptyText={owners.data?.length === 0 ? "Nenhuma pessoa disponível" : undefined}
        options={[
          { value: NO_OWNER, label: "Sem responsável" },
          ...(owners.data ?? []).map((person) => ({ value: person.id, label: person.name })),
        ]}
      />
      <TagInputField
        id="client-tags"
        label="Etiquetas"
        value={tags}
        onValueChange={setTags}
        maxItems={CLIENT_TAG_LIMIT}
        maxLength={CLIENT_TAG_LENGTH}
        error={errors["tags"]}
      />
      <TextAreaField
        id="client-notes"
        label="Notas internas"
        value={notes}
        onValueChange={setNotes}
        maxLength={5000}
        rows={4}
        error={errors["internalNotes"]}
      />
      <FormError message={error} />
      <FormActions>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            <X aria-hidden="true" />
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" loading={busy} disabled={busy}>
          <Plus aria-hidden="true" />
          {client ? "Salvar" : "Criar cliente"}
        </Button>
      </FormActions>
    </form>
  );
}

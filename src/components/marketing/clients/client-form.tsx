import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FormError } from "@/components/shared/admin/auth-shell";
import { SelectField, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { useDebouncedValue } from "@/hooks/shared/use-debounced-value";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  type ClientDetail,
  findSimilarClients,
  listOwnerOptions,
  saveClient,
} from "@/lib/marketing/clients/clients.functions";
import { saveClientSchema } from "@/lib/marketing/clients/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const NO_OWNER = "none";

export function ClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client?: ClientDetail;
  onSaved: (saved: { id: string; brandId: string | null }) => void;
  onCancel?: () => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(client?.name ?? "");
  const [ownerId, setOwnerId] = useState(client?.ownerUserId ?? NO_OWNER);
  const [notes, setNotes] = useState(client?.internalNotes ?? "");
  const [tags, setTags] = useState(client?.tags.join(", ") ?? "");
  const [createBrand, setCreateBrand] = useState(true);
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
    tags !== (client?.tags.join(", ") ?? "") ||
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
            tags: tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag !== ""),
            createFirstBrand: client === undefined && createBrand,
          },
          (data) => saveClient({ data }),
          (result) => onSaved({ id: result.id, brandId: result.brandId }),
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
        options={[
          { value: NO_OWNER, label: "Sem responsável" },
          ...(owners.data ?? []).map((person) => ({ value: person.id, label: person.name })),
        ]}
      />
      <TextField
        id="client-tags"
        label="Etiquetas"
        value={tags}
        onValueChange={setTags}
        hint="Separe por vírgula. Ex.: restaurante, local"
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
      {client === undefined ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="client-first-brand"
            checked={createBrand}
            onCheckedChange={(checked) => setCreateBrand(checked === true)}
          />
          <Label htmlFor="client-first-brand">Criar a primeira marca com o mesmo nome</Label>
        </div>
      ) : null}
      <FormError message={error} />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" loading={busy} disabled={busy}>
          {client ? "Salvar" : "Criar cliente"}
        </Button>
      </div>
    </form>
  );
}

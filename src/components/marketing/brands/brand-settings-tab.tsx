import { useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { useBrand } from "@/hooks/marketing/use-brand";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { type BrandDetail, saveBrand } from "@/lib/marketing/brands/brands.functions";
import { saveBrandSchema } from "@/lib/marketing/brands/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { timezoneOptions } from "@/lib/shared/timezones";

function SettingsForm({ brand }: { brand: BrandDetail }) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(brand.name);
  const [timezone, setTimezone] = useState(brand.timezone);
  const zones = useMemo(() => timezoneOptions(), []);
  const dirty = name !== brand.name || timezone !== brand.timezone;
  useUnsavedChanges(dirty && !busy);

  return (
    <SectionCard
      as="form"
      ref={formRef}
      noValidate
      title="Dados da marca"
      className="max-w-2xl"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          saveBrandSchema,
          {
            id: brand.id,
            clientId: brand.clientId,
            name,
            timezone,
            expectedVersion: brand.version,
            description: brand.description ?? "",
            targetAudience: brand.targetAudience ?? "",
            toneOfVoice: brand.toneOfVoice ?? "",
            objectives: brand.objectives ?? "",
            referencesNotes: brand.referencesNotes ?? "",
            visualIdentity: brand.visualIdentity,
          },
          (data) => saveBrand({ data }),
          async () => {
            toast.success("Marca salva.");
            await queryClient.invalidateQueries({ queryKey: QueryKey.Brands.all() });
          },
        );
      }}
    >
      <TextField
        id="settings-name"
        label="Nome"
        required
        value={name}
        onValueChange={setName}
        maxLength={120}
        error={errors["name"]}
      />
      <SelectField
        id="settings-timezone"
        label="Fuso horário"
        required
        value={timezone}
        onValueChange={setTimezone}
        options={zones}
        error={errors["timezone"]}
      />
      {timezone !== brand.timezone ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          Mudar o fuso vale para os próximos planejamentos. O que já foi agendado mantém o horário
          em que foi marcado.
        </p>
      ) : null}
      <FormError message={error} />
      <FormActions>
        <Button type="submit" loading={busy} disabled={busy || !dirty}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      </FormActions>
    </SectionCard>
  );
}

export function BrandSettingsTab({ brandId }: { brandId: string }) {
  const query = useBrand(brandId);

  if (!query.data) return <PageSkeleton rows={2} />;
  const brand = query.data;
  return (
    <div className="space-y-6">
      <SettingsForm key={brand.version} brand={brand} />
    </div>
  );
}

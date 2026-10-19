import { Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { FormSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { organizationSchema } from "@/lib/shared/settings/schemas";
import {
  type OrganizationRecord,
  getOrganization,
  saveOrganization,
} from "@/lib/shared/settings/settings.functions";
import { timezoneOptions } from "@/lib/shared/timezones";

function OrganizationForm({ organization }: { organization: OrganizationRecord }) {
  const queryClient = useQueryClient();
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [name, setName] = useState(organization.name);
  const [legalName, setLegalName] = useState(organization.legalName ?? "");
  const [taxId, setTaxId] = useState(organization.taxId ?? "");
  const [timezone, setTimezone] = useState(organization.defaultTimezone);
  const [contactEmail, setContactEmail] = useState(organization.contactEmail ?? "");
  const zones = useMemo(() => timezoneOptions(), []);

  const dirty =
    name !== organization.name ||
    legalName !== (organization.legalName ?? "") ||
    taxId !== (organization.taxId ?? "") ||
    timezone !== organization.defaultTimezone ||
    contactEmail !== (organization.contactEmail ?? "");
  useUnsavedChanges(dirty);

  return (
    <SectionCard
      as="form"
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          organizationSchema,
          {
            name,
            legalName,
            taxId,
            defaultTimezone: timezone,
            contactEmail,
            expectedVersion: organization.version,
          },
          (data) => saveOrganization({ data }),
          async () => {
            toast.success("Dados da organização salvos.");
            await queryClient.invalidateQueries({ queryKey: QueryKey.Organization.detail() });
          },
        );
      }}
      className="max-w-2xl space-y-4"
    >
      <TextField
        id="org-name"
        label="Nome"
        required
        value={name}
        onValueChange={setName}
        maxLength={120}
        error={errors["name"]}
      />
      <TextField
        id="org-legal"
        label="Razão social"
        value={legalName}
        onValueChange={setLegalName}
        maxLength={160}
        error={errors["legalName"]}
      />
      <TextField
        id="org-tax"
        label="CNPJ ou documento"
        value={taxId}
        onValueChange={setTaxId}
        maxLength={30}
        error={errors["taxId"]}
      />
      <SelectField
        id="org-timezone"
        label="Fuso horário padrão"
        required
        value={timezone}
        onValueChange={setTimezone}
        options={zones}
        error={errors["defaultTimezone"]}
        tip={{
          label: "Sobre o fuso horário",
          content: "Novas marcas começam com este fuso. Cada marca pode ter o seu.",
        }}
      />
      <TextField
        id="org-email"
        label="E-mail de contato"
        type="email"
        value={contactEmail}
        onValueChange={setContactEmail}
        error={errors["contactEmail"]}
      />
      <FormError message={error} />
      <Button type="submit" loading={busy} disabled={!dirty || busy}>
        <Save aria-hidden="true" />
        Salvar
      </Button>
    </SectionCard>
  );
}

export function OrganizationPage() {
  const query = useQuery({
    queryKey: QueryKey.Organization.detail(),
    queryFn: async () => unwrapResult(await getOrganization()).organization,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organização"
        description="Dados da sua empresa e padrões usados em todo o Compasso."
        breadcrumbs={[{ label: "Configurações" }, { label: "Organização" }]}
      />
      {query.isPending ? <FormSkeleton /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.data ? <OrganizationForm key={query.data.version} organization={query.data} /> : null}
    </div>
  );
}

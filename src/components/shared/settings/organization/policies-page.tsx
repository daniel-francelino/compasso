import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { policyFields } from "@/components/shared/settings/organization/policy-fields";
import { Button } from "@/components/shared/ui/button";
import { Switch } from "@/components/shared/ui/switch";
import { Label } from "@/components/shared/ui/label";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { policyLabels, policySchemas, saveSettingSchema } from "@/lib/shared/settings/schemas";
import {
  type SettingRecord,
  listSettings,
  saveSetting,
} from "@/lib/shared/settings/settings.functions";

type Draft = Record<string, string | number | boolean>;

function PolicyCard({ setting }: { setting: SettingRecord }) {
  const queryClient = useQueryClient();
  const { errors, error, busy, submit } = useFormSubmit();
  const [draft, setDraft] = useState<Draft>({ ...setting.value });
  const fields = policyFields[setting.key];

  const parsed = policySchemas[setting.key].safeParse(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(setting.value);

  return (
    <SectionCard
      as="form"
      noValidate
      title={policyLabels[setting.key]}
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          saveSettingSchema,
          { key: setting.key, value: draft, expectedVersion: setting.version },
          (data) => saveSetting({ data }),
          async () => {
            toast.success("Política salva.");
            await queryClient.invalidateQueries({ queryKey: QueryKey.Organization.settings() });
          },
        );
      }}
    >
      <div className="space-y-3">
        {fields.map((field) => {
          const value = draft[field.name];
          if (field.type === "boolean") {
            return (
              <div key={field.name} className="flex items-center justify-between gap-3">
                <Label htmlFor={`${setting.key}-${field.name}`}>{field.label}</Label>
                <Switch
                  id={`${setting.key}-${field.name}`}
                  checked={value === true}
                  onCheckedChange={(checked) => setDraft({ ...draft, [field.name]: checked })}
                />
              </div>
            );
          }
          return (
            <TextField
              key={field.name}
              id={`${setting.key}-${field.name}`}
              label={field.label}
              inputMode={field.type === "number" ? "numeric" : "text"}
              value={String(value ?? "")}
              hint={field.hint}
              onValueChange={(text) =>
                setDraft({
                  ...draft,
                  [field.name]: field.type === "number" ? Number(text.replace(/\D/g, "")) : text,
                })
              }
              error={errors[field.name]}
            />
          );
        })}
      </div>
      <FormError message={error} />
      <Button type="submit" loading={busy} disabled={!dirty || !parsed.success || busy}>
        Salvar
      </Button>
    </SectionCard>
  );
}

export function PoliciesPage() {
  const query = useQuery({
    queryKey: QueryKey.Organization.settings(),
    queryFn: async () => unwrapResult(await listSettings()).settings,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Políticas"
        description="Regras de funcionamento que valem para toda a organização."
        breadcrumbs={[{ label: "Configurações" }, { label: "Políticas" }]}
      />
      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {(query.data ?? []).map((setting) => (
          <PolicyCard key={`${setting.key}-${setting.version}`} setting={setting} />
        ))}
      </div>
    </div>
  );
}

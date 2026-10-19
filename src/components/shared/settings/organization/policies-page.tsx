import { Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { TextField } from "@/components/shared/admin/form-fields";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { policyFields } from "@/components/shared/settings/organization/policy-fields";
import { Button } from "@/components/shared/ui/button";
import { Switch } from "@/components/shared/ui/switch";
import { Label } from "@/components/shared/ui/label";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { policyLabels, policySchemas } from "@/lib/shared/settings/schemas";
import {
  type SettingRecord,
  listSettings,
  saveSetting,
} from "@/lib/shared/settings/settings.functions";

type Draft = Record<string, string | number | boolean>;

const isDirty = (setting: SettingRecord, draft: Draft | undefined): boolean =>
  draft !== undefined && JSON.stringify(draft) !== JSON.stringify(setting.value);

function PoliciesForm({ settings }: { settings: SettingRecord[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.key, { ...setting.value }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = settings.filter((setting) => isDirty(setting, drafts[setting.key]));
  const valid = dirty.every(
    (setting) => policySchemas[setting.key].safeParse(drafts[setting.key]).success,
  );
  useUnsavedChanges(dirty.length > 0);

  const setField = (key: string, name: string, value: string | number | boolean) =>
    setDrafts((current) => ({ ...current, [key]: { ...current[key], [name]: value } }));

  async function save() {
    if (busy || dirty.length === 0) return;
    setBusy(true);
    setError(null);
    let failure: string | null = null;
    for (const setting of dirty) {
      const result = await saveSetting({
        data: {
          key: setting.key,
          value: drafts[setting.key] ?? {},
          expectedVersion: setting.version,
        },
      });
      if (!result.ok) {
        failure = result.message;
        break;
      }
    }
    await queryClient.invalidateQueries({ queryKey: QueryKey.Organization.settings() });
    setBusy(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    toast.success("Políticas salvas.");
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
      {settings.map((setting) => {
        const draft = drafts[setting.key] ?? {};
        return (
          <section
            key={setting.key}
            aria-labelledby={`policy-${setting.key}`}
            className="space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0"
          >
            <h2 id={`policy-${setting.key}`} className="heading-card text-foreground">
              {policyLabels[setting.key]}
            </h2>
            <div className="space-y-3">
              {policyFields[setting.key].map((field) => {
                const value = draft[field.name];
                const id = `${setting.key}-${field.name}`;
                if (field.type === "boolean") {
                  return (
                    <div key={field.name} className="flex items-center justify-between gap-3">
                      <Label htmlFor={id}>{field.label}</Label>
                      <Switch
                        id={id}
                        checked={value === true}
                        onCheckedChange={(checked) => setField(setting.key, field.name, checked)}
                      />
                    </div>
                  );
                }
                return (
                  <TextField
                    key={field.name}
                    id={id}
                    label={field.label}
                    inputMode={field.type === "number" ? "numeric" : "text"}
                    value={String(value ?? "")}
                    hint={field.hint}
                    onValueChange={(text) =>
                      setField(
                        setting.key,
                        field.name,
                        field.type === "number" ? Number(text.replace(/\D/g, "")) : text,
                      )
                    }
                  />
                );
              })}
            </div>
          </section>
        );
      })}
      <FormError message={error} />
      <FormActions>
        <Button type="submit" loading={busy} disabled={dirty.length === 0 || !valid || busy}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      </FormActions>
    </SectionCard>
  );
}

export function PoliciesPage() {
  const query = useQuery({
    queryKey: QueryKey.Organization.settings(),
    queryFn: async () => unwrapResult(await listSettings()).settings,
  });
  const settings = query.data ?? [];
  const formKey = settings.map((setting) => `${setting.key}-${setting.version}`).join("|");

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
      {settings.length > 0 ? <PoliciesForm key={formKey} settings={settings} /> : null}
    </div>
  );
}

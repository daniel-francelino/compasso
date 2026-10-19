import { Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { IconTile } from "@/components/shared/admin/icon-tile";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import {
  type PolicyField,
  policyFields,
  policyGroups,
} from "@/components/shared/settings/organization/policy-fields";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
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

function PolicyRow({
  id,
  field,
  value,
  disabled,
  onChange,
}: {
  id: string;
  field: PolicyField;
  value: string | number | boolean | undefined;
  disabled: boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  return (
    <li className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center md:gap-6">
      <div className="flex min-w-0 items-center gap-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </Label>
        {field.description ? (
          <InfoTip label={`Sobre: ${field.label}`}>{field.description}</InfoTip>
        ) : null}
      </div>
      {field.type === "boolean" ? (
        <div className="md:justify-self-end">
          <Switch id={id} checked={value === true} disabled={disabled} onCheckedChange={onChange} />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            className={field.type === "number" ? "h-11 w-28 md:h-10" : "h-11 md:h-10"}
            inputMode={field.type === "number" ? "numeric" : "text"}
            value={String(value ?? "")}
            disabled={disabled}
            onChange={(event) =>
              onChange(
                field.type === "number"
                  ? Number(event.target.value.replace(/D/g, ""))
                  : event.target.value,
              )
            }
          />
          {field.unit ? <span className="text-sm text-muted-foreground">{field.unit}</span> : null}
        </div>
      )}
    </li>
  );
}

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
      className="space-y-8"
    >
      {settings.map((setting) => {
        const group = policyGroups[setting.key];
        const draft = drafts[setting.key] ?? {};
        return (
          <section
            key={setting.key}
            aria-labelledby={`policy-${setting.key}`}
            className="space-y-2 border-b border-border pb-8 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <IconTile icon={group.icon} />
              <div className="min-w-0">
                <h2
                  id={`policy-${setting.key}`}
                  className="text-base font-semibold text-foreground"
                >
                  {policyLabels[setting.key]}
                </h2>
                <p className="text-sm text-muted-foreground">{group.description}</p>
              </div>
            </div>
            <ul className="divide-y divide-border pl-0 md:pl-13">
              {policyFields[setting.key].map((field) => (
                <PolicyRow
                  key={field.name}
                  id={`${setting.key}-${field.name}`}
                  field={field}
                  value={draft[field.name]}
                  disabled={busy}
                  onChange={(value) => setField(setting.key, field.name, value)}
                />
              ))}
            </ul>
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

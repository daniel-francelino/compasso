import { Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormActions } from "@/components/shared/admin/form-actions";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import {
  type KindDefaults,
  listKindDefaults,
  saveKindDefaults,
} from "@/lib/shared/notifications/defaults.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Draft = { days: string; email: boolean };

const parseDays = (text: string): number[] | null => {
  const days = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number);
  if (days.length === 0 || days.length > 5) return null;
  return days.every((day) => Number.isInteger(day) && day >= 0 && day <= 30) ? days : null;
};

const initialOf = (kind: KindDefaults): Draft => ({
  days: (kind.defaultLeadDays ?? []).join(", "),
  email: kind.defaultEmail,
});

const isDirty = (kind: KindDefaults, draft: Draft | undefined): boolean => {
  if (draft === undefined) return false;
  const initial = initialOf(kind);
  return draft.days !== initial.days || draft.email !== initial.email;
};

const isInvalid = (kind: KindDefaults, draft: Draft | undefined): boolean =>
  kind.schedulable && parseDays(draft?.days ?? "") === null;

function DefaultsForm({ kinds }: { kinds: KindDefaults[] }) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(kinds.map((kind) => [kind.kind, initialOf(kind)])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = kinds.filter((kind) => isDirty(kind, drafts[kind.kind]));
  const invalid = dirty.some((kind) => isInvalid(kind, drafts[kind.kind]));
  useUnsavedChanges(dirty.length > 0);

  const patch = (key: string, change: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [key]: { days: "", email: false, ...current[key], ...change },
    }));

  async function save() {
    if (busy || dirty.length === 0 || invalid) return;
    setBusy(true);
    setError(null);
    let failure: string | null = null;
    for (const kind of dirty) {
      const draft = drafts[kind.kind];
      const result = await saveKindDefaults({
        data: {
          kind: kind.kind,
          defaultLeadDays: kind.schedulable ? parseDays(draft?.days ?? "") : null,
          defaultEmail: draft?.email ?? false,
        },
      });
      if (!result.ok) {
        failure = result.message;
        break;
      }
    }
    await queryClient.invalidateQueries({ queryKey: QueryKey.Notifications.defaults() });
    setBusy(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    toast.success("Padrões salvos.");
  }

  return (
    <SectionCard
      as="form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-4"
    >
      <ul className="divide-y divide-border">
        {kinds.map((kind) => {
          const draft = drafts[kind.kind] ?? initialOf(kind);
          const bad = isInvalid(kind, draft);
          return (
            <li key={kind.kind} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="heading-card text-foreground">{kind.title}</h2>
                <div className="flex flex-wrap items-end gap-4">
                  {kind.schedulable ? (
                    <div className="space-y-1">
                      <Label htmlFor={`default-days-${kind.kind}`}>
                        Antecedência padrão (dias)
                      </Label>
                      <Input
                        id={`default-days-${kind.kind}`}
                        className="h-11 w-40 md:h-10"
                        value={draft.days}
                        aria-invalid={bad ? true : undefined}
                        onChange={(event) => patch(kind.kind, { days: event.target.value })}
                      />
                    </div>
                  ) : null}
                  <span className="flex h-11 items-center gap-2 text-sm md:h-10">
                    <Switch
                      id={`default-email-${kind.kind}`}
                      checked={draft.email}
                      onCheckedChange={(checked) => patch(kind.kind, { email: checked })}
                    />
                    <Label htmlFor={`default-email-${kind.kind}`}>Enviar também por e-mail</Label>
                  </span>
                </div>
              </div>
              {bad ? (
                <p role="alert" className="text-xs text-destructive">
                  Use de 1 a 5 números de 0 a 30, separados por vírgula.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <FormError message={error} />
      <FormActions>
        <Button type="submit" loading={busy} disabled={dirty.length === 0 || invalid || busy}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      </FormActions>
    </SectionCard>
  );
}

export function NotificationDefaultsPage() {
  const query = useQuery({
    queryKey: QueryKey.Notifications.defaults(),
    queryFn: async () => unwrapResult(await listKindDefaults()).kinds,
  });
  const kinds = query.data ?? [];
  const formKey = kinds
    .map((kind) => `${kind.kind}-${kind.defaultEmail}-${(kind.defaultLeadDays ?? []).join()}`)
    .join("|");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avisos padrão"
        description="Como cada tipo de aviso começa para as pessoas. Cada pessoa pode ajustar o seu."
        breadcrumbs={[{ label: "Configurações" }, { label: "Avisos padrão" }]}
      />
      {query.isPending ? <ListSkeleton /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {kinds.length > 0 ? <DefaultsForm key={formKey} kinds={kinds} /> : null}
    </div>
  );
}

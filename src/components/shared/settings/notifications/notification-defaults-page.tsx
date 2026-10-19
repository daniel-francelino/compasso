import { Bell, Save } from "lucide-react";
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
import {
  KindTiming,
  fallbackKindInfo,
  kindGroupIcons,
  kindGroupOrder,
  kindInfo,
} from "@/lib/shared/notifications/kind-info";
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

const infoOf = (kind: KindDefaults) => kindInfo[kind.kind] ?? fallbackKindInfo;

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

const groupsOf = (kinds: KindDefaults[]): { name: string; kinds: KindDefaults[] }[] =>
  kindGroupOrder
    .map((name) => ({ name, kinds: kinds.filter((kind) => infoOf(kind).group === name) }))
    .filter((group) => group.kinds.length > 0);

const timingSuffix = (kind: KindDefaults): string =>
  infoOf(kind).timing === KindTiming.After ? "dias depois do prazo" : "dias antes do prazo";

function GroupTitle({ name }: { name: string }) {
  const Icon = kindGroupIcons[name] ?? Bell;
  return (
    <h2
      id={`group-${name}`}
      className="flex items-center gap-2 text-sm font-semibold text-foreground"
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      {name}
    </h2>
  );
}

function DaysTip() {
  return (
    <InfoTip label="Sobre a antecedência">
      Números de 0 a 30 separados por vírgula, até 5. O 0 é o próprio dia. Exemplo: “2, 0” avisa 2
      dias antes e no dia.
    </InfoTip>
  );
}

function KindRow({
  kind,
  draft,
  invalid,
  disabled,
  onChange,
}: {
  kind: KindDefaults;
  draft: Draft;
  invalid: boolean;
  disabled: boolean;
  onChange: (change: Partial<Draft>) => void;
}) {
  const info = infoOf(kind);
  const emailId = `default-email-${kind.kind}`;
  const daysId = `default-days-${kind.kind}`;

  return (
    <li className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_16rem_8rem] md:items-center md:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <IconTile icon={info.icon} size="sm" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">{kind.title}</p>
          {info.description ? (
            <p className="text-sm text-muted-foreground">{info.description}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        {kind.schedulable ? (
          <>
            <Label htmlFor={daysId} className="text-xs text-muted-foreground md:sr-only">
              Quando avisar
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id={daysId}
                className="h-11 w-24 md:h-10"
                value={draft.days}
                disabled={disabled}
                inputMode="numeric"
                placeholder="2, 0"
                aria-invalid={invalid ? true : undefined}
                aria-describedby={invalid ? `${daysId}-error` : undefined}
                onChange={(event) => onChange({ days: event.target.value })}
              />
              <span className="text-sm text-muted-foreground">{timingSuffix(kind)}</span>
            </div>
            {invalid ? (
              <p id={`${daysId}-error`} role="alert" className="text-xs text-destructive">
                Use de 1 a 5 números de 0 a 30, separados por vírgula.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Na hora do evento</p>
        )}
      </div>

      <div className="flex items-center gap-2 md:justify-center">
        <Switch
          id={emailId}
          checked={draft.email}
          disabled={disabled}
          onCheckedChange={(email) => onChange({ email })}
        />
        <Label htmlFor={emailId} className="text-sm md:sr-only">
          Por e-mail
        </Label>
      </div>
    </li>
  );
}

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
      className="space-y-6"
    >
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1fr)_16rem_8rem] gap-6 border-b border-border pb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid"
      >
        <span>Aviso</span>
        <span className="flex items-center gap-1.5">
          Quando avisar
          <DaysTip />
        </span>
        <span className="text-center">E-mail</span>
      </div>
      {groupsOf(kinds).map((group) => (
        <section key={group.name} aria-labelledby={`group-${group.name}`}>
          <GroupTitle name={group.name} />
          <ul className="divide-y divide-border">
            {group.kinds.map((kind) => (
              <KindRow
                key={kind.kind}
                kind={kind}
                draft={drafts[kind.kind] ?? initialOf(kind)}
                invalid={isInvalid(kind, drafts[kind.kind])}
                disabled={busy}
                onChange={(change) => patch(kind.kind, change)}
              />
            ))}
          </ul>
        </section>
      ))}
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
        description="Defina como cada tipo de aviso começa para as pessoas: quando é enviado e se também vai por e-mail. Cada pessoa pode ajustar o seu em “Meu perfil”."
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

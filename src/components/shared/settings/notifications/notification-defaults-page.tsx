import { Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type KindDefaults,
  listKindDefaults,
  saveKindDefaults,
} from "@/lib/shared/notifications/defaults.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

const parseDays = (text: string): number[] | null => {
  const days = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number);
  if (days.length === 0 || days.length > 5) return null;
  return days.every((day) => Number.isInteger(day) && day >= 0 && day <= 30) ? days : null;
};

function KindCard({ kind }: { kind: KindDefaults }) {
  const { run, busy } = useServerAction();
  const initialDays = (kind.defaultLeadDays ?? []).join(", ");
  const [days, setDays] = useState(initialDays);
  const [email, setEmail] = useState(kind.defaultEmail);
  const parsed = parseDays(days);
  const invalid = kind.schedulable && parsed === null;
  const dirty = days !== initialDays || email !== kind.defaultEmail;

  return (
    <SectionCard as="div" title={kind.title}>
      <div className="flex flex-wrap items-end gap-4">
        <span className="flex items-center gap-2 text-sm">
          <Switch id={`default-email-${kind.kind}`} checked={email} onCheckedChange={setEmail} />
          <Label htmlFor={`default-email-${kind.kind}`}>Enviar também por e-mail</Label>
        </span>
        {kind.schedulable ? (
          <div className="space-y-1">
            <Label htmlFor={`default-days-${kind.kind}`}>Antecedência padrão (dias)</Label>
            <Input
              id={`default-days-${kind.kind}`}
              className="h-11 w-40 md:h-10"
              value={days}
              aria-invalid={invalid ? true : undefined}
              onChange={(event) => setDays(event.target.value)}
            />
          </div>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={busy || invalid || !dirty}
          onClick={() =>
            void run(
              () =>
                saveKindDefaults({
                  data: {
                    kind: kind.kind,
                    defaultLeadDays: kind.schedulable ? parsed : null,
                    defaultEmail: email,
                  },
                }),
              { success: "Padrão salvo.", invalidate: [QueryKey.Notifications.defaults()] },
            )
          }
        >
          <Save aria-hidden="true" />
          Salvar
        </Button>
      </div>
      {invalid ? (
        <p role="alert" className="text-xs text-destructive">
          Use de 1 a 5 números de 0 a 30, separados por vírgula.
        </p>
      ) : null}
    </SectionCard>
  );
}

export function NotificationDefaultsPage() {
  const query = useQuery({
    queryKey: QueryKey.Notifications.defaults(),
    queryFn: async () => unwrapResult(await listKindDefaults()).kinds,
  });

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
      <div className="grid gap-4 md:grid-cols-2">
        {(query.data ?? []).map((kind) => (
          <KindCard
            key={`${kind.kind}-${kind.defaultEmail}-${(kind.defaultLeadDays ?? []).join()}`}
            kind={kind}
          />
        ))}
      </div>
    </div>
  );
}

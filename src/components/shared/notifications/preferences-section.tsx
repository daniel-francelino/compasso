import { EmptyState } from "@/components/shared/admin/empty-state";
import { Save, BellOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { ListSkeleton } from "@/components/shared/admin/skeletons";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type PreferenceRow,
  listPreferences,
  savePreference,
} from "@/lib/shared/notifications/notifications.functions";
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

function LeadDays({
  row,
  busy,
  onSave,
}: {
  row: PreferenceRow;
  busy: boolean;
  onSave: (days: number[] | null) => void;
}) {
  const initial = (row.leadDays ?? row.defaultLeadDays ?? []).join(", ");
  const [text, setText] = useState(initial);
  const parsed = parseDays(text);
  const invalid = text.trim() !== "" && parsed === null;

  return (
    <div className="flex w-full flex-wrap items-end gap-2 pt-2">
      <div className="space-y-1">
        <Label htmlFor={`lead-${row.kind}`}>Avisar com antecedência (dias)</Label>
        <Input
          id={`lead-${row.kind}`}
          className="h-11 w-40 md:h-10"
          value={text}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={busy || invalid || text === initial}
        onClick={() => onSave(text.trim() === "" ? null : parsed)}
      >
        <Save aria-hidden="true" />
        Salvar prazos
      </Button>
      {invalid ? (
        <p role="alert" className="text-xs text-destructive">
          Use até 5 números de 0 a 30, separados por vírgula.
        </p>
      ) : null}
    </div>
  );
}

export function PreferencesSection() {
  const { run, busy } = useServerAction();
  const query = useQuery({
    queryKey: QueryKey.Notifications.preferences(),
    queryFn: async () => unwrapResult(await listPreferences()).preferences,
  });

  const change = (
    row: PreferenceRow,
    patch: Partial<Pick<PreferenceRow, "enabled" | "email" | "leadDays">>,
  ) =>
    run(
      () =>
        savePreference({
          data: {
            kind: row.kind,
            enabled: patch.enabled ?? row.enabled,
            email: patch.email ?? row.email,
            leadDays: patch.leadDays === undefined ? row.leadDays : patch.leadDays,
          },
        }),
      { invalidate: [QueryKey.Notifications.preferences()] },
    );

  return (
    <SectionCard title="Avisos" as="section">
      {query.isPending ? <ListSkeleton rows={3} height="h-12" /> : null}
      {query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.data?.length === 0 ? (
        <EmptyState
          compact
          icon={BellOff}
          title="Nenhum aviso configurável"
          description="Nenhum tipo de aviso disponível para você ainda."
        />
      ) : null}
      <ul className="divide-y divide-border">
        {(query.data ?? []).map((row) => (
          <li key={row.kind} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="font-medium">{row.title}</span>
            <span className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <Switch
                  id={`pref-${row.kind}`}
                  checked={row.enabled}
                  disabled={busy}
                  onCheckedChange={(enabled) => void change(row, { enabled })}
                />
                <Label htmlFor={`pref-${row.kind}`}>No Compasso</Label>
              </span>
              <span className="flex items-center gap-2">
                <Switch
                  id={`pref-email-${row.kind}`}
                  checked={row.email}
                  disabled={busy || !row.enabled}
                  onCheckedChange={(email) => void change(row, { email })}
                />
                <Label htmlFor={`pref-email-${row.kind}`}>Por e-mail</Label>
              </span>
            </span>
            {row.schedulable ? (
              <LeadDays
                row={row}
                busy={busy}
                onSave={(leadDays) => void change(row, { leadDays })}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

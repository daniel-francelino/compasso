import { BellOff } from "lucide-react";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import { type PreferenceDraft, draftInvalid } from "@/lib/shared/notifications/preference-drafts";
import type { PreferenceRow } from "@/lib/shared/notifications/notifications.functions";

export function PreferencesFields({
  rows,
  drafts,
  onChange,
  disabled,
}: {
  rows: PreferenceRow[];
  drafts: Record<string, PreferenceDraft>;
  onChange: (kind: string, patch: Partial<PreferenceDraft>) => void;
  disabled: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={BellOff}
        title="Nenhum aviso configurável"
        description="Nenhum tipo de aviso disponível para você ainda."
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const draft = drafts[row.kind];
        if (draft === undefined) return null;
        const invalid = draftInvalid(row, draft);
        return (
          <li key={row.kind} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="font-medium">{row.title}</span>
            <span className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-2">
                <Switch
                  id={`pref-${row.kind}`}
                  checked={draft.enabled}
                  disabled={disabled}
                  onCheckedChange={(enabled) => onChange(row.kind, { enabled })}
                />
                <Label htmlFor={`pref-${row.kind}`}>No Compasso</Label>
              </span>
              <span className="flex items-center gap-2">
                <Switch
                  id={`pref-email-${row.kind}`}
                  checked={draft.email}
                  disabled={disabled || !draft.enabled}
                  onCheckedChange={(email) => onChange(row.kind, { email })}
                />
                <Label htmlFor={`pref-email-${row.kind}`}>Por e-mail</Label>
              </span>
            </span>
            {row.schedulable ? (
              <div className="w-full space-y-1 pt-2">
                <Label htmlFor={`lead-${row.kind}`}>Avisar com antecedência (dias)</Label>
                <Input
                  id={`lead-${row.kind}`}
                  className="h-11 w-40 md:h-10"
                  value={draft.days}
                  disabled={disabled}
                  aria-invalid={invalid ? true : undefined}
                  onChange={(event) => onChange(row.kind, { days: event.target.value })}
                />
                {invalid ? (
                  <p role="alert" className="text-xs text-destructive">
                    Use até 5 números de 0 a 30, separados por vírgula.
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

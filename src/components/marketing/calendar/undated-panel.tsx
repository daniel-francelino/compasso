import { CalendarPlus } from "lucide-react";
import { WhyDisabled } from "@/components/shared/admin/why-disabled";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import type { UndatedEntry } from "@/lib/shared/calendar/types";
import { platformLabels } from "@/lib/shared/labels";

export const UNDATED_PREFIX = "undated:";

export function UndatedPanel({
  entries,
  canPlan,
  onPlan,
}: {
  entries: UndatedEntry[];
  canPlan: boolean;
  onPlan: (entry: UndatedEntry) => void;
}) {
  return (
    <section
      aria-labelledby="undated-title"
      className="space-y-2 rounded-xl border border-border bg-card p-3"
    >
      <h2 id="undated-title" className="text-sm font-semibold">
        Sem data
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todo conteúdo já tem data.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const blocked = entry.channelArchived
              ? "O canal está arquivado. Reative o canal ou escolha outro."
              : null;
            return (
              <li
                key={entry.variantId}
                draggable={canPlan && blocked === null}
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", `${UNDATED_PREFIX}${entry.variantId}`);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className="space-y-1.5 rounded-lg border border-border p-2 text-sm"
              >
                <p className="font-medium">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.brandName} · {platformLabels[entry.platform]} {entry.profileName}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <EditorialStatusBadge status={entry.editorialStatus} />
                  {canPlan ? (
                    <WhyDisabled reason={blocked}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={blocked !== null}
                        onClick={() => onPlan(entry)}
                      >
                        <CalendarPlus aria-hidden="true" />
                        Planejar…
                      </Button>
                    </WhyDisabled>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

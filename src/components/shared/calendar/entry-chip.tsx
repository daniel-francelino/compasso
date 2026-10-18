import { TriangleAlert } from "lucide-react";
import { statusTones } from "@/components/shared/admin/status-tones";
import { type GridItem, itemLabel } from "@/lib/shared/calendar/grid-item";
import { cn } from "@/lib/shared/utils";

export function EntryChip({ item, onSelect }: { item: GridItem; onSelect: (key: string) => void }) {
  const style = statusTones[item.tone];
  const Icon = item.icon;
  return (
    <button
      type="button"
      draggable={item.movable}
      aria-label={itemLabel(item)}
      title={item.alerts.join(". ") || undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.key);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onSelect(item.key)}
      className={cn(
        "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        item.movable && "cursor-grab active:cursor-grabbing",
        style.box,
      )}
    >
      <Icon className={cn("size-3 shrink-0", style.icon)} aria-hidden="true" />
      {item.time === "" ? null : (
        <span className="shrink-0 font-medium tabular-nums">{item.time}</span>
      )}
      <span className="truncate">{item.title}</span>
      {item.alerts.length > 0 ? (
        <TriangleAlert className="ml-auto size-3 shrink-0 text-warning" aria-hidden="true" />
      ) : null}
    </button>
  );
}

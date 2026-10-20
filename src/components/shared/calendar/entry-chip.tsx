import { CircleCheck, Clock3, Eye, Link2, TriangleAlert } from "lucide-react";
import { statusTones } from "@/components/shared/admin/status-tones";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import { type GridItem, StatusMark, itemLabel } from "@/lib/shared/calendar/grid-item";
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
        item.muted && "opacity-60",
        style.box,
      )}
    >
      {item.platform === null ? (
        <Icon className={cn("size-3.5 shrink-0", style.icon)} aria-hidden="true" />
      ) : (
        <PlatformIcon platform={item.platform} className="size-3.5 shrink-0" />
      )}
      {item.time === "" ? null : (
        <span className="shrink-0 font-medium tabular-nums">{item.time}</span>
      )}
      <span className="truncate">{item.title}</span>
      {item.alerts.length > 0 ? (
        <TriangleAlert className="ml-auto size-3 shrink-0 text-warning" aria-hidden="true" />
      ) : null}
      {item.mark === StatusMark.Published ? (
        <CircleCheck className="ml-auto size-3.5 shrink-0 text-success" aria-hidden="true" />
      ) : null}
      {item.mark === StatusMark.Scheduled ? (
        <Clock3 className="ml-auto size-3.5 shrink-0 text-warning" aria-hidden="true" />
      ) : null}
      {item.mark === StatusMark.Shared ? (
        <Eye className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      {item.mark === StatusMark.Converted ? (
        <Link2 className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
    </button>
  );
}

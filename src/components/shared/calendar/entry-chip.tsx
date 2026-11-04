import { statusTones } from "@/components/shared/admin/status-tones";
import { formatIcons } from "@/components/shared/content/format-icons";
import { PlatformIcon } from "@/components/shared/preview/platform-icon";
import type { ContentFormat } from "@/lib/shared/enums";
import { type GridItem, itemLabel } from "@/lib/shared/calendar/grid-item";
import { cn } from "@/lib/shared/utils";

function FormatMark({ format }: { format: ContentFormat }) {
  const Icon = formatIcons[format];
  return <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

export function EntryChip({ item, onSelect }: { item: GridItem; onSelect: (key: string) => void }) {
  const style = statusTones[item.tone];
  const Icon = item.icon;
  return (
    <button
      type="button"
      draggable={item.movable}
      aria-label={itemLabel(item)}
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
      {item.platform === null || item.format === null ? null : <FormatMark format={item.format} />}
      {item.time === "" ? null : (
        <span className="shrink-0 font-medium tabular-nums">{item.time}</span>
      )}
      <span className="truncate">{item.title}</span>
    </button>
  );
}

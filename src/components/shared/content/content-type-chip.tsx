import type { ContentTypeRow } from "@/lib/shared/content-types/content-types.functions";
import { ContentTypeColor } from "@/lib/shared/enums";
import { cn } from "@/lib/shared/utils";

const colorClasses: Record<ContentTypeColor, string> = {
  [ContentTypeColor.Violet]: "border-violet/50 bg-violet/30",
  [ContentTypeColor.Orchid]: "border-orchid/50 bg-orchid/30",
  [ContentTypeColor.Rose]: "border-rose/50 bg-rose/30",
  [ContentTypeColor.Peach]: "border-peach/50 bg-peach/30",
  [ContentTypeColor.Coral]: "border-coral/50 bg-coral/30",
  [ContentTypeColor.Sage]: "border-sage/50 bg-sage/30",
  [ContentTypeColor.Cactus]: "border-cactus/50 bg-cactus/30",
  [ContentTypeColor.InkSoft]: "border-ink-soft/50 bg-ink-soft/30",
};

export function ContentTypeChip({
  type,
  className,
}: {
  type: Pick<ContentTypeRow, "name" | "color" | "emoji">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-sm text-foreground",
        colorClasses[type.color],
        className,
      )}
    >
      {type.emoji ? <span aria-hidden="true">{type.emoji}</span> : null}
      <span className="truncate">{type.name}</span>
    </span>
  );
}

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { HighlightTone } from "@/lib/shared/metrics/highlights";

const icons = {
  [HighlightTone.Good]: ArrowUpRight,
  [HighlightTone.Bad]: ArrowDownRight,
  [HighlightTone.Neutral]: Info,
} as const;

export function HighlightList({
  items,
}: {
  items: { id: string; text: string; tone: HighlightTone }[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = icons[item.tone];
        return (
          <li key={item.id} className="flex items-start gap-2 text-sm text-foreground">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {item.text}
          </li>
        );
      })}
    </ul>
  );
}

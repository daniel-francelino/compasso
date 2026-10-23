import { FileText, Film, ImageOff, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { MediaScope } from "@/lib/shared/enums";
import { formatBytes } from "@/lib/shared/format";
import { MediaKind } from "@/lib/shared/media/limits";
import type { MediaRow } from "@/lib/shared/media/media.functions";
import { cn } from "@/lib/shared/utils";

const scopeSuffix: Record<MediaScope, string> = {
  [MediaScope.Site]: " · Site",
  [MediaScope.Brand]: "",
  [MediaScope.Profile]: " · Foto de perfil",
};

function Thumb({ item }: { item: MediaRow }) {
  if (item.thumbUrl !== null) {
    return <img src={item.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />;
  }
  const Icon =
    item.kind === MediaKind.Video ? Film : item.kind === MediaKind.Document ? FileText : ImageOff;
  return <Icon className="size-8 text-muted-foreground" aria-hidden="true" />;
}

export function MediaGrid({
  items,
  selectedIds,
  onToggle,
  onOpen,
  openLabel = "Abrir",
  sharedIds,
  renderMenu,
}: {
  items: MediaRow[];
  selectedIds: string[];
  onToggle: (item: MediaRow, checked: boolean) => void;
  onOpen: (item: MediaRow) => void;
  openLabel?: string;
  sharedIds?: ReadonlySet<string>;
  renderMenu?: (item: MediaRow) => ReactNode;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        return (
          <li
            key={item.id}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-card",
              selected ? "border-primary ring-2 ring-primary" : "border-border",
            )}
          >
            <div className="absolute left-2 top-2 z-10 rounded bg-surface p-1">
              <Checkbox
                checked={selected}
                aria-label={`Selecionar ${item.name}`}
                onCheckedChange={(checked) => onToggle(item, checked === true)}
              />
            </div>
            {renderMenu ? (
              <div className="absolute right-1 top-1 z-10">{renderMenu(item)}</div>
            ) : null}
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${openLabel}: ${item.name}`}
            >
              <span className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                <Thumb item={item} />
              </span>
              <span className="block space-y-0.5 p-2">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                {sharedIds?.has(item.id) ? (
                  <StatusBadge tone="info" icon={Share2}>
                    Compartilhado
                  </StatusBadge>
                ) : null}
                <span className="block truncate text-xs text-muted-foreground">
                  {formatBytes(item.sizeBytes)}
                  {item.brandName ? ` · ${item.brandName}` : scopeSuffix[item.scope]}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

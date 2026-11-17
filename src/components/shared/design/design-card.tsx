import { Link } from "@tanstack/react-router";
import {
  EllipsisVertical,
  LayoutTemplate,
  PenTool,
  RectangleVertical,
  Smartphone,
  Square,
} from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import type { DesignRow } from "@/lib/shared/design/design.functions";
import {
  DESIGN_PRESET_SHORT_LABEL,
  DESIGN_PRESET_SIZE,
  DesignPreset,
} from "@/lib/shared/design/types";
import { formatEdited } from "@/lib/shared/format";
import { cn } from "@/lib/shared/utils";

export type DesignCardAction = {
  id: string;
  label: string;
  icon: typeof PenTool;
  destructive?: boolean;
  onSelect: (row: DesignRow) => void;
};

const PRESET_ICON: Record<DesignPreset, { icon: typeof Square; tint: string }> = {
  [DesignPreset.FeedSquare]: { icon: Square, tint: "text-violet" },
  [DesignPreset.FeedPortrait]: { icon: RectangleVertical, tint: "text-coral-dark" },
  [DesignPreset.Story]: { icon: Smartphone, tint: "text-orchid" },
};

const PLACEHOLDER_HEIGHT = 70;

function Preview({ row, thumbUrl }: { row: DesignRow; thumbUrl: string | undefined }) {
  const [broken, setBroken] = useState(false);
  if (thumbUrl !== undefined && !broken) {
    return (
      <img
        src={thumbUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className="max-h-full max-w-full rounded-sm object-contain shadow-md"
      />
    );
  }
  const size = DESIGN_PRESET_SIZE[row.preset];
  return (
    <span
      className="flex items-center justify-center rounded-sm border border-line-strong bg-surface shadow-md"
      style={{
        height: `${PLACEHOLDER_HEIGHT}%`,
        aspectRatio: `${size.width} / ${size.height}`,
      }}
    >
      <PenTool aria-hidden="true" className="size-6 text-muted-foreground" />
    </span>
  );
}

export function DesignCard({
  row,
  thumbUrl,
  actions,
}: {
  row: DesignRow;
  thumbUrl: string | undefined;
  actions: DesignCardAction[];
}) {
  const preset = PRESET_ICON[row.preset];
  const PresetIcon = preset.icon;
  return (
    <li className="group relative min-w-0">
      <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-xl bg-muted p-3 transition-colors group-hover:bg-line">
        <Preview row={row} thumbUrl={thumbUrl} />
        {row.isTemplate ? (
          <span className="absolute top-2 left-2">
            <StatusBadge tone="info" icon={LayoutTemplate}>
              Modelo
            </StatusBadge>
          </span>
        ) : null}
        {actions.length === 0 ? null : (
          <div className="absolute top-1.5 right-1.5 z-10 opacity-100 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 bg-surface"
                  aria-label={`Ações de ${row.name}`}
                >
                  <EllipsisVertical aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenuItem
                      key={action.id}
                      className={action.destructive ? "text-destructive" : undefined}
                      onSelect={() => action.onSelect(row)}
                    >
                      <Icon aria-hidden="true" />
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        {row.trashed ? (
          <p className="truncate text-sm font-semibold">{row.name}</p>
        ) : (
          <Link
            to="/admin/marketing/designs/$designId"
            params={{ designId: row.id }}
            className="block truncate text-sm font-semibold text-foreground after:absolute after:inset-x-0 after:top-0 after:aspect-4/3 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {row.name}
          </Link>
        )}
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <PresetIcon aria-hidden="true" className={cn("size-3.5 shrink-0", preset.tint)} />
          <span className="truncate">
            {DESIGN_PRESET_SHORT_LABEL[row.preset]} · {row.brandName}
          </span>
          <span aria-hidden="true">•</span>
          <span className="shrink-0">{formatEdited(row.updatedAt)}</span>
        </p>
      </div>
    </li>
  );
}

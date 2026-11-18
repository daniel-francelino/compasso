import { Keyboard, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { IconButton } from "@/components/shared/admin/icon-button";
import { DesignPagesStrip } from "@/components/shared/design/design-pages-strip";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";
import { zoomPercent } from "@/lib/shared/design/viewport";

function CursorPosition({ viewport }: { viewport: DesignViewport }) {
  const point = useSyncExternalStore(viewport.cursor.subscribe, viewport.cursor.get, () => null);
  return (
    <span className="hidden w-32 font-mono text-xs tabular-nums text-muted-foreground md:inline">
      {point === null ? "" : `X ${Math.round(point.x)} · Y ${Math.round(point.y)}`}
    </span>
  );
}

function ZoomField({ viewport }: { viewport: DesignViewport }) {
  const current = viewport.view === null ? 100 : zoomPercent(viewport.view.zoom);
  const [value, setValue] = useState(String(current));

  useEffect(() => setValue(String(current)), [current]);

  const apply = () => {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) viewport.zoomTo(parsed / 100);
    else setValue(String(current));
  };

  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="sr-only">Zoom em porcentagem</span>
      <Input
        value={value}
        inputMode="decimal"
        min={DESIGN_LIMITS.minViewZoom * 100}
        max={DESIGN_LIMITS.maxViewZoom * 100}
        className="h-8 w-16 text-right tabular-nums"
        onChange={(event) => setValue(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
      />
      %
    </label>
  );
}

export function DesignStatusBar({
  editor,
  viewport,
  editable,
  size,
  onShortcuts,
}: {
  editor: DesignEditor;
  viewport: DesignViewport;
  editable: boolean;
  size: PageSize;
  onShortcuts: () => void;
}) {
  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t bg-card px-3 py-1">
      <DesignPagesStrip editor={editor} editable={editable} />
      <span className="ml-auto hidden text-xs tabular-nums text-muted-foreground sm:inline">
        {size.width} × {size.height} px
      </span>
      <CursorPosition viewport={viewport} />
      <div className="flex items-center gap-1">
        <IconButton label="Diminuir zoom (Ctrl+-)" icon={Minus} onClick={() => viewport.step(-1)} />
        <ZoomField viewport={viewport} />
        <IconButton label="Aumentar zoom (Ctrl+=)" icon={Plus} onClick={() => viewport.step(1)} />
        <IconButton label="Ajustar à tela (Ctrl+0)" icon={Maximize} onClick={viewport.fit} />
        <Button type="button" variant="ghost" size="sm" onClick={viewport.actualSize}>
          100%
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onShortcuts}>
        <Keyboard aria-hidden="true" />
        Atalhos
      </Button>
    </footer>
  );
}

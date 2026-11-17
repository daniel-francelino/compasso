import { Keyboard, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { IconButton } from "@/components/shared/admin/icon-button";
import { DesignPagesStrip } from "@/components/shared/design/design-pages-strip";
import { Button } from "@/components/shared/ui/button";
import { Input } from "@/components/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shared/ui/popover";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";
import { zoomPercent } from "@/lib/shared/design/viewport";

const SHORTCUTS: [string, string][] = [
  ["V · T · R · E · L · I · H · Z", "Ferramentas"],
  ["Espaço + arrastar", "Mover a visualização"],
  ["Ctrl + roda", "Zoom no cursor"],
  ["Ctrl + 0 / Ctrl + 1", "Ajustar à tela / 100%"],
  ["Ctrl + = / Ctrl + -", "Aumentar / diminuir zoom"],
  ["Setas (Shift: 10 px)", "Mover a seleção"],
  ["Ctrl + A", "Selecionar tudo"],
  ["Ctrl + D", "Duplicar"],
  ["Ctrl + G / Ctrl + Shift + G", "Agrupar / desagrupar"],
  ["Ctrl + Z / Ctrl + Shift + Z", "Desfazer / refazer"],
  ["Delete", "Excluir"],
  ["Duplo clique no texto", "Editar o texto na página"],
  ["Esc", "Voltar para Mover / limpar a seleção"],
];

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

function ShortcutsHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Keyboard aria-hidden="true" />
          Atalhos
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <h2 className="mb-2 text-sm font-semibold">Atalhos do teclado</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt className="font-mono text-muted-foreground">{keys}</dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function DesignStatusBar({
  editor,
  viewport,
  editable,
  size,
}: {
  editor: DesignEditor;
  viewport: DesignViewport;
  editable: boolean;
  size: PageSize;
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
      <ShortcutsHelp />
    </footer>
  );
}

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Maximize,
  Minus,
  Plus,
} from "lucide-react";
import { IconButton } from "@/components/shared/admin/icon-button";
import { Divider, DesignSelectionTools } from "@/components/shared/design/design-selection-tools";
import { Button } from "@/components/shared/ui/button";
import type { CropController } from "@/hooks/shared/design/use-design-crop";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignPaint } from "@/hooks/shared/design/use-design-paint";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import type { DesignViewport } from "@/hooks/shared/design/use-design-viewport";
import { normalizeColor } from "@/lib/shared/design/document";
import {
  DESIGN_ALIGN_LABEL,
  DesignElementKind,
  DesignTextAlign,
  type DesignTool,
  type PageSize,
} from "@/lib/shared/design/types";
import { zoomPercent } from "@/lib/shared/design/viewport";
import { cn } from "@/lib/shared/utils";

export type ToolOptionsProps = {
  editor: DesignEditor;
  viewport: DesignViewport;
  size: PageSize;
  paint: DesignPaint;
  selection: SelectionController;
  crop: CropController;
  tool: DesignTool;
};

const HINT_CLASS = "truncate text-sm text-muted-foreground";

const Hint = ({ text }: { text: string }) => <p className={HINT_CLASS}>{text}</p>;

const TEXT_ALIGN_ICONS = {
  [DesignTextAlign.Left]: AlignLeft,
  [DesignTextAlign.Center]: AlignCenter,
  [DesignTextAlign.Right]: AlignRight,
};

function OptionToggle({
  label,
  pressed,
  children,
  onClick,
}: {
  label: string;
  pressed: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(pressed && "bg-accent text-accent-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ColorOption({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm">
      {label}
      <input
        type="color"
        value={value}
        className="size-8 cursor-pointer rounded border bg-transparent p-0"
        onChange={(event) => {
          const color = normalizeColor(event.target.value);
          if (color !== null) onChange(color);
        }}
      />
    </label>
  );
}

export function MoveOptions({ editor, size }: ToolOptionsProps) {
  if (editor.selected.length === 0) {
    return (
      <Hint text="Clique para selecionar. Arraste no fundo para selecionar por área. Shift+clique adiciona." />
    );
  }
  return <DesignSelectionTools editor={editor} size={size} />;
}

export function TextOptions({ editor }: ToolOptionsProps) {
  const element = editor.single;
  if (element === undefined || element.kind !== DesignElementKind.Text) {
    return <Hint text="Clique ou arraste na página para criar uma caixa de texto." />;
  }
  const id = element.id;
  const disabled = element.locked;
  return (
    <>
      <OptionToggle
        label="Negrito"
        pressed={element.bold}
        onClick={() => !disabled && editor.patchText(id, { bold: !element.bold })}
      >
        <Bold aria-hidden="true" />
      </OptionToggle>
      <OptionToggle
        label="Itálico"
        pressed={element.italic}
        onClick={() => !disabled && editor.patchText(id, { italic: !element.italic })}
      >
        <Italic aria-hidden="true" />
      </OptionToggle>
      <Divider />
      {Object.values(DesignTextAlign).map((align) => {
        const Icon = TEXT_ALIGN_ICONS[align];
        return (
          <OptionToggle
            key={align}
            label={DESIGN_ALIGN_LABEL[align]}
            pressed={element.align === align}
            onClick={() => !disabled && editor.patchText(id, { align })}
          >
            <Icon aria-hidden="true" />
          </OptionToggle>
        );
      })}
      <Divider />
      <ColorOption
        label="Cor"
        value={element.color}
        onChange={(color) => !disabled && editor.patchText(id, { color }, `color:${id}`)}
      />
      <span className="ml-2 hidden truncate text-sm text-muted-foreground lg:inline">
        Fonte e tamanho ficam na aba Propriedades.
      </span>
    </>
  );
}

export function ShapeOptions({ editor }: ToolOptionsProps) {
  const element = editor.single;
  if (element === undefined || element.locked) {
    return <Hint text="Arraste na página para desenhar. Shift mantém a proporção." />;
  }
  const id = element.id;
  if (element.kind === DesignElementKind.Line) {
    return (
      <ColorOption
        label="Cor da linha"
        value={element.stroke}
        onChange={(stroke) => editor.patchLine(id, { stroke }, `stroke:${id}`)}
      />
    );
  }
  if (element.kind === DesignElementKind.Rect || element.kind === DesignElementKind.Ellipse) {
    return (
      <ColorOption
        label="Preenchimento"
        value={element.fill}
        onChange={(fill) => editor.patchShape(id, { fill }, `fill:${id}`)}
      />
    );
  }
  return <Hint text="Arraste na página para desenhar. Shift mantém a proporção." />;
}

export function ZoomOptions({ viewport }: ToolOptionsProps) {
  const percent = viewport.view === null ? 100 : zoomPercent(viewport.view.zoom);
  return (
    <>
      <IconButton label="Diminuir zoom (Ctrl+-)" icon={Minus} onClick={() => viewport.step(-1)} />
      <span className="w-14 text-center text-sm tabular-nums">{Math.round(percent)}%</span>
      <IconButton label="Aumentar zoom (Ctrl+=)" icon={Plus} onClick={() => viewport.step(1)} />
      <IconButton label="Ajustar à tela (Ctrl+0)" icon={Maximize} onClick={viewport.fit} />
      <Button type="button" variant="ghost" size="sm" onClick={viewport.actualSize}>
        100%
      </Button>
    </>
  );
}

export function HandOptions(props: ToolOptionsProps) {
  return (
    <>
      <ZoomOptions {...props} />
      <span className="ml-2 hidden truncate text-sm text-muted-foreground lg:inline">
        Arraste para mover a visualização. Segure Espaço para usar a qualquer hora.
      </span>
    </>
  );
}

export function UnavailableOptions() {
  return <Hint text="Ferramenta ainda indisponível." />;
}

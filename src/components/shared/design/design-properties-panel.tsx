import { Copy, Group, Lock, LockOpen, Trash2, Ungroup } from "lucide-react";
import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSlider } from "lost-ui/forms/form-slider";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { DesignImageProperties } from "@/components/shared/design/design-image-properties";
import { DesignShapeProperties } from "@/components/shared/design/design-shape-properties";
import { DesignTextProperties } from "@/components/shared/design/design-text-properties";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import { type ElementBasePatch, inRange, normalizeColor } from "@/lib/shared/design/document";
import type { DesignElement } from "@/lib/shared/design/schemas";
import {
  DESIGN_ELEMENT_LABEL,
  DESIGN_LIMITS,
  DesignElementKind,
  type DesignFont,
} from "@/lib/shared/design/types";

type NumberKey = "x" | "y" | "width" | "height" | "rotation";

const geometry: { key: NumberKey; label: string; min: number; max: number }[] = [
  { key: "x", label: "X", min: -DESIGN_LIMITS.maxCoordinate, max: DESIGN_LIMITS.maxCoordinate },
  { key: "y", label: "Y", min: -DESIGN_LIMITS.maxCoordinate, max: DESIGN_LIMITS.maxCoordinate },
  { key: "width", label: "Largura", min: DESIGN_LIMITS.minSize, max: DESIGN_LIMITS.maxSize },
  { key: "height", label: "Altura", min: DESIGN_LIMITS.minSize, max: DESIGN_LIMITS.maxSize },
  { key: "rotation", label: "Rotação (graus)", min: -360, max: 360 },
];

const first = (value: number | number[]) => (Array.isArray(value) ? (value[0] ?? 0) : value);

type PanelProps = {
  editor: DesignEditor;
  chrome: CanvasChrome | null;
  editable: boolean;
  swatches: string[];
  brandFonts: readonly DesignFont[];
};

function PageProperties({ editor, chrome, editable, swatches }: PanelProps) {
  const background = editor.page.background;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Selecione um elemento no design ou na lista de camadas para editar. Shift+clique seleciona
        vários.
      </p>
      <FormSwitch
        name="hasBackground"
        label="Cor de fundo"
        description="Sem cor de fundo, a página fica transparente (só pode ser exportada em PNG)."
        value={background !== null}
        disabled={!editable || chrome === null}
        onValueChange={(on) =>
          editor.setBackground(on ? (swatches[0] ?? chrome?.surface ?? null) : null)
        }
      />
      {background === null ? null : (
        <FormColorPicker
          name="background"
          label="Fundo"
          value={background}
          swatches={swatches}
          disabled={!editable}
          onValueChange={(value) => {
            const color = normalizeColor(value);
            if (color !== null) editor.setBackground(color, `background:${editor.pageId}`);
          }}
        />
      )}
    </div>
  );
}

function KindProperties({
  element,
  disabled,
  ...props
}: PanelProps & { element: DesignElement; disabled: boolean }) {
  if (element.kind === DesignElementKind.Text) {
    return (
      <DesignTextProperties
        element={element}
        editor={props.editor}
        disabled={disabled}
        swatches={props.swatches}
        brandFonts={props.brandFonts}
      />
    );
  }
  if (element.kind === DesignElementKind.Image) {
    return <DesignImageProperties element={element} editor={props.editor} disabled={disabled} />;
  }
  return (
    <DesignShapeProperties
      element={element}
      editor={props.editor}
      disabled={disabled}
      swatches={props.swatches}
    />
  );
}

function SelectionActions({ editor }: { editor: DesignEditor }) {
  const ids = editor.selectedIds;
  const locked = editor.selected.every((element) => element.locked);
  const grouped = editor.selected.some((element) => element.groupId !== null);
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={locked ? "Desbloquear" : "Bloquear"}
        aria-pressed={locked}
        onClick={() => editor.patchMany(ids.map((id) => ({ id, patch: { locked: !locked } })))}
      >
        {locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Duplicar (Ctrl+D)"
        disabled={!editor.canAdd(ids.length)}
        onClick={() => editor.duplicate(ids)}
      >
        <Copy aria-hidden="true" />
      </Button>
      {ids.length > 1 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={grouped ? "Desagrupar (Ctrl+Shift+G)" : "Agrupar (Ctrl+G)"}
          onClick={grouped ? editor.ungroup : editor.group}
        >
          {grouped ? <Ungroup aria-hidden="true" /> : <Group aria-hidden="true" />}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Excluir"
        className="text-destructive hover:text-destructive"
        onClick={() => editor.remove(ids)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
}

export function DesignPropertiesPanel(props: PanelProps) {
  const { editor, editable } = props;
  const element = editor.single;
  const count = editor.selected.length;

  if (count === 0) {
    return (
      <section aria-labelledby="design-properties-title" className="space-y-3">
        <h2 id="design-properties-title" className="text-sm font-semibold">
          Página
        </h2>
        <PageProperties {...props} />
      </section>
    );
  }

  const title =
    element === undefined ? `${count} elementos selecionados` : DESIGN_ELEMENT_LABEL[element.kind];
  const disabled = !editable || (element?.locked ?? false);

  const setNumber = (field: (typeof geometry)[number], value: number | null) => {
    if (element === undefined || !inRange(value, field.min, field.max)) return;
    const patch: ElementBasePatch = { [field.key]: value };
    editor.patch(element.id, patch, `${field.key}:${element.id}`);
  };

  return (
    <section aria-labelledby="design-properties-title" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="design-properties-title" className="text-sm font-semibold">
          {title}
        </h2>
        {editable ? <SelectionActions editor={editor} /> : null}
      </div>
      {element?.locked && editable ? (
        <p className="text-sm text-muted-foreground">
          Este elemento está bloqueado. Desbloqueie para mover ou editar.
        </p>
      ) : null}
      {element === undefined ? (
        <p className="text-sm text-muted-foreground">
          Arraste qualquer um deles para mover todos. Use Agrupar para mantê-los juntos.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {geometry.map((field) => (
              <FormInputNumber
                key={field.key}
                name={field.key}
                label={field.label}
                value={Math.round(element[field.key])}
                min={field.min}
                max={field.max}
                disabled={
                  disabled || (field.key === "height" && element.kind === DesignElementKind.Text)
                }
                onValueChange={(value) => setNumber(field, value)}
              />
            ))}
          </div>
          <FormSlider
            name="opacity"
            label="Opacidade"
            value={Math.round(element.opacity * 100)}
            min={0}
            max={100}
            step={1}
            showValue
            disabled={disabled}
            onValueChange={(value) =>
              editor.patch(element.id, { opacity: first(value) / 100 }, `opacity:${element.id}`)
            }
          />
          <KindProperties {...props} element={element} disabled={disabled} />
        </>
      )}
    </section>
  );
}

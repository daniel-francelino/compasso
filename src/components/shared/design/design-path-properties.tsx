import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormInputNumber } from "lost-ui/forms/form-input-number";
import { FormSelect } from "lost-ui/forms/form-select";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { DesignPathStops } from "@/components/shared/design/design-path-stops";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { inRange, normalizeColor, rgbToHex } from "@/lib/shared/design/document";
import { defaultPathStroke, isGradient, solidPaint } from "@/lib/shared/design/path";
import type { PathElement } from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DesignPathCap,
  DesignPathFillRule,
  DesignPathJoin,
  DesignPathPaintKind,
} from "@/lib/shared/design/types";

const PAINT_ITEMS = [
  { value: DesignPathPaintKind.Solid, label: "Sólido" },
  { value: DesignPathPaintKind.Linear, label: "Linear" },
  { value: DesignPathPaintKind.Radial, label: "Radial" },
];
const RULE_ITEMS = [
  { value: DesignPathFillRule.NonZero, label: "Não zero" },
  { value: DesignPathFillRule.EvenOdd, label: "Par-ímpar" },
];
const CAP_ITEMS = [
  { value: DesignPathCap.Butt, label: "Plana" },
  { value: DesignPathCap.Round, label: "Arredondada" },
  { value: DesignPathCap.Square, label: "Quadrada" },
];
const JOIN_ITEMS = [
  { value: DesignPathJoin.Miter, label: "Pontiaguda" },
  { value: DesignPathJoin.Round, label: "Arredondada" },
  { value: DesignPathJoin.Bevel, label: "Chanfrada" },
];

type SectionProps = {
  element: PathElement;
  editor: DesignEditor;
  disabled: boolean;
  swatches: string[];
};

const switchPaint = (fill: NonNullable<PathElement["fill"]>, kind: string): PathElement["fill"] => {
  if (kind === fill.kind) return fill;
  const color = isGradient(fill) ? (fill.stops[0]?.color ?? rgbToHex(0, 0, 0)) : fill.color;
  if (kind === DesignPathPaintKind.Solid) return solidPaint(color);
  const stops = isGradient(fill)
    ? fill.stops
    : [
        { offset: 0, color, alpha: 1 },
        { offset: 1, color: rgbToHex(255, 255, 255), alpha: 1 },
      ];
  if (kind === DesignPathPaintKind.Linear) {
    return { kind, x1: 0, y1: 0.5, x2: 1, y2: 0.5, stops };
  }
  if (kind === DesignPathPaintKind.Radial) return { kind, cx: 0.5, cy: 0.5, r: 0.5, stops };
  return fill;
};

function FillSection({ element, editor, disabled, swatches }: SectionProps) {
  const id = element.id;
  const fill = element.fill;
  const fallback = swatches[0] ?? rgbToHex(0, 0, 0);
  return (
    <section aria-labelledby={`path-fill-${id}`} className="space-y-3">
      <h3 id={`path-fill-${id}`} className="text-sm font-semibold">
        Preenchimento
      </h3>
      <FormSwitch
        name="pathNoFill"
        label="Sem preenchimento"
        value={fill === null}
        disabled={disabled}
        onValueChange={(none) => editor.patchPath(id, { fill: none ? null : solidPaint(fallback) })}
      />
      {fill === null ? null : (
        <>
          <FormSelect
            name="pathPaintKind"
            label="Tipo"
            value={fill.kind}
            items={PAINT_ITEMS}
            disabled={disabled}
            onValueChange={(kind) => editor.patchPath(id, { fill: switchPaint(fill, kind) })}
          />
          {fill.kind === DesignPathPaintKind.Solid ? (
            <FormColorPicker
              name="pathFillColor"
              label="Cor de preenchimento"
              value={fill.color}
              swatches={swatches}
              disabled={disabled}
              onValueChange={(value) => {
                const color = normalizeColor(value);
                if (color === null) return;
                editor.patchPath(id, { fill: solidPaint(color) }, `pathFillColor:${id}`);
              }}
            />
          ) : (
            <DesignPathStops
              id={id}
              paint={fill}
              editor={editor}
              disabled={disabled}
              swatches={swatches}
            />
          )}
          <FormSelect
            name="pathFillRule"
            label="Regra de preenchimento"
            description="Define como áreas sobrepostas e furos são preenchidos."
            value={element.fillRule}
            items={RULE_ITEMS}
            disabled={disabled}
            onValueChange={(value) => {
              const fillRule = RULE_ITEMS.find((item) => item.value === value)?.value;
              if (fillRule !== undefined) editor.patchPath(id, { fillRule });
            }}
          />
        </>
      )}
    </section>
  );
}

function StrokeSection({ element, editor, disabled, swatches }: SectionProps) {
  const id = element.id;
  const stroke = element.stroke;
  const fallback = swatches[0] ?? rgbToHex(0, 0, 0);
  return (
    <section aria-labelledby={`path-stroke-${id}`} className="space-y-3">
      <h3 id={`path-stroke-${id}`} className="text-sm font-semibold">
        Contorno
      </h3>
      <FormSwitch
        name="pathNoStroke"
        label="Sem contorno"
        value={stroke === null}
        disabled={disabled}
        onValueChange={(none) =>
          editor.patchPath(id, { stroke: none ? null : defaultPathStroke(fallback) })
        }
      />
      {stroke === null ? null : (
        <>
          <FormColorPicker
            name="pathStrokeColor"
            label="Cor do contorno"
            value={stroke.color}
            swatches={swatches}
            disabled={disabled}
            onValueChange={(value) => {
              const color = normalizeColor(value);
              if (color === null) return;
              editor.patchPath(id, { stroke: { ...stroke, color } }, `pathStrokeColor:${id}`);
            }}
          />
          <FormInputNumber
            name="pathStrokeWidth"
            label="Espessura"
            value={stroke.width}
            min={DESIGN_LIMITS.minPathStrokeWidth}
            max={DESIGN_LIMITS.maxPathStrokeWidth}
            disabled={disabled}
            onValueChange={(width) => {
              const min = DESIGN_LIMITS.minPathStrokeWidth;
              if (!inRange(width, min, DESIGN_LIMITS.maxPathStrokeWidth)) return;
              editor.patchPath(id, { stroke: { ...stroke, width } }, `pathStrokeWidth:${id}`);
            }}
          />
          <FormSelect
            name="pathStrokeCap"
            label="Extremidade"
            value={stroke.cap}
            items={CAP_ITEMS}
            disabled={disabled}
            onValueChange={(value) => {
              const cap = CAP_ITEMS.find((item) => item.value === value)?.value;
              if (cap !== undefined) editor.patchPath(id, { stroke: { ...stroke, cap } });
            }}
          />
          <FormSelect
            name="pathStrokeJoin"
            label="Junções"
            value={stroke.join}
            items={JOIN_ITEMS}
            disabled={disabled}
            onValueChange={(value) => {
              const join = JOIN_ITEMS.find((item) => item.value === value)?.value;
              if (join !== undefined) editor.patchPath(id, { stroke: { ...stroke, join } });
            }}
          />
          <FormInputNumber
            name="pathMiterLimit"
            label="Limite da junção"
            description="Só vale para junções pontiagudas."
            value={stroke.miterLimit}
            min={DESIGN_LIMITS.minMiterLimit}
            max={DESIGN_LIMITS.maxMiterLimit}
            disabled={disabled}
            onValueChange={(miterLimit) => {
              if (!inRange(miterLimit, DESIGN_LIMITS.minMiterLimit, DESIGN_LIMITS.maxMiterLimit)) {
                return;
              }
              editor.patchPath(id, { stroke: { ...stroke, miterLimit } }, `pathMiter:${id}`);
            }}
          />
          <FormSwitch
            name="pathDashed"
            label="Tracejado"
            value={stroke.dashed}
            disabled={disabled}
            onValueChange={(dashed) => editor.patchPath(id, { stroke: { ...stroke, dashed } })}
          />
        </>
      )}
    </section>
  );
}

export function DesignPathProperties(props: SectionProps) {
  const { element } = props;
  return (
    <div className="space-y-4">
      <FillSection {...props} />
      <StrokeSection {...props} />
      {element.fill === null && element.stroke === null ? (
        <p className="text-sm text-muted-foreground">
          Este vetor está sem preenchimento e sem contorno, por isso não aparece.
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Os pontos do desenho não podem ser editados aqui. Para alterá-los, edite o desenho no
        programa de origem e importe de novo.
      </p>
    </div>
  );
}

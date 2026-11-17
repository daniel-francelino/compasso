import { FormColorPicker } from "lost-ui/forms/form-color-picker";
import { FormSlider } from "lost-ui/forms/form-slider";
import { FormSwitch } from "lost-ui/forms/form-switch";
import { DesignImageProperties } from "@/components/shared/design/design-image-properties";
import { DesignShapeProperties } from "@/components/shared/design/design-shape-properties";
import { DesignTextProperties } from "@/components/shared/design/design-text-properties";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { CanvasChrome } from "@/lib/shared/design/browser";
import { normalizeColor } from "@/lib/shared/design/document";
import type { DesignElement } from "@/lib/shared/design/schemas";
import {
  DESIGN_ELEMENT_LABEL,
  DesignElementKind,
  type DesignFont,
} from "@/lib/shared/design/types";

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
        Selecione um elemento no design ou em “Camadas” para editar.
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

  return (
    <section aria-labelledby="design-properties-title" className="space-y-4">
      <h2 id="design-properties-title" className="text-sm font-semibold">
        {title}
      </h2>
      {element?.locked && editable ? (
        <p className="text-sm text-muted-foreground">
          Este elemento está bloqueado. Desbloqueie para mover ou editar.
        </p>
      ) : null}
      {element === undefined ? (
        <p className="text-sm text-muted-foreground">
          As propriedades são editadas um elemento por vez. Use “Transformar” para mover ou
          redimensionar todos.
        </p>
      ) : (
        <>
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

import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { imageNaturalSize } from "@/lib/shared/design/browser";
import { createImage } from "@/lib/shared/design/document";
import type { DesignBrandKit } from "@/lib/shared/design/design.functions";
import {
  DESIGN_FONT_LABEL,
  DesignElementKind,
  type DesignFont,
  type DesignPreset,
} from "@/lib/shared/design/types";

const FULL = "O design chegou ao limite de elementos. Remova algum para adicionar outro.";

const applyColor = (editor: DesignEditor, hex: string) => {
  if (editor.selected.length === 0) {
    editor.setBackground(hex);
    return;
  }
  for (const element of editor.selected) {
    if (element.kind === DesignElementKind.Text) editor.patchText(element.id, { color: hex });
    if (element.kind === DesignElementKind.Line) editor.patchLine(element.id, { stroke: hex });
    if (element.kind === DesignElementKind.Rect || element.kind === DesignElementKind.Ellipse) {
      editor.patchShape(element.id, { fill: hex });
    }
  }
};

const applyFont = (editor: DesignEditor, font: DesignFont) => {
  for (const element of editor.selected) {
    if (element.kind === DesignElementKind.Text) editor.patchText(element.id, { font });
  }
};

export function DesignBrandPanel({
  editor,
  kit,
  loading,
  preset,
  brandFonts,
  editable,
}: {
  editor: DesignEditor;
  kit: DesignBrandKit | undefined;
  loading: boolean;
  preset: DesignPreset;
  brandFonts: readonly DesignFont[];
  editable: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Carregando a marca…</p>;
  if (kit === undefined) {
    return <p className="text-sm text-muted-foreground">Não foi possível carregar a marca.</p>;
  }
  const hasText = editor.selected.some((element) => element.kind === DesignElementKind.Text);
  const unknownFonts = kit.fonts.filter(
    (name) =>
      !brandFonts.some(
        (font) => DESIGN_FONT_LABEL[font].toLowerCase() === name.trim().toLowerCase(),
      ),
  );
  const logoId = kit.logoVersionId;

  const addLogo = async () => {
    if (logoId === null) return;
    if (!editor.canAdd()) {
      toast.error(FULL);
      return;
    }
    const natural = await imageNaturalSize(logoId);
    editor.add(createImage(editor.newId(), preset, logoId, natural));
  };

  return (
    <section aria-labelledby="design-brand-title" className="space-y-4">
      <h2 id="design-brand-title" className="text-sm font-semibold">
        Marca
      </h2>
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Logo</h3>
        {logoId === null ? (
          <p className="text-sm text-muted-foreground">A marca ainda não tem logo cadastrado.</p>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!editable}
            onClick={() => void addLogo()}
          >
            <ImagePlus aria-hidden="true" />
            Adicionar o logo
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Cores</h3>
        {kit.colors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma cor cadastrada na identidade.</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {kit.colors.map((color) => (
                <li key={`${color.name}${color.hex}`}>
                  <button
                    type="button"
                    disabled={!editable}
                    onClick={() => applyColor(editor, color.hex)}
                    className="flex min-h-11 items-center gap-2 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <span
                      aria-hidden="true"
                      className="size-6 rounded border"
                      style={{ backgroundColor: color.hex }}
                    />
                    {color.name}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Aplica a cor aos elementos selecionados ou ao fundo da página.
            </p>
          </>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">Fontes</h3>
        {brandFonts.length === 0 && unknownFonts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada na identidade.</p>
        ) : null}
        <ul className="flex flex-wrap gap-2">
          {brandFonts.map((font) => (
            <li key={font}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!editable || !hasText}
                onClick={() => applyFont(editor, font)}
              >
                {DESIGN_FONT_LABEL[font]}
              </Button>
            </li>
          ))}
        </ul>
        {brandFonts.length > 0 ? (
          <p className="text-xs text-muted-foreground">Selecione um texto para aplicar a fonte.</p>
        ) : null}
        {unknownFonts.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Fora da lista do editor: {unknownFonts.join(", ")}.
          </p>
        ) : null}
      </div>
    </section>
  );
}

import {
  Circle,
  Download,
  Group,
  History,
  Images,
  Minus,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  Ungroup,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MediaPicker } from "@/components/shared/media/media-picker";
import { Button } from "@/components/shared/ui/button";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { type CanvasChrome, imageNaturalSize } from "@/lib/shared/design/browser";
import { createImage, createLine, createShape, createText } from "@/lib/shared/design/document";
import type { DesignElement } from "@/lib/shared/design/schemas";
import { type DesignPreset, DesignElementKind } from "@/lib/shared/design/types";
import { MediaScope } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";

const IMAGE_KINDS = [MediaKind.Image] as const;
const FULL = "O design chegou ao limite de elementos. Remova algum para adicionar outro.";
const NO_CHROME = "Não foi possível ler as cores do tema. Recarregue a página.";

type AddSpec = {
  label: string;
  icon: typeof Type;
  create: (id: string, preset: DesignPreset, palette: CanvasChrome) => DesignElement;
};

const ADDERS: AddSpec[] = [
  { label: "Texto", icon: Type, create: createText },
  {
    label: "Retângulo",
    icon: Square,
    create: (id, preset, palette) => createShape(id, DesignElementKind.Rect, preset, palette),
  },
  {
    label: "Elipse",
    icon: Circle,
    create: (id, preset, palette) => createShape(id, DesignElementKind.Ellipse, preset, palette),
  },
  { label: "Linha", icon: Minus, create: createLine },
];

export function DesignToolbar({
  editor,
  preset,
  brandId,
  chrome,
  editable,
  canExport,
  savingVersion,
  onSaveVersion,
  onVersions,
  onExport,
}: {
  editor: DesignEditor;
  preset: DesignPreset;
  brandId: string;
  chrome: CanvasChrome | null;
  editable: boolean;
  canExport: boolean;
  savingVersion: boolean;
  onSaveVersion: () => void;
  onVersions: () => void;
  onExport: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const full = !editor.canAdd();
  const grouped = editor.selected.some((element) => element.groupId !== null);

  const add = (spec: AddSpec) => {
    if (full) {
      toast.error(FULL);
      return;
    }
    if (chrome === null) {
      toast.error(NO_CHROME);
      return;
    }
    editor.add(spec.create(editor.newId(), preset, chrome));
  };

  const addImage = async (versionId: string) => {
    const natural = await imageNaturalSize(versionId);
    if (!editor.add(createImage(editor.newId(), preset, versionId, natural))) toast.error(FULL);
  };

  return (
    <div
      role="toolbar"
      aria-label="Ferramentas do design"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
    >
      {editable ? (
        <>
          {ADDERS.map((spec) => (
            <Button
              key={spec.label}
              type="button"
              variant="outline"
              size="sm"
              disabled={full}
              title={full ? FULL : undefined}
              onClick={() => add(spec)}
            >
              <spec.icon aria-hidden="true" />
              {spec.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            title={full ? FULL : undefined}
            onClick={() => setPicking(true)}
          >
            <Images aria-hidden="true" />
            Imagem
          </Button>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={grouped ? "Desagrupar (Ctrl+Shift+G)" : "Agrupar (Ctrl+G)"}
            title={grouped ? "Desagrupar (Ctrl+Shift+G)" : "Agrupar (Ctrl+G)"}
            disabled={grouped ? false : editor.selected.length < 2}
            onClick={grouped ? editor.ungroup : editor.group}
          >
            {grouped ? <Ungroup aria-hidden="true" /> : <Group aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Desfazer (Ctrl+Z)"
            title="Desfazer (Ctrl+Z)"
            disabled={!editor.canUndo}
            onClick={editor.undo}
          >
            <Undo2 aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refazer (Ctrl+Shift+Z)"
            title="Refazer (Ctrl+Shift+Z)"
            disabled={!editor.canRedo}
            onClick={editor.redo}
          >
            <Redo2 aria-hidden="true" />
          </Button>
        </>
      ) : (
        <p className="px-2 text-sm text-muted-foreground">Somente leitura.</p>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onVersions}>
          <History aria-hidden="true" />
          Versões
        </Button>
        {editable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={savingVersion}
            onClick={onSaveVersion}
          >
            <Save aria-hidden="true" />
            Salvar versão
          </Button>
        ) : null}
        {editable && canExport ? (
          <Button type="button" size="sm" onClick={onExport}>
            <Download aria-hidden="true" />
            Exportar
          </Button>
        ) : null}
      </div>
      <MediaPicker
        open={picking}
        onOpenChange={setPicking}
        scope={MediaScope.Brand}
        brandId={brandId}
        kinds={IMAGE_KINDS}
        onConfirm={(picked) => {
          const first = picked[0];
          if (first !== undefined) void addImage(first.versionId);
        }}
      />
    </div>
  );
}

import { Contrast, Plus } from "lucide-react";
import { type DragEvent, useState } from "react";
import { Button } from "@/components/shared/ui/button";
import { DesignLayerRow, type DropMark } from "@/components/shared/design/design-layer-row";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { MaskController } from "@/hooks/shared/design/use-design-mask";
import {
  LAYER_MASK_KIND_LABEL,
  LayerMaskKind,
  MASK_ADD_LABEL,
} from "@/lib/shared/design/layer-mask";
import { dropTargetIndex } from "@/lib/shared/design/layers";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import type { RasterizableElement } from "@/lib/shared/design/rasterize";
import { LayerMove } from "@/lib/shared/design/types";

const announcement = (position: number, total: number) =>
  `Camada movida para a posição ${position} de ${total}`;

export function DesignLayersPanel({
  editor,
  editable,
  onAddRaster,
  onRasterize,
  failedIds,
  store,
  masks,
}: {
  editor: DesignEditor;
  editable: boolean;
  onAddRaster: () => void;
  onRasterize: (element: RasterizableElement) => void;
  failedIds: ReadonlySet<string>;
  store: RasterStore;
  masks: MaskController;
}) {
  const elements = editor.page.elements;
  const ordered = [...elements].reverse();
  const total = elements.length;
  const [message, setMessage] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const announce = (index: number) => {
    const clamped = Math.min(total - 1, Math.max(0, index));
    setMessage(announcement(total - clamped, total));
  };

  const moveByStep = (id: string, move: LayerMove) => {
    const index = elements.findIndex((element) => element.id === id);
    const target = move === LayerMove.Up ? index + 1 : index - 1;
    if (target < 0 || target >= total) return;
    editor.move(id, move);
    announce(target);
  };

  const endDrag = () => {
    setDragId(null);
    setInsertAt(null);
  };

  const overRow = (event: DragEvent<HTMLLIElement>, displayIndex: number) => {
    if (dragId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const box = event.currentTarget.getBoundingClientRect();
    const below = event.clientY > box.top + box.height / 2;
    setInsertAt(below ? displayIndex + 1 : displayIndex);
  };

  const dropOnList = (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const from = ordered.findIndex((element) => element.id === dragId);
    if (dragId !== null && insertAt !== null && from >= 0) {
      const target = dropTargetIndex(total, from, insertAt);
      editor.moveTo(dragId, target);
      announce(target);
    }
    endDrag();
  };

  const markOf = (displayIndex: number): DropMark => {
    if (insertAt === null) return null;
    if (insertAt === displayIndex) return "before";
    if (insertAt === total && displayIndex === total - 1) return "after";
    return null;
  };

  return (
    <section aria-labelledby="design-layers-title" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="design-layers-title" className="text-sm font-semibold">
          Camadas
        </h2>
        {editable ? (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={masks.createReason(LayerMaskKind.RevealAll) !== undefined}
              title={
                masks.createReason(LayerMaskKind.RevealAll) ??
                `${MASK_ADD_LABEL}: ${LAYER_MASK_KIND_LABEL[LayerMaskKind.RevealAll]}`
              }
              onClick={() => masks.create(LayerMaskKind.RevealAll)}
            >
              <Contrast aria-hidden="true" />
              Máscara
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!editor.canAdd()}
              onClick={onAddRaster}
            >
              <Plus aria-hidden="true" />
              Nova camada
            </Button>
          </div>
        ) : null}
      </div>
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum elemento nesta página. Use a barra de ferramentas para adicionar texto, imagem,
          forma ou linha.
        </p>
      ) : (
        <ol className="space-y-1" aria-label="Camadas da página, da frente para trás">
          {ordered.map((element, displayIndex) => (
            <DesignLayerRow
              key={element.id}
              editor={editor}
              element={element}
              selected={editor.selectedIds.includes(element.id)}
              editable={editable}
              store={store}
              masks={masks}
              pixelsFailed={failedIds.has(element.id)}
              onRasterize={onRasterize}
              canMoveUp={displayIndex > 0}
              canMoveDown={displayIndex < total - 1}
              renaming={renamingId === element.id}
              dropMark={markOf(displayIndex)}
              onRenameStart={() => setRenamingId(element.id)}
              onRenameEnd={() => setRenamingId(null)}
              onMove={(move) => moveByStep(element.id, move)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", element.id);
                setDragId(element.id);
              }}
              onDragOver={(event) => overRow(event, displayIndex)}
              onDrop={dropOnList}
              onDragEnd={endDrag}
            />
          ))}
        </ol>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      {editable && ordered.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Arraste para reordenar ou use Alt + seta para cima ou para baixo na camada. F2 renomeia.
        </p>
      ) : null}
    </section>
  );
}

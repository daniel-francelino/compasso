import { useState } from "react";
import { toast } from "sonner";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import {
  LAYER_MASK_KIND_LABEL,
  type LayerMaskKind,
  MASK_DELETE_LABEL,
  MASK_DISABLE_LABEL,
  MASK_ENABLE_LABEL,
  MASK_MEMORY_MESSAGE,
  MASK_MISSING_REASON,
  MASK_PAINT_LABEL,
  NEW_LAYER_MASK,
  type PaintTarget,
  buildMaskBuffer,
  isMaskable,
  maskCreateReason,
  maskKey,
  maskPixelSize,
} from "@/lib/shared/design/layer-mask";
import { selectionForLayer } from "@/lib/shared/design/selection-state";

export type MaskController = {
  targetId: string | null;
  viewId: string | null;
  createReason: (kind: LayerMaskKind) => string | undefined;
  deleteReason: string | undefined;
  create: (kind: LayerMaskKind) => void;
  remove: (id: string) => void;
  toggleEnabled: (id: string) => void;
  toggleView: (id: string) => void;
  target: (id: string | null) => void;
  paintTarget: () => PaintTarget | null;
};

export const useDesignMask = ({
  editor,
  rasters,
  selection,
}: {
  editor: DesignEditor;
  rasters: RasterHandle;
  selection: SelectionController;
}): MaskController => {
  const [targetId, setTargetId] = useState<string | null>(null);
  const { store, maskView, setMaskView } = rasters;
  const single = editor.single;
  const hasSelection = selection.mask !== null;

  const find = (id: string) => editor.page.elements.find((element) => element.id === id);

  const create = (kind: LayerMaskKind) => {
    if (single === undefined || !isMaskable(single)) return;
    if (maskCreateReason(single, kind, hasSelection) !== undefined) return;
    const { width, height } = maskPixelSize(single);
    const placement = { ...single, pixelWidth: width, pixelHeight: height };
    const layerSelection =
      selection.mask === null ? null : selectionForLayer(selection.mask, placement);
    const key = maskKey(single.id);
    if (!store.set(key, buildMaskBuffer(kind, width, height, layerSelection))) {
      toast.error(MASK_MEMORY_MESSAGE);
      return;
    }
    store.markChanged(key);
    const id = single.id;
    editor.named(`${MASK_PAINT_LABEL}: ${LAYER_MASK_KIND_LABEL[kind]}`, () =>
      editor.patch(id, { mask: NEW_LAYER_MASK }),
    );
    setTargetId(id);
  };

  const remove = (id: string) => {
    editor.named(MASK_DELETE_LABEL, () => editor.patch(id, { mask: null }));
    if (targetId === id) setTargetId(null);
    if (maskView === id) setMaskView(null);
  };

  const toggleEnabled = (id: string) => {
    const mask = find(id)?.mask;
    if (mask === null || mask === undefined) return;
    const label = mask.enabled ? MASK_DISABLE_LABEL : MASK_ENABLE_LABEL;
    editor.named(label, () => editor.patch(id, { mask: { ...mask, enabled: !mask.enabled } }));
  };

  const paintTarget = (): PaintTarget | null => {
    if (single === undefined || targetId !== single.id || single.mask === null) return null;
    if (single.locked || single.hidden) return null;
    const buffer = store.get(maskKey(single.id));
    if (buffer === undefined) return null;
    return {
      key: maskKey(single.id),
      placement: { ...single, pixelWidth: buffer.width, pixelHeight: buffer.height },
      mask: true,
    };
  };

  return {
    targetId,
    viewId: maskView,
    createReason: (kind) => maskCreateReason(single, kind, hasSelection),
    deleteReason: single?.mask === null || single === undefined ? MASK_MISSING_REASON : undefined,
    create,
    remove,
    toggleEnabled,
    toggleView: (id) => setMaskView(maskView === id ? null : id),
    target: setTargetId,
    paintTarget,
  };
};

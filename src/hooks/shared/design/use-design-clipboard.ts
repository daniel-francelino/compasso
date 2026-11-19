import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RASTER_MEMORY_MESSAGE, type RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import type { DesignPaint } from "@/hooks/shared/design/use-design-paint";
import type { SelectionController } from "@/hooks/shared/design/use-design-selection";
import {
  isTypingTarget,
  readClipboardImage,
  writeClipboardImage,
} from "@/lib/shared/design/browser";
import { PAINT_REASON, PAINT_UPLOAD_REASON } from "@/lib/shared/design/paint";
import {
  CUT_LABEL,
  LAYER_VIA_COPY_LABEL,
  LAYER_VIA_CUT_LABEL,
  NOTHING_SELECTED,
  NOTHING_TO_PASTE,
  NO_PIXELS_TO_COPY,
  PASTE_LABEL,
  PASTE_TOO_LARGE,
  type ClipPlacement,
  type PixelClip,
  centerPlacement,
  copyRegion,
  exceedsRasterSide,
  fittedPlacement,
  pasteCenter,
  pastedLayer,
  regionPlacement,
} from "@/lib/shared/design/pixel-clipboard";
import { pixelToolReason } from "@/lib/shared/design/rasterize";
import { blobToBuffer, bufferToPng } from "@/lib/shared/design/raster-canvas";
import { type PixelBuffer, clonePixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { DesignElementKind, type PageSize } from "@/lib/shared/design/types";

const FULL = "O design chegou ao limite de elementos. Remova algum para adicionar outro.";

export type ClipboardController = {
  copyReason: string | undefined;
  cutReason: string | undefined;
  pasteReason: string | undefined;
  copy: () => void;
  cut: () => void;
  paste: (inPlace: boolean) => void;
  layerViaCopy: () => void;
  layerViaCut: () => void;
};

type Grabbed = { buffer: PixelBuffer; placement: ClipPlacement };

export const useDesignClipboard = ({
  editor,
  rasters,
  paint,
  selection,
  size,
  canPaint,
  editable,
}: {
  editor: DesignEditor;
  rasters: RasterHandle;
  paint: DesignPaint;
  selection: SelectionController;
  size: PageSize;
  canPaint: boolean;
  editable: boolean;
}): ClipboardController => {
  const { store } = rasters;
  const clip = useRef<PixelClip | null>(null);
  const layer = editor.single?.kind === DesignElementKind.Raster ? editor.single : null;
  const usable = layer !== null && !layer.locked && !layer.hidden;

  const copyReason = layer === null ? pixelToolReason(NO_PIXELS_TO_COPY, editor.single) : undefined;
  const writeReason = (): string | undefined => {
    if (!canPaint) return PAINT_UPLOAD_REASON;
    return usable ? undefined : pixelToolReason(PAINT_REASON, editor.single);
  };
  const cutReason = copyReason ?? writeReason();
  const pasteReason = canPaint ? undefined : PAINT_UPLOAD_REASON;

  const grab = (): Grabbed | null => {
    const buffer = layer === null ? undefined : store.get(layer.id);
    if (layer === null || buffer === undefined) return null;
    const copied = copyRegion(buffer, selection.layerMask(layer));
    if (copied === null) {
      toast.error(NOTHING_SELECTED);
      return null;
    }
    return { buffer: copied.buffer, placement: regionPlacement(layer, copied.region) };
  };

  const remember = (grabbed: Grabbed) => {
    const next: PixelClip = { ...grabbed, systemBytes: null };
    clip.current = next;
    void bufferToPng(grabbed.buffer).then(async (blob) => {
      if (blob === null || clip.current !== next) return;
      if (await writeClipboardImage(blob)) next.systemBytes = blob.size;
    });
  };

  const fits = (buffer: PixelBuffer): boolean => {
    if (!editor.canAdd()) {
      toast.error(FULL);
      return false;
    }
    if (exceedsRasterSide(buffer)) {
      toast.error(PASTE_TOO_LARGE);
      return false;
    }
    if (!store.canAllocate(buffer.width, buffer.height)) {
      toast.error(RASTER_MEMORY_MESSAGE);
      return false;
    }
    return true;
  };

  const insert = (buffer: PixelBuffer, placement: ClipPlacement, label: string): boolean => {
    if (!fits(buffer)) return false;
    const owned = clonePixelBuffer(buffer);
    const id = editor.newId();
    if (!store.set(id, owned)) {
      toast.error(RASTER_MEMORY_MESSAGE);
      return false;
    }
    store.markChanged(id);
    editor.named(label, () => editor.add(pastedLayer(id, editor.page, size, owned, placement)));
    return true;
  };

  const place = async (inPlace: boolean, system: Blob | null) => {
    const memory = clip.current;
    const useMemory =
      memory !== null &&
      (system === null || memory.systemBytes === null || memory.systemBytes === system.size);
    if (useMemory) {
      const where = inPlace
        ? memory.placement
        : centerPlacement(memory.placement, pasteCenter(size, selection.mask));
      insert(memory.buffer, where, PASTE_LABEL);
      return;
    }
    const buffer = system === null ? null : await blobToBuffer(system, store.canAllocate);
    if (buffer === null) {
      toast.error(NOTHING_TO_PASTE);
      return;
    }
    const fitted = fittedPlacement(buffer, size);
    insert(buffer, centerPlacement(fitted, pasteCenter(size, selection.mask)), PASTE_LABEL);
  };

  const imageOf = (event: ClipboardEvent): File | null => {
    for (const item of event.clipboardData?.items ?? []) {
      if (item.type.startsWith("image/")) return item.getAsFile();
    }
    return null;
  };

  const onPasteEvent = (event: ClipboardEvent) => {
    if (!editable || !canPaint || isTypingTarget(event.target)) return;
    event.preventDefault();
    void place(false, imageOf(event));
  };
  const latestPaste = useRef(onPasteEvent);
  latestPaste.current = onPasteEvent;

  useEffect(() => {
    const listener = (event: ClipboardEvent) => latestPaste.current(event);
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);

  return {
    copyReason,
    cutReason,
    pasteReason,
    copy: () => {
      const grabbed = copyReason === undefined ? grab() : null;
      if (grabbed !== null) remember(grabbed);
    },
    cut: () => {
      const grabbed = cutReason === undefined ? grab() : null;
      if (grabbed === null) return;
      remember(grabbed);
      paint.clearSelected(CUT_LABEL);
    },
    paste: (inPlace) => {
      if (pasteReason !== undefined) return;
      void readClipboardImage().then((blob) => place(inPlace, blob));
    },
    layerViaCopy: () => {
      const grabbed = cutReason === undefined ? grab() : null;
      if (grabbed !== null) insert(grabbed.buffer, grabbed.placement, LAYER_VIA_COPY_LABEL);
    },
    layerViaCut: () => {
      const grabbed = cutReason === undefined ? grab() : null;
      if (grabbed === null || !fits(grabbed.buffer)) return;
      paint.clearSelected(LAYER_VIA_CUT_LABEL);
      insert(grabbed.buffer, grabbed.placement, LAYER_VIA_CUT_LABEL);
    },
  };
};

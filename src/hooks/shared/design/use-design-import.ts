import { useState } from "react";
import { toast } from "sonner";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { RASTER_MEMORY_MESSAGE, type RasterHandle } from "@/hooks/shared/design/use-raster-store";
import { pickFile } from "@/lib/shared/design/browser";
import {
  DESIGN_IMPORT_ACCEPT,
  DESIGN_IMPORT_FORMAT_LABEL,
  DESIGN_IMPORT_MESSAGE,
  IMPORT_UPLOAD_REASON,
  type ImportedDesign,
} from "@/lib/shared/design/design-import";
import { readDesignFile } from "@/lib/shared/design/import-file";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";

const IMPORTING = "Importando arquivo…";

export type DesignImporter = {
  reason: string | undefined;
  busy: boolean;
  open: () => void;
};

const totalBytes = (design: ImportedDesign): number => {
  let total = 0;
  for (const buffer of design.buffers.values()) total += rasterBytes(buffer.width, buffer.height);
  return total;
};

export const useDesignImport = ({
  editor,
  rasters,
  canPaint,
}: {
  editor: DesignEditor;
  rasters: RasterHandle;
  canPaint: boolean;
}): DesignImporter => {
  const { store } = rasters;
  const [busy, setBusy] = useState(false);
  const reason = canPaint ? undefined : IMPORT_UPLOAD_REASON;

  const place = (design: ImportedDesign): boolean => {
    if (!editor.canAdd(design.elements.length)) {
      toast.error(DESIGN_IMPORT_MESSAGE.tooManyLayers);
      return false;
    }
    if (store.usedBytes() + totalBytes(design) > DESIGN_LIMITS.rasterBudgetBytes) {
      toast.error(RASTER_MEMORY_MESSAGE);
      return false;
    }
    const placed: string[] = [];
    for (const [id, buffer] of design.buffers) {
      if (!store.set(id, buffer)) {
        for (const done of placed) store.release(done);
        toast.error(RASTER_MEMORY_MESSAGE);
        return false;
      }
      placed.push(id);
      store.markChanged(id);
    }
    const size: PageSize | null =
      editor.page.elements.length === 0 ? { width: design.width, height: design.height } : null;
    const label = `Importar ${DESIGN_IMPORT_FORMAT_LABEL[design.format]}`;
    return editor.addImported(design.elements, size, label);
  };

  const run = async () => {
    const file = await pickFile(DESIGN_IMPORT_ACCEPT);
    if (file === null) return;
    setBusy(true);
    const toastId = toast.loading(IMPORTING);
    const result = await readDesignFile(file, editor.newId);
    toast.dismiss(toastId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (!place(result.design)) return;
    const format = DESIGN_IMPORT_FORMAT_LABEL[result.design.format];
    toast.success(`${format} importado.`, {
      description: result.design.notes.join(" ") || undefined,
    });
  };

  return {
    reason,
    busy,
    open: () => {
      if (busy || reason !== undefined) return;
      void run();
    },
  };
};

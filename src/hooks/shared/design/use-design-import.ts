import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import {
  type ImportPlaced,
  type ImportPlacer,
  useImportPlace,
} from "@/hooks/shared/design/use-import-place";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import { pickFile } from "@/lib/shared/design/browser";
import {
  DESIGN_IMPORT_CANCEL_LABEL,
  DESIGN_IMPORT_MESSAGE,
  DESIGN_IMPORT_PROGRESS,
  IMPORT_UPLOAD_REASON,
  describeImportNotes,
  designImportDone,
  isImportCancelled,
} from "@/lib/shared/design/import/messages";
import { readDesignFile } from "@/lib/shared/design/import/read-file";
import { DESIGN_IMPORT_ACCEPT } from "@/lib/shared/design/import/registry";
import { DesignImportKind, type ImportKindResult } from "@/lib/shared/design/import/types";
import { logError } from "@/lib/shared/logger";
import { DESIGN_LIMITS, type DesignPreset } from "@/lib/shared/design/types";

export type DesignImporter = {
  reason: string | undefined;
  busy: boolean;
  open: () => void;
  cancel: () => void;
};

export type ImportRunDeps = {
  newId: () => string;
  existingElements: () => number;
  usedBytes: () => number;
  placer: () => ImportPlacer;
  allowed: () => boolean;
  onBusy: (busy: boolean) => void;
};

const place = (placer: ImportPlacer, result: ImportKindResult): ImportPlaced => {
  switch (result.kind) {
    case DesignImportKind.Document:
      return placer.document(result.design);
    case DesignImportKind.Image:
      return placer.image(result.design);
    default: {
      const unreachable: never = result;
      return unreachable;
    }
  }
};

export const createImportRun = (deps: ImportRunDeps) => {
  let running: AbortController | null = null;
  let disposed = false;

  const finishRead = (controller: AbortController, result: ImportKindResult): void => {
    if (disposed || controller.signal.aborted) return;
    const placed = place(deps.placer(), result);
    if (!placed.ok) {
      toast.error(placed.message);
      return;
    }
    toast.success(designImportDone(result.design.format), {
      description: describeImportNotes(placed.notes) || undefined,
    });
  };

  const reportRefusal = (message: string): void => {
    if (isImportCancelled(message) || disposed) return;
    toast.error(message);
  };

  const run = async (controller: AbortController): Promise<void> => {
    const file = await pickFile(DESIGN_IMPORT_ACCEPT);
    if (file === null || controller.signal.aborted || disposed) return;
    const toastId = toast.loading(DESIGN_IMPORT_PROGRESS, {
      action: { label: DESIGN_IMPORT_CANCEL_LABEL, onClick: () => controller.abort() },
    });
    try {
      const result = await readDesignFile(file, deps.newId, {
        capacityElements: Math.max(0, DESIGN_LIMITS.maxElements - deps.existingElements()),
        usedBytes: deps.usedBytes(),
        signal: controller.signal,
      });
      if (result.ok) finishRead(controller, result);
      else reportRefusal(result.message);
    } finally {
      toast.dismiss(toastId);
    }
  };

  return {
    isRunning: (): boolean => running !== null,
    open: async (): Promise<void> => {
      if (running !== null || disposed || !deps.allowed()) return;
      const controller = new AbortController();
      running = controller;
      deps.onBusy(true);
      try {
        await run(controller);
      } catch (error) {
        logError("import flow failed", error instanceof Error ? error.name : "unknown");
        if (!disposed) toast.error(DESIGN_IMPORT_MESSAGE.readFailed);
      } finally {
        running = null;
        if (!disposed) deps.onBusy(false);
      }
    },
    cancel: (): void => running?.abort(),
    mount: (): (() => void) => {
      disposed = false;
      return () => {
        disposed = true;
        running?.abort();
      };
    },
  };
};

export const useDesignImport = ({
  editor,
  rasters,
  canPaint,
  preset,
}: {
  editor: DesignEditor;
  rasters: RasterHandle;
  canPaint: boolean;
  preset: DesignPreset;
}): DesignImporter => {
  const { store } = rasters;
  const [busy, setBusy] = useState(false);
  const reason = canPaint ? undefined : IMPORT_UPLOAD_REASON;
  const placer = useImportPlace({ store, editor, preset });
  const latest = useRef({ editor, placer, canPaint });
  latest.current = { editor, placer, canPaint };
  const [run] = useState(() =>
    createImportRun({
      newId: () => latest.current.editor.newId(),
      existingElements: () => latest.current.editor.page.elements.length,
      usedBytes: () => store.usedBytes(),
      placer: () => latest.current.placer,
      allowed: () => latest.current.canPaint,
      onBusy: setBusy,
    }),
  );

  useEffect(() => run.mount(), [run]);

  return {
    reason,
    busy,
    open: () => void run.open(),
    cancel: run.cancel,
  };
};

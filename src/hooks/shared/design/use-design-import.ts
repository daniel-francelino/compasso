import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import {
  type ImportPlaced,
  type ImportPlacer,
  useImportPlace,
} from "@/hooks/shared/design/use-import-place";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import { recordDesignImport } from "@/lib/shared/design/design.functions";
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
import {
  DesignImportKind,
  IMPORT_NEEDS_CHOICE,
  type ImportChoice,
  type ImportKindResult,
  type ImportOutcome,
  type ImportPalette,
} from "@/lib/shared/design/import/types";
import { logError } from "@/lib/shared/logger";
import {
  type ImportedDesignMetadata,
  type StoredDesignMetadata,
  withoutText,
} from "@/lib/shared/design/import/metadata";
import type { Failure, Result } from "@/lib/shared/server-utils";
import { DESIGN_LIMITS, type DesignPreset, type PageSize } from "@/lib/shared/design/types";
import { pageSizeOf } from "@/lib/shared/design/crop";
import { databaseDocumentBytes } from "@/lib/shared/design/document-size";

export type DesignImporter = {
  reason: string | undefined;
  busy: boolean;
  open: () => void;
  cancel: () => void;
  pendingChoice: ImportChoice | null;
  answerChoice: (optionId: string) => void;
  cancelChoice: () => void;
};

type ImportRunDeps = {
  newId: () => string;
  existingElements: () => number;
  usedBytes: () => number;
  documentBytes?: () => number;
  pageSize?: () => PageSize;
  placer: () => ImportPlacer;
  allowed: () => boolean;
  onBusy: (busy: boolean) => void;
  record: (metadata: StoredDesignMetadata) => Promise<Result>;
  onChoice: (choice: ImportChoice | null) => void;
  onPalette: (palette: ImportPalette) => void;
};

type Settle = (optionId: string | null) => void;

type Finished = Exclude<ImportOutcome, { kind: typeof IMPORT_NEEDS_CHOICE }>;

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
  let pending: Settle | null = null;

  const recordMetadata = async (metadata: ImportedDesignMetadata): Promise<void> => {
    try {
      const saved = await deps.record(withoutText(metadata));
      if (saved.ok || disposed) return;
      logError("import metadata not saved", saved.code);
      toast.error(DESIGN_IMPORT_MESSAGE.metadataNotSaved);
    } catch (error) {
      logError("import metadata not saved", error instanceof Error ? error.name : "unknown");
      if (!disposed) toast.error(DESIGN_IMPORT_MESSAGE.metadataNotSaved);
    }
  };

  const finishRead = (controller: AbortController, result: Finished): void => {
    if (disposed || controller.signal.aborted) return;
    if (result.kind === DesignImportKind.Palette) {
      deps.onPalette(result.palette);
      return;
    }
    const placed = place(deps.placer(), result);
    if (!placed.ok) {
      toast.error(placed.message);
      return;
    }
    toast.success(designImportDone(result.design.format), {
      description: describeImportNotes(placed.notes) || undefined,
    });
    if (placed.metadata !== null) void recordMetadata(placed.metadata);
  };

  const reportRefusal = (failure: Failure): void => {
    if (isImportCancelled(failure) || disposed) return;
    toast.error(failure.message);
  };

  const showProgress = (controller: AbortController): string | number =>
    toast.loading(DESIGN_IMPORT_PROGRESS, {
      action: { label: DESIGN_IMPORT_CANCEL_LABEL, onClick: () => controller.abort() },
    });

  const ask = (controller: AbortController, choice: ImportChoice): Promise<string | null> =>
    new Promise((resolve) => {
      if (disposed || controller.signal.aborted) {
        resolve(null);
        return;
      }
      const settle: Settle = (optionId) => {
        controller.signal.removeEventListener("abort", onAbort);
        pending = null;
        if (!disposed) deps.onChoice(null);
        const offered = optionId !== null && choice.options.some((o) => o.id === optionId);
        resolve(offered ? optionId : null);
      };
      const onAbort = (): void => settle(null);
      controller.signal.addEventListener("abort", onAbort, { once: true });
      pending = settle;
      deps.onChoice(choice);
    });

  const run = async (controller: AbortController): Promise<void> => {
    const file = await pickFile(DESIGN_IMPORT_ACCEPT);
    if (file === null || controller.signal.aborted || disposed) return;
    let toastId = showProgress(controller);
    try {
      let result: Result<ImportOutcome> = await readDesignFile(file, deps.newId, {
        capacityElements: Math.max(0, DESIGN_LIMITS.maxElements - deps.existingElements()),
        usedBytes: deps.usedBytes(),
        documentBytes: deps.documentBytes?.(),
        page: deps.pageSize?.(),
        signal: controller.signal,
      });
      while (result.ok && result.kind === IMPORT_NEEDS_CHOICE) {
        const { choice, resume } = result;
        toast.dismiss(toastId);
        const optionId = await ask(controller, choice);
        if (optionId === null) return;
        toastId = showProgress(controller);
        result = await resume(optionId, controller.signal);
      }
      if (result.ok) finishRead(controller, result);
      else reportRefusal(result);
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
    answerChoice: (optionId: string): void => pending?.(optionId),
    cancelChoice: (): void => pending?.(null),
    mount: (): (() => void) => {
      disposed = false;
      return () => {
        disposed = true;
        pending?.(null);
        running?.abort();
      };
    },
  };
};

export const useDesignImport = ({
  designId,
  editor,
  rasters,
  canPaint,
  preset,
  onPalette,
}: {
  designId: string;
  editor: DesignEditor;
  rasters: RasterHandle;
  canPaint: boolean;
  preset: DesignPreset;
  onPalette?: ((palette: ImportPalette) => void) | undefined;
}): DesignImporter => {
  const { store } = rasters;
  const [busy, setBusy] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<ImportChoice | null>(null);
  const reason = canPaint ? undefined : IMPORT_UPLOAD_REASON;
  const placer = useImportPlace({ store, editor, preset });
  const latest = useRef({ designId, editor, placer, canPaint, onPalette, preset });
  latest.current = { designId, editor, placer, canPaint, onPalette, preset };
  const [run] = useState(() =>
    createImportRun({
      newId: () => latest.current.editor.newId(),
      existingElements: () => latest.current.editor.page.elements.length,
      usedBytes: () => store.usedBytes(),
      documentBytes: () => databaseDocumentBytes(latest.current.editor.document),
      pageSize: () => pageSizeOf(latest.current.editor.page, latest.current.preset),
      placer: () => latest.current.placer,
      allowed: () => latest.current.canPaint,
      onBusy: setBusy,
      onChoice: setPendingChoice,
      onPalette: (palette) => {
        const consumer = latest.current.onPalette;
        if (consumer === undefined) toast.error(DESIGN_IMPORT_MESSAGE.readFailed);
        else consumer(palette);
      },
      record: (metadata) => recordDesignImport({ data: { id: latest.current.designId, metadata } }),
    }),
  );

  useEffect(() => run.mount(), [run]);

  return {
    reason,
    busy,
    open: () => void run.open(),
    cancel: run.cancel,
    pendingChoice,
    answerChoice: run.answerChoice,
    cancelChoice: run.cancelChoice,
  };
};

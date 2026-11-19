import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import { RASTER_MEMORY_MESSAGE } from "@/hooks/shared/design/use-raster-store";
import { pageSizeOf } from "@/lib/shared/design/crop";
import {
  DESIGN_IMPORT_MESSAGE,
  designImportHistoryLabel,
} from "@/lib/shared/design/import/messages";
import {
  type ImportPlacement,
  type PageState,
  placeDocumentDesign,
  placeImageDesign,
} from "@/lib/shared/design/import/placement";
import type { ImportedDesignMetadata } from "@/lib/shared/design/import/metadata";
import type { ImportNote, ImportedDesign } from "@/lib/shared/design/import/types";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { type Result, invalid } from "@/lib/shared/server-utils";
import { DESIGN_LIMITS, type DesignPreset } from "@/lib/shared/design/types";

export type ImportPlaced = Result<{ notes: ImportNote[]; metadata: ImportedDesignMetadata | null }>;

export type ImportPlacer = {
  document: (design: ImportedDesign) => ImportPlaced;
  image: (design: ImportedDesign) => ImportPlaced;
};

type PlaceTarget = {
  store: Pick<RasterStore, "set" | "release" | "markChanged" | "usedBytes">;
  editor: Pick<DesignEditor, "page" | "canAdd" | "addImported">;
  preset: DesignPreset;
};

type Plan = (design: ImportedDesign, page: PageState) => ImportPlacement;

const totalBytes = (design: ImportedDesign): number => {
  let total = 0;
  for (const buffer of design.buffers.values()) total += rasterBytes(buffer.width, buffer.height);
  return total;
};

const pageState = ({ editor, preset }: PlaceTarget): PageState => ({
  ...pageSizeOf(editor.page, preset),
  empty: editor.page.elements.length === 0,
});

const storeAll = (store: PlaceTarget["store"], design: ImportedDesign): boolean => {
  const placed: string[] = [];
  for (const [id, buffer] of design.buffers) {
    if (!store.set(id, buffer)) {
      for (const done of placed) store.release(done);
      return false;
    }
    placed.push(id);
  }
  return true;
};

const commit = (target: PlaceTarget, design: ImportedDesign, plan: Plan): ImportPlaced => {
  const { store, editor } = target;
  if (!editor.canAdd(design.elements.length)) {
    return invalid(DESIGN_IMPORT_MESSAGE.tooManyLayers(DESIGN_LIMITS.maxElements));
  }
  if (store.usedBytes() + totalBytes(design) > DESIGN_LIMITS.rasterBudgetBytes) {
    return invalid(RASTER_MEMORY_MESSAGE);
  }
  const placement = plan(design, pageState(target));
  if (!storeAll(store, design)) return invalid(RASTER_MEMORY_MESSAGE);
  const label = designImportHistoryLabel(design.format);
  let added = false;
  try {
    added = editor.addImported(placement.elements, placement.size, label);
  } catch (error) {
    for (const id of design.buffers.keys()) store.release(id);
    throw error;
  }
  if (!added) {
    for (const id of design.buffers.keys()) store.release(id);
    return invalid(DESIGN_IMPORT_MESSAGE.tooManyLayers(DESIGN_LIMITS.maxElements));
  }
  for (const id of design.buffers.keys()) store.markChanged(id);
  return { ok: true, notes: placement.notes, metadata: design.metadata };
};

export const createImportPlacer = (target: PlaceTarget): ImportPlacer => ({
  document: (design) => commit(target, design, placeDocumentDesign),
  image: (design) => commit(target, design, placeImageDesign),
});

export const useImportPlace = (target: PlaceTarget): ImportPlacer => createImportPlacer(target);

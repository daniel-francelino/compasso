import { useMemo, useRef, useState } from "react";
import { type CropBox, cropPage } from "@/lib/shared/design/crop";
import {
  alignElements,
  distributeElements,
  selectAll,
  transformSelection,
} from "@/lib/shared/design/arrange";
import {
  type ElementBasePatch,
  type ElementPatch,
  type ImagePatch,
  type LinePatch,
  type Box,
  type ShapePatch,
  type TextPatch,
  addElement,
  addImportedLayers,
  createRasterLayer,
  addPage,
  canAddElements,
  canAddPage,
  duplicateElements,
  duplicatePage,
  emptyPage,
  expandSelection,
  findPage,
  groupElements,
  moveLayer,
  movePage,
  patchElement,
  patchElements,
  patchImage,
  patchLine,
  patchShape,
  patchText,
  removeElements,
  removePage,
  setBackground,
  ungroupElements,
  updatePage,
} from "@/lib/shared/design/document";
import {
  createAdjustmentLayer,
  insertAdjustment,
  patchAdjustment,
  toggleClipToBelow,
} from "@/lib/shared/design/adjustment-layers";
import type { AdjustmentParams } from "@/lib/shared/design/raster/adjustment-schemas";
import type { AdjustmentType } from "@/lib/shared/design/raster/adjustment-types";
import { type PixelsVersionEntry, retargetHistory } from "@/lib/shared/design/pixel-persist";
import { replaceElement } from "@/lib/shared/design/rasterize";
import { moveLayerTo } from "@/lib/shared/design/layers";
import { type History, collapseHistory, historyOf, pushHistory } from "@/lib/shared/design/history";
import type {
  DesignDocument,
  DesignElement,
  DesignPage,
  RasterElement,
} from "@/lib/shared/design/schemas";
import {
  type PixelSteps,
  inheritPixelStep,
  jumpTimeline,
  labelDocumentStep,
  markPixelStep,
  redoTimeline,
  timelineSteps,
  trimLostPixelSteps,
  undoTimeline,
} from "@/lib/shared/design/timeline";
import {
  DESIGN_LIMITS,
  type DesignAlign,
  type DesignDistribute,
  type LayerMove,
  type PageSize,
} from "@/lib/shared/design/types";

const TRANSFORM_LABEL = "Transformação livre";
const CROP_LABEL = "Cortar";

const newId = () => crypto.randomUUID();

const toggle = (page: DesignPage, current: readonly string[], id: string): string[] => {
  const group = expandSelection(page, [id]);
  return current.includes(id)
    ? current.filter((item) => !group.includes(item))
    : expandSelection(page, [...current, id]);
};

const NO_PIXELS: PixelSteps = {
  undo: () => true,
  redo: () => true,
  has: () => true,
  busy: () => false,
};

export const useDesignEditor = (initial: DesignDocument, pixels: PixelSteps = NO_PIXELS) => {
  const [history, setHistoryState] = useState<History<DesignDocument>>(() => historyOf(initial));
  const latest = useRef(history);
  latest.current = history;
  const setHistory = (
    update:
      History<DesignDocument> | ((current: History<DesignDocument>) => History<DesignDocument>),
  ) => {
    const next = typeof update === "function" ? update(latest.current) : update;
    latest.current = next;
    setHistoryState(next);
  };
  const [pageId, setPageId] = useState(() => initial.pages[0]?.id ?? "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const transformBase = useRef<History<DesignDocument> | null>(null);
  const [transforming, setTransforming] = useState(false);
  const document = history.present;
  const historyDocuments = useMemo(
    () => [...history.past, history.present, ...history.future],
    [history],
  );
  const fallback = document.pages[0] ?? emptyPage("page-1");
  const page = findPage(document, pageId) ?? fallback;
  const currentPageId = page.id;
  const selected = page.elements.filter((element) => selectedIds.includes(element.id));
  const single = selected.length === 1 ? selected[0] : undefined;

  const change = (update: (current: DesignDocument) => DesignDocument, mergeKey?: string) =>
    setHistory((current) =>
      pushHistory(current, update(current.present), DESIGN_LIMITS.history, mergeKey ?? null),
    );

  const changePage = (update: (current: DesignPage) => DesignPage, mergeKey?: string) =>
    change((current) => updatePage(current, currentPageId, update), mergeKey);

  const select = (id: string | null, additive = false) => {
    if (id === null) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds((current) =>
      additive ? toggle(page, current, id) : expandSelection(page, [id]),
    );
  };

  const add = (element: DesignElement): boolean => {
    if (!canAddElements(document)) return false;
    changePage((current) => addElement(current, element));
    setSelectedIds([element.id]);
    return true;
  };

  const remove = (ids: readonly string[]) => {
    changePage((current) => removeElements(current, ids));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  };

  const duplicate = (ids: readonly string[]) => {
    if (!canAddElements(document, ids.length)) return;
    const result = duplicateElements(page, ids, newId);
    changePage(() => result.page);
    setSelectedIds(result.ids);
  };

  const named = (label: string, run: () => void) => {
    const before = latest.current.present;
    run();
    const after = latest.current.present;
    if (after !== before) labelDocumentStep(after, label);
  };

  const beginTransform = () => {
    transformBase.current = latest.current;
    setTransforming(true);
  };

  const endTransform = (label: string | null) => {
    const base = transformBase.current;
    if (base === null) return;
    transformBase.current = null;
    setTransforming(false);
    if (label === null) {
      setHistory(base);
      return;
    }
    const merged = collapseHistory(latest.current, base, DESIGN_LIMITS.history);
    if (merged.present !== base.present) labelDocumentStep(merged.present, label);
    setHistory(merged);
  };

  const goToPage = (id: string) => {
    endTransform(TRANSFORM_LABEL);
    setPageId(id);
    setSelectedIds([]);
  };

  return {
    document,
    historyDocuments,
    page,
    pageId: currentPageId,
    selected,
    single,
    selectedIds: selected.map((element) => element.id),
    select,
    selectMany: (ids: string[]) => setSelectedIds(expandSelection(page, ids)),
    selectAll: () => setSelectedIds(selectAll(page)),
    align: (align: DesignAlign, size: PageSize) =>
      changePage((current) => alignElements(current, selectedIds, align, size)),
    distribute: (axis: DesignDistribute) =>
      changePage((current) => distributeElements(current, selectedIds, axis)),
    transformSelection: (box: Box, mergeKey?: string) =>
      changePage((current) => transformSelection(current, selectedIds, box), mergeKey),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo: () => {
      if (!pixels.busy() && transformBase.current === null) {
        setHistory(undoTimeline(latest.current, pixels));
      }
    },
    redo: () => {
      if (!pixels.busy() && transformBase.current === null) {
        setHistory(redoTimeline(latest.current, pixels));
      }
    },
    jump: (stepIndex: number) => {
      if (!pixels.busy() && transformBase.current === null) {
        setHistory(jumpTimeline(latest.current, pixels, stepIndex));
      }
    },
    named,
    crop: (box: CropBox) =>
      named(CROP_LABEL, () => changePage((current) => cropPage(current, box))),
    transforming,
    beginTransform,
    commitTransform: () => endTransform(TRANSFORM_LABEL),
    cancelTransform: () => endTransform(null),
    markPixelStep: (label: string, stepId: string) =>
      setHistory((current) =>
        trimLostPixelSteps(
          pushHistory(
            current,
            markPixelStep(current.present, label, stepId),
            DESIGN_LIMITS.history,
          ),
          pixels,
        ),
      ),
    steps: timelineSteps(history),
    newId,
    add,
    addRaster: (size: PageSize): boolean => add(createRasterLayer(newId(), page, size)),
    addImported: (elements: readonly DesignElement[], size: PageSize | null, label: string) => {
      if (!canAddElements(document, elements.length)) return false;
      named(label, () => changePage((current) => addImportedLayers(current, elements, size)));
      setSelectedIds([]);
      return true;
    },
    addAdjustment: (type: AdjustmentType, size: PageSize): boolean => {
      if (!canAddElements(document)) return false;
      const element = createAdjustmentLayer(newId(), type, size);
      changePage((current) => insertAdjustment(current, element, single?.id ?? null));
      setSelectedIds([element.id]);
      return true;
    },
    patchAdjustment: (id: string, params: AdjustmentParams, mergeKey?: string) =>
      changePage((current) => patchAdjustment(current, id, params), mergeKey),
    toggleClip: () => {
      if (single !== undefined) changePage((current) => toggleClipToBelow(current, single.id));
    },
    remove,
    setPixelsVersions: (entries: readonly PixelsVersionEntry[]) => {
      if (transformBase.current !== null) {
        transformBase.current = retargetHistory(transformBase.current, entries);
      }
      setHistory((current) => retargetHistory(current, entries));
    },
    replaceWithRaster: (replacedId: string, element: RasterElement) => {
      changePage((current) => replaceElement(current, replacedId, element));
      setSelectedIds([element.id]);
    },
    duplicate,
    canAdd: (count = 1) => canAddElements(document, count),
    move: (id: string, move: LayerMove) => changePage((current) => moveLayer(current, id, move)),
    moveTo: (id: string, index: number) => changePage((current) => moveLayerTo(current, id, index)),
    patch: (id: string, patch: ElementBasePatch, mergeKey?: string) =>
      changePage((current) => patchElement(current, id, patch), mergeKey),
    patchMany: (patches: readonly ElementPatch[], mergeKey?: string) =>
      changePage((current) => patchElements(current, patches), mergeKey),
    patchText: (id: string, patch: TextPatch, mergeKey?: string) =>
      changePage((current) => patchText(current, id, patch), mergeKey),
    patchImage: (id: string, patch: ImagePatch, mergeKey?: string) =>
      changePage((current) => patchImage(current, id, patch), mergeKey),
    patchShape: (id: string, patch: ShapePatch, mergeKey?: string) =>
      changePage((current) => patchShape(current, id, patch), mergeKey),
    patchLine: (id: string, patch: LinePatch, mergeKey?: string) =>
      changePage((current) => patchLine(current, id, patch), mergeKey),
    setBackground: (background: string | null, mergeKey?: string) =>
      changePage((current) => setBackground(current, background), mergeKey),
    group: () => changePage((current) => groupElements(current, selectedIds, newId())),
    ungroup: () => changePage((current) => ungroupElements(current, selectedIds)),
    measure: (id: string, height: number) =>
      setHistory((current) => ({
        ...current,
        present: inheritPixelStep(current.present, {
          ...current.present,
          pages: current.present.pages.map((item) => patchElement(item, id, { height })),
        }),
      })),
    canAddPage: canAddPage(document),
    goToPage,
    addPage: () => {
      const id = newId();
      change((current) => addPage(current, currentPageId, emptyPage(id)));
      goToPage(id);
    },
    duplicatePage: () => {
      const id = newId();
      change((current) => duplicatePage(current, currentPageId, id, newId));
      goToPage(id);
    },
    removePage: () => {
      const index = document.pages.findIndex((item) => item.id === currentPageId);
      const neighbour = document.pages[index === 0 ? 1 : index - 1];
      change((current) => removePage(current, currentPageId));
      if (neighbour !== undefined) goToPage(neighbour.id);
    },
    movePage: (delta: -1 | 1) => change((current) => movePage(current, currentPageId, delta)),
  };
};

export type DesignEditor = ReturnType<typeof useDesignEditor>;

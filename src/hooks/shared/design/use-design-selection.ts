import { useEffect, useMemo, useRef, useState } from "react";
import type { RasterHandle } from "@/hooks/shared/design/use-raster-store";
import type { DesignEditor } from "@/hooks/shared/design/use-design-editor";
import {
  type Outline,
  type SelectionMask,
  SelectionCombine,
  featherMask,
  magicWand,
  maskOutline,
} from "@/lib/shared/design/raster/selection";
import type { Point, Rect } from "@/lib/shared/design/raster/pixel-buffer";
import {
  MarqueeShape,
  SELECTION_LIMITS,
  type SelectionShape,
  applySelection,
  featherSelection,
  growSelection,
  invertSelection,
  layerToPageBuffer,
  marqueeRect,
  modeFromModifiers,
  selectAllMask,
  selectionForLayer,
  shapeMask,
  shrinkSelection,
} from "@/lib/shared/design/selection-state";
import { pixelToolReason } from "@/lib/shared/design/rasterize";
import type { PagePlacement } from "@/lib/shared/design/selection-state";
import { DesignElementKind, DesignTool, type PageSize } from "@/lib/shared/design/types";

export type PointerModifiers = { shift: boolean; alt: boolean };

const WAND_NEEDS_LAYER = "Selecione uma camada de pixels para usar a varinha mágica.";
const WAND_ANTI_ALIAS = 2;
const CLICK_SCREEN_PX = 3;
const NO_OUTLINE: Outline = { segments: [], truncated: false };

type Drag = {
  start: Point;
  end: Point;
  mode: SelectionCombine;
  startMods: PointerModifiers;
  mods: PointerModifiers;
  free: Point[];
};

type Held = { mask: SelectionMask | null; revision: number };

export type SelectionCallbacks = {
  onSelectStart: (point: Point, mods: PointerModifiers) => void;
  onSelectMove: (point: Point, mods: PointerModifiers) => void;
  onSelectEnd: () => void;
};

export type SelectionController = {
  mask: SelectionMask | null;
  revision: number;
  outline: Outline;
  mode: SelectionCombine;
  setMode: (mode: SelectionCombine) => void;
  shape: MarqueeShape;
  setShape: (shape: MarqueeShape) => void;
  cycleShape: () => void;
  feather: number;
  setFeather: (value: number) => void;
  tolerance: number;
  setTolerance: (value: number) => void;
  contiguous: boolean;
  setContiguous: (value: boolean) => void;
  draft: SelectionShape | null;
  notice: string | null;
  drawing: boolean;
  callbacks: SelectionCallbacks;
  selectAll: () => void;
  deselect: () => void;
  invert: () => void;
  featherBy: (radius: number) => void;
  grow: (radius: number) => void;
  shrink: (radius: number) => void;
  setRect: (rect: Rect) => void;
  closePolygon: () => void;
  cancelDraft: () => void;
  removeLastPoint: () => void;
  layerMask: (placement: PagePlacement) => SelectionMask | null;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const useDesignSelection = ({
  tool,
  pageId,
  size,
  editor,
  rasters,
  zoom,
}: {
  tool: DesignTool;
  pageId: string;
  size: PageSize;
  editor: DesignEditor;
  rasters: RasterHandle;
  zoom: number;
}): SelectionController => {
  const [held, setHeld] = useState<Held>({ mask: null, revision: 0 });
  const [mode, setMode] = useState<SelectionCombine>(SelectionCombine.Replace);
  const [shape, setShape] = useState<MarqueeShape>(MarqueeShape.Rect);
  const [feather, setFeather] = useState(0);
  const [tolerance, setTolerance] = useState<number>(SELECTION_LIMITS.defaultTolerance);
  const [contiguous, setContiguous] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const [polygon, setPolygonState] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const polygonRef = useRef<Point[]>([]);
  const polygonMode = useRef<SelectionCombine>(SelectionCombine.Replace);
  const single = editor.single;
  const outline = useMemo(
    () => (held.mask === null ? NO_OUTLINE : maskOutline(held.mask)),
    [held.mask],
  );

  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const setPolygon = (next: Point[]) => {
    polygonRef.current = next;
    setPolygonState(next);
  };

  const replaceMask = (mask: SelectionMask | null) =>
    setHeld((current) => ({ mask, revision: current.revision + 1 }));

  const commit = (incoming: SelectionMask, combine: SelectionCombine) =>
    setHeld((current) => ({
      mask: applySelection(current.mask, incoming, combine),
      revision: current.revision + 1,
    }));

  const feathered = (mask: SelectionMask) => (feather > 0 ? featherMask(mask, feather) : mask);

  useEffect(() => {
    replaceMask(null);
    setPolygon([]);
    setDrag(null);
  }, [pageId, size.width, size.height]);

  useEffect(() => {
    if (tool !== DesignTool.Lasso) setPolygon([]);
    setNotice(null);
  }, [tool]);

  const wand = (point: Point, combine: SelectionCombine) => {
    const buffer = single?.kind === DesignElementKind.Raster ? rasters.store.get(single.id) : null;
    if (single?.kind !== DesignElementKind.Raster || buffer === null || buffer === undefined) {
      setNotice(pixelToolReason(WAND_NEEDS_LAYER, single));
      return;
    }
    setNotice(null);
    const sample = layerToPageBuffer(buffer, single, size.width, size.height);
    const found = magicWand(sample, Math.floor(point.x), Math.floor(point.y), {
      tolerance,
      contiguous,
    });
    commit(featherMask(found, WAND_ANTI_ALIAS), combine);
  };

  const closePolygon = () => {
    const points = polygonRef.current;
    setPolygon([]);
    if (points.length < 3) return;
    commit(
      feathered(shapeMask(size.width, size.height, { kind: "polygon", points })),
      polygonMode.current,
    );
  };

  const finishMarquee = (current: Drag) => {
    const rect = marqueeRect(current.start, current.end, {
      square: current.mods.shift && !current.startMods.shift,
      center: current.mods.alt && !current.startMods.alt,
    });
    const empty = rect.width < 1 || rect.height < 1;
    if (empty && current.mode === SelectionCombine.Replace) replaceMask(null);
    if (empty) return;
    commit(feathered(shapeMask(size.width, size.height, { kind: shape, rect })), current.mode);
  };

  const finishLasso = (current: Drag) => {
    const clicked = distance(current.start, current.end) * zoom < CLICK_SCREEN_PX;
    if (!clicked) {
      setPolygon([]);
      commit(
        feathered(shapeMask(size.width, size.height, { kind: "polygon", points: current.free })),
        current.mode,
      );
      return;
    }
    const points = polygonRef.current;
    const first = points[0];
    const last = points.at(-1);
    const near = (target: Point | undefined) =>
      target !== undefined &&
      distance(target, current.end) * zoom < SELECTION_LIMITS.polygonCloseScreenPx;
    if (points.length >= 3 && (near(first) || near(last))) {
      closePolygon();
      return;
    }
    if (points.length === 0) polygonMode.current = current.mode;
    setPolygon([...points, current.end]);
  };

  const onSelectStart = (point: Point, mods: PointerModifiers) => {
    const combine = modeFromModifiers(mods.shift, mods.alt, mode);
    if (tool === DesignTool.Wand) {
      wand(point, combine);
      return;
    }
    setCursor(point);
    setDrag({ start: point, end: point, mode: combine, startMods: mods, mods, free: [point] });
  };

  const onSelectMove = (point: Point, mods: PointerModifiers) => {
    setCursor(point);
    const current = dragRef.current;
    if (current === null) return;
    const last = current.free.at(-1);
    const extend =
      tool === DesignTool.Lasso &&
      last !== undefined &&
      distance(last, point) * zoom >= SELECTION_LIMITS.lassoStepScreenPx;
    setDrag({
      ...current,
      end: point,
      mods,
      free: extend ? [...current.free, point] : current.free,
    });
  };

  const onSelectEnd = () => {
    const current = dragRef.current;
    setDrag(null);
    if (current === null) return;
    if (tool === DesignTool.Marquee) finishMarquee(current);
    if (tool === DesignTool.Lasso) finishLasso(current);
  };

  const cancelDraft = () => {
    setDrag(null);
    setPolygon([]);
  };

  const removeLastPoint = () => setPolygon(polygonRef.current.slice(0, -1));

  const draftShape = (): SelectionShape | null => {
    if (drag !== null && tool === DesignTool.Marquee) {
      const rect = marqueeRect(drag.start, drag.end, {
        square: drag.mods.shift && !drag.startMods.shift,
        center: drag.mods.alt && !drag.startMods.alt,
      });
      return { kind: shape, rect };
    }
    if (drag !== null && tool === DesignTool.Lasso && polygon.length === 0) {
      return { kind: "polygon", points: drag.free };
    }
    if (polygon.length === 0) return null;
    return { kind: "polygon", points: cursor === null ? polygon : [...polygon, cursor] };
  };

  const setRect = (rect: Rect) =>
    commit(
      feathered(shapeMask(size.width, size.height, { kind: shape, rect })),
      SelectionCombine.Replace,
    );

  const layerMask = (placement: PagePlacement): SelectionMask | null =>
    held.mask === null ? null : selectionForLayer(held.mask, placement);

  return {
    mask: held.mask,
    revision: held.revision,
    outline,
    mode,
    setMode,
    shape,
    setShape,
    cycleShape: () =>
      setShape((current) =>
        current === MarqueeShape.Rect ? MarqueeShape.Ellipse : MarqueeShape.Rect,
      ),
    feather,
    setFeather,
    tolerance,
    setTolerance,
    contiguous,
    setContiguous,
    draft: draftShape(),
    notice,
    drawing: polygon.length > 0 || drag !== null,
    callbacks: { onSelectStart, onSelectMove, onSelectEnd },
    selectAll: () => replaceMask(selectAllMask(size.width, size.height)),
    deselect: () => replaceMask(null),
    invert: () => replaceMask(invertSelection(held.mask)),
    featherBy: (radius) => replaceMask(featherSelection(held.mask, radius)),
    grow: (radius) => replaceMask(growSelection(held.mask, radius)),
    shrink: (radius) => replaceMask(shrinkSelection(held.mask, radius)),
    setRect,
    closePolygon,
    cancelDraft,
    removeLastPoint,
    layerMask,
  };
};

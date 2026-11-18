import { docToLayerPoint } from "@/lib/shared/design/paint";
import { clamp } from "@/lib/shared/design/raster/numeric";
import {
  type PixelBuffer,
  type Point,
  type Rect,
  createPixelBuffer,
} from "@/lib/shared/design/raster/pixel-buffer";
import {
  type SelectionMask,
  SelectionCombine,
  combineMasks,
  createMask,
  ellipseMask,
  featherMask,
  growMask,
  invertMask,
  maskBoundingBox,
  polygonMask,
  rectMask,
  shrinkMask,
} from "@/lib/shared/design/raster/selection";
import type { ValueOf } from "@/lib/shared/utils";

export const MarqueeShape = {
  Rect: "rect",
  Ellipse: "ellipse",
} as const;
export type MarqueeShape = ValueOf<typeof MarqueeShape>;

export const MARQUEE_SHAPE_LABEL: Record<MarqueeShape, string> = {
  [MarqueeShape.Rect]: "Retangular",
  [MarqueeShape.Ellipse]: "Elíptica",
};

export const SELECTION_COMBINE_LABEL: Record<SelectionCombine, string> = {
  [SelectionCombine.Replace]: "Nova",
  [SelectionCombine.Add]: "Adicionar",
  [SelectionCombine.Subtract]: "Subtrair",
  [SelectionCombine.Intersect]: "Interseção",
};

export const SELECTION_LIMITS = {
  maxFeather: 250,
  maxGrow: 100,
  maxTolerance: 255,
  defaultTolerance: 32,
  polygonCloseScreenPx: 8,
  lassoStepScreenPx: 2,
} as const;

export const SELECTION_STEP_LABEL = "Seleção";
export const SELECTION_TRUNCATED_NOTICE =
  "A seleção é complexa demais para mostrar todo o contorno. Ela continua ativa.";

export type SelectionShape =
  { kind: MarqueeShape; rect: Rect } | { kind: "polygon"; points: readonly Point[] };

export type PagePlacement = Parameters<typeof docToLayerPoint>[0];

export const modeFromModifiers = (
  shift: boolean,
  alt: boolean,
  base: SelectionCombine,
): SelectionCombine => {
  if (shift && alt) return SelectionCombine.Intersect;
  if (shift) return SelectionCombine.Add;
  if (alt) return SelectionCombine.Subtract;
  return base;
};

export const marqueeRect = (
  start: Point,
  end: Point,
  options: { square: boolean; center: boolean },
): Rect => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const span = Math.max(Math.abs(dx), Math.abs(dy));
  const width = options.square ? span : Math.abs(dx);
  const height = options.square ? span : Math.abs(dy);
  const signX = dx < 0 ? -1 : 1;
  const signY = dy < 0 ? -1 : 1;
  if (options.center) {
    return {
      x: Math.round(start.x - width),
      y: Math.round(start.y - height),
      width: Math.round(width * 2),
      height: Math.round(height * 2),
    };
  }
  const x = signX < 0 ? start.x - width : start.x;
  const y = signY < 0 ? start.y - height : start.y;
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
};

export const shapeMask = (width: number, height: number, shape: SelectionShape): SelectionMask => {
  if (shape.kind === "polygon") return polygonMask(width, height, shape.points);
  return shape.kind === MarqueeShape.Ellipse
    ? ellipseMask(width, height, shape.rect)
    : rectMask(width, height, shape.rect);
};

export const isEmptyMask = (mask: SelectionMask): boolean => maskBoundingBox(mask) === null;

export const normalizeMask = (mask: SelectionMask | null): SelectionMask | null =>
  mask === null || isEmptyMask(mask) ? null : mask;

export const applySelection = (
  current: SelectionMask | null,
  incoming: SelectionMask,
  mode: SelectionCombine,
): SelectionMask | null => {
  if (mode === SelectionCombine.Replace) return normalizeMask(incoming);
  if (current === null) {
    return mode === SelectionCombine.Add ? normalizeMask(incoming) : null;
  }
  return normalizeMask(combineMasks(current, incoming, mode));
};

export const selectAllMask = (width: number, height: number): SelectionMask =>
  createMask(width, height, 255);

export const invertSelection = (mask: SelectionMask | null): SelectionMask | null =>
  mask === null ? null : normalizeMask(invertMask(mask));

export const featherSelection = (
  mask: SelectionMask | null,
  radius: number,
): SelectionMask | null =>
  mask === null
    ? null
    : normalizeMask(featherMask(mask, clamp(radius, 0, SELECTION_LIMITS.maxFeather)));

export const growSelection = (mask: SelectionMask | null, radius: number): SelectionMask | null =>
  mask === null ? null : normalizeMask(growMask(mask, clamp(radius, 0, SELECTION_LIMITS.maxGrow)));

export const shrinkSelection = (
  mask: SelectionMask | null,
  radius: number,
): SelectionMask | null =>
  mask === null
    ? null
    : normalizeMask(shrinkMask(mask, clamp(radius, 0, SELECTION_LIMITS.maxGrow)));

export const selectionForLayer = (page: SelectionMask, placement: PagePlacement): SelectionMask => {
  const out = createMask(placement.pixelWidth, placement.pixelHeight);
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const cx = placement.x + placement.width / 2;
  const cy = placement.y + placement.height / 2;
  const sx = placement.width / placement.pixelWidth;
  const sy = placement.height / placement.pixelHeight;
  for (let ly = 0; ly < out.height; ly += 1) {
    for (let lx = 0; lx < out.width; lx += 1) {
      const dx = (lx + 0.5) * sx - placement.width / 2;
      const dy = (ly + 0.5) * sy - placement.height / 2;
      const px = Math.floor(cx + dx * cos - dy * sin);
      const py = Math.floor(cy + dx * sin + dy * cos);
      if (px < 0 || py < 0 || px >= page.width || py >= page.height) continue;
      out.data[ly * out.width + lx] = page.data[py * page.width + px] ?? 0;
    }
  }
  return out;
};

export const layerToPageBuffer = (
  layer: PixelBuffer,
  placement: PagePlacement,
  width: number,
  height: number,
): PixelBuffer => {
  const out = createPixelBuffer(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const local = docToLayerPoint(placement, { x: x + 0.5, y: y + 0.5 });
      const lx = Math.floor(local.x);
      const ly = Math.floor(local.y);
      if (lx < 0 || ly < 0 || lx >= layer.width || ly >= layer.height) continue;
      const from = (ly * layer.width + lx) * 4;
      out.data.set(layer.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return out;
};

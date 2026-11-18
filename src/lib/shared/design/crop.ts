import type { DesignPage } from "@/lib/shared/design/schemas";
import {
  DESIGN_LIMITS,
  DESIGN_PRESET_SIZE,
  type DesignPreset,
  type PageSize,
} from "@/lib/shared/design/types";
import type { Point } from "@/lib/shared/design/viewport";
import type { ValueOf } from "@/lib/shared/utils";

export const CropRatio = {
  Free: "free",
  Original: "original",
  Square: "square",
  Portrait: "portrait",
  Story: "story",
  Landscape: "landscape",
} as const;
export type CropRatio = ValueOf<typeof CropRatio>;

export const CROP_RATIO_LABEL: Record<CropRatio, string> = {
  [CropRatio.Free]: "Livre",
  [CropRatio.Original]: "Original",
  [CropRatio.Square]: "1:1",
  [CropRatio.Portrait]: "4:5",
  [CropRatio.Story]: "9:16",
  [CropRatio.Landscape]: "16:9",
};

export const CropHandle = {
  Move: "move",
  NorthWest: "nw",
  North: "n",
  NorthEast: "ne",
  East: "e",
  SouthEast: "se",
  South: "s",
  SouthWest: "sw",
  West: "w",
} as const;
export type CropHandle = ValueOf<typeof CropHandle>;

export type CropBox = { x: number; y: number; width: number; height: number };

export const CROP_TOO_SMALL = "O corte precisa ter pelo menos 64 × 64 px.";
export const CROP_HINT = "Arraste na página para desenhar o corte. Enter aplica, Esc cancela.";

const HANDLE_SCREEN_PX = 10;
const MIN_EDGE = 1;

const RATIO_VALUE: Record<CropRatio, number | null> = {
  [CropRatio.Free]: null,
  [CropRatio.Original]: null,
  [CropRatio.Square]: 1,
  [CropRatio.Portrait]: 4 / 5,
  [CropRatio.Story]: 9 / 16,
  [CropRatio.Landscape]: 16 / 9,
};

export const pageSizeOf = (page: DesignPage, preset: DesignPreset): PageSize => {
  const base = DESIGN_PRESET_SIZE[preset];
  return { width: page.width ?? base.width, height: page.height ?? base.height };
};

export const ratioValue = (ratio: CropRatio, page: PageSize): number | null =>
  ratio === CropRatio.Original ? page.width / page.height : RATIO_VALUE[ratio];

export const fullCrop = (size: PageSize): CropBox => ({
  x: 0,
  y: 0,
  width: size.width,
  height: size.height,
});

export const isFullCrop = (box: CropBox, size: PageSize): boolean =>
  box.x === 0 && box.y === 0 && box.width === size.width && box.height === size.height;

export const isValidCrop = (box: CropBox): boolean =>
  box.width >= DESIGN_LIMITS.minPageSide &&
  box.height >= DESIGN_LIMITS.minPageSide &&
  box.width <= DESIGN_LIMITS.maxPageSide &&
  box.height <= DESIGN_LIMITS.maxPageSide;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const corners = (box: CropBox): [CropHandle, Point][] => [
  [CropHandle.NorthWest, { x: box.x, y: box.y }],
  [CropHandle.NorthEast, { x: box.x + box.width, y: box.y }],
  [CropHandle.SouthEast, { x: box.x + box.width, y: box.y + box.height }],
  [CropHandle.SouthWest, { x: box.x, y: box.y + box.height }],
];

const edges = (box: CropBox): [CropHandle, Point][] => [
  [CropHandle.North, { x: box.x + box.width / 2, y: box.y }],
  [CropHandle.East, { x: box.x + box.width, y: box.y + box.height / 2 }],
  [CropHandle.South, { x: box.x + box.width / 2, y: box.y + box.height }],
  [CropHandle.West, { x: box.x, y: box.y + box.height / 2 }],
];

export const cropHandlePoints = (box: CropBox, fixedRatio: boolean): [CropHandle, Point][] =>
  fixedRatio ? corners(box) : [...corners(box), ...edges(box)];

const inside = (box: CropBox, point: Point): boolean =>
  point.x >= box.x &&
  point.y >= box.y &&
  point.x <= box.x + box.width &&
  point.y <= box.y + box.height;

export const hitCrop = (
  box: CropBox,
  point: Point,
  zoom: number,
  fixedRatio: boolean,
): CropHandle | null => {
  const reach = HANDLE_SCREEN_PX / Math.max(zoom, 0.01);
  const found = cropHandlePoints(box, fixedRatio).find(
    ([, at]) => Math.hypot(at.x - point.x, at.y - point.y) <= reach,
  );
  if (found !== undefined) return found[0];
  return inside(box, point) ? CropHandle.Move : null;
};

const fromAnchor = (
  anchor: Point,
  point: Point,
  ratio: number | null,
  bounds: PageSize,
): CropBox => {
  const right = point.x >= anchor.x;
  const down = point.y >= anchor.y;
  const maxWidth = right ? bounds.width - anchor.x : anchor.x;
  const maxHeight = down ? bounds.height - anchor.y : anchor.y;
  let width = Math.min(Math.abs(point.x - anchor.x), maxWidth);
  let height = Math.min(Math.abs(point.y - anchor.y), maxHeight);
  if (ratio !== null) {
    width = Math.min(Math.max(width, height * ratio), maxWidth, maxHeight * ratio);
    height = width / ratio;
  }
  const w = Math.round(width);
  const h = Math.round(height);
  return {
    x: right ? anchor.x : anchor.x - w,
    y: down ? anchor.y : anchor.y - h,
    width: w,
    height: h,
  };
};

export const newCrop = (
  start: Point,
  point: Point,
  ratio: number | null,
  bounds: PageSize,
): CropBox =>
  fromAnchor(
    {
      x: clamp(Math.round(start.x), 0, bounds.width),
      y: clamp(Math.round(start.y), 0, bounds.height),
    },
    point,
    ratio,
    bounds,
  );

const oppositeCorner = (box: CropBox, handle: CropHandle): Point => {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const west = handle === CropHandle.NorthWest || handle === CropHandle.SouthWest;
  const north = handle === CropHandle.NorthWest || handle === CropHandle.NorthEast;
  return { x: west ? right : box.x, y: north ? bottom : box.y };
};

const dragEdge = (origin: CropBox, handle: CropHandle, point: Point, bounds: PageSize): CropBox => {
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const left = handle === CropHandle.West ? clamp(x, 0, right - MIN_EDGE) : origin.x;
  const top = handle === CropHandle.North ? clamp(y, 0, bottom - MIN_EDGE) : origin.y;
  const far = handle === CropHandle.East ? clamp(x, origin.x + MIN_EDGE, bounds.width) : right;
  const low = handle === CropHandle.South ? clamp(y, origin.y + MIN_EDGE, bounds.height) : bottom;
  return { x: left, y: top, width: far - left, height: low - top };
};

export const dragCrop = (
  origin: CropBox,
  handle: CropHandle,
  start: Point,
  point: Point,
  ratio: number | null,
  bounds: PageSize,
): CropBox => {
  if (handle === CropHandle.Move) {
    return {
      ...origin,
      x: clamp(Math.round(origin.x + point.x - start.x), 0, bounds.width - origin.width),
      y: clamp(Math.round(origin.y + point.y - start.y), 0, bounds.height - origin.height),
    };
  }
  const isCorner = corners(origin).some(([name]) => name === handle);
  if (isCorner) return fromAnchor(oppositeCorner(origin, handle), point, ratio, bounds);
  return dragEdge(origin, handle, point, bounds);
};

export const cropPage = (page: DesignPage, box: CropBox): DesignPage => ({
  ...page,
  width: box.width,
  height: box.height,
  elements: page.elements.map((element) => ({
    ...element,
    x: clamp(element.x - box.x, -DESIGN_LIMITS.maxCoordinate, DESIGN_LIMITS.maxCoordinate),
    y: clamp(element.y - box.y, -DESIGN_LIMITS.maxCoordinate, DESIGN_LIMITS.maxCoordinate),
  })),
});

export const fitRatio = (box: CropBox, ratio: number): CropBox => {
  const width = Math.min(box.width, box.height * ratio);
  const height = width / ratio;
  return {
    x: Math.round(box.x + (box.width - width) / 2),
    y: Math.round(box.y + (box.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
};

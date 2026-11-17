import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";

export type Point = { x: number; y: number };
export type Viewport = { zoom: number; x: number; y: number };
export type RulerTick = { value: number; at: number };

const ZOOM_STEPS = [0.1, 0.125, 0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4, 6, 8];
const RULER_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

export const clampZoom = (zoom: number): number =>
  Math.min(DESIGN_LIMITS.maxViewZoom, Math.max(DESIGN_LIMITS.minViewZoom, zoom));

export const centeredViewport = (page: PageSize, area: PageSize, zoom: number): Viewport => {
  const z = clampZoom(zoom);
  return {
    zoom: z,
    x: Math.round((area.width - page.width * z) / 2),
    y: Math.round((area.height - page.height * z) / 2),
  };
};

export const fitZoom = (page: PageSize, area: PageSize, padding: number): number => {
  const width = Math.max(1, area.width - padding * 2);
  const height = Math.max(1, area.height - padding * 2);
  return clampZoom(Math.min(width / page.width, height / page.height));
};

export const fitViewport = (page: PageSize, area: PageSize, padding: number): Viewport =>
  centeredViewport(page, area, fitZoom(page, area, padding));

export const zoomAt = (view: Viewport, zoom: number, point: Point): Viewport => {
  const z = clampZoom(zoom);
  const docX = (point.x - view.x) / view.zoom;
  const docY = (point.y - view.y) / view.zoom;
  return { zoom: z, x: point.x - docX * z, y: point.y - docY * z };
};

export const panViewport = (view: Viewport, dx: number, dy: number): Viewport => ({
  ...view,
  x: view.x + dx,
  y: view.y + dy,
});

export const toDocument = (view: Viewport, point: Point): Point => ({
  x: (point.x - view.x) / view.zoom,
  y: (point.y - view.y) / view.zoom,
});

export const stepZoom = (zoom: number, direction: 1 | -1): number => {
  const next =
    direction === 1
      ? ZOOM_STEPS.find((step) => step > zoom + 0.001)
      : [...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001);
  return clampZoom(next ?? zoom);
};

export const zoomPercent = (zoom: number): number => Math.round(zoom * 100);

export const rulerStep = (zoom: number): number =>
  RULER_STEPS.find((step) => step * zoom >= DESIGN_LIMITS.rulerMinStepPx) ?? 5000;

export const rulerTicks = (offset: number, zoom: number, length: number): RulerTick[] => {
  const step = rulerStep(zoom);
  const first = Math.ceil(-offset / zoom / step) * step;
  const last = (length - offset) / zoom;
  const ticks: RulerTick[] = [];
  for (let value = first; value <= last; value += step) {
    ticks.push({ value, at: Math.round(offset + value * zoom) });
  }
  return ticks;
};

export const boxFromPoints = (start: Point, end: Point, square: boolean) => {
  const rawWidth = end.x - start.x;
  const rawHeight = end.y - start.y;
  const side = Math.max(Math.abs(rawWidth), Math.abs(rawHeight));
  const width = square ? side * Math.sign(rawWidth || 1) : rawWidth;
  const height = square ? side * Math.sign(rawHeight || 1) : rawHeight;
  return {
    x: Math.round(Math.min(start.x, start.x + width)),
    y: Math.round(Math.min(start.y, start.y + height)),
    width: Math.round(Math.abs(width)),
    height: Math.round(Math.abs(height)),
  };
};

export const snapAngle = (start: Point, end: Point): Point => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
};

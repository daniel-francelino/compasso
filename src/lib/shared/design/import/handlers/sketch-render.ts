import type {
  SketchNode,
  SketchPathPoint,
  SketchRgba,
} from "@/lib/shared/design/import/handlers/sketch-schema";
import { SketchNodeKind } from "@/lib/shared/design/import/handlers/sketch-schema";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

const SUBSAMPLES = 4;
const CURVE_STEPS = 12;
const ALPHA_STEPS = 255;

type Inside = (x: number, y: number) => boolean;
type Polygon = { x: number; y: number }[];

export type TextPainter = (
  text: { value: string; font: string | null; size: number; color: SketchRgba | null },
  size: { width: number; height: number },
) => PixelBuffer | null;

const clampSide = (value: number): number =>
  Math.min(DESIGN_IMPORT_LIMITS.maxPageSide, Math.max(1, Math.ceil(value)));

const bezier = (from: number, c1: number, c2: number, to: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * from + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * to;
};

const mirrored = (value: number, flip: boolean): number => (flip ? 1 - value : value);

export const pathPolygon = (
  points: readonly SketchPathPoint[],
  size: { width: number; height: number },
  flips: { horizontal: boolean; vertical: boolean },
): Polygon => {
  const polygon: Polygon = [];
  const place = (x: number, y: number): void => {
    polygon.push({
      x: mirrored(x, flips.horizontal) * size.width,
      y: mirrored(y, flips.vertical) * size.height,
    });
  };
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    place(point.x, point.y);
    if (next === undefined || !(point.curved || next.curved)) return;
    if (
      point.fromX === point.x &&
      point.fromY === point.y &&
      next.toX === next.x &&
      next.toY === next.y
    ) {
      return;
    }
    for (let step = 1; step < CURVE_STEPS; step += 1) {
      const t = step / CURVE_STEPS;
      place(
        bezier(point.x, point.fromX, next.toX, next.x, t),
        bezier(point.y, point.fromY, next.toY, next.y, t),
      );
    }
  });
  return polygon;
};

const insidePolygon =
  (polygon: Polygon): Inside =>
  (x, y) => {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const a = polygon[index];
      const b = polygon[previous];
      if (a === undefined || b === undefined) continue;
      const crosses = a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  };

const insideRoundedRect = (width: number, height: number, radius: number): Inside => {
  const r = Math.min(radius, width / 2, height / 2);
  return (x, y) => {
    if (x < 0 || y < 0 || x > width || y > height) return false;
    const dx = Math.max(r - x, 0, x - (width - r));
    const dy = Math.max(r - y, 0, y - (height - r));
    return dx * dx + dy * dy <= r * r;
  };
};

const insideEllipse = (width: number, height: number): Inside => {
  const rx = width / 2;
  const ry = height / 2;
  return (x, y) => ((x - rx) / rx) ** 2 + ((y - ry) / ry) ** 2 <= 1;
};

const coverage = (inside: Inside, px: number, py: number): number => {
  let hits = 0;
  for (let sy = 0; sy < SUBSAMPLES; sy += 1) {
    for (let sx = 0; sx < SUBSAMPLES; sx += 1) {
      if (inside(px + (sx + 0.5) / SUBSAMPLES, py + (sy + 0.5) / SUBSAMPLES)) hits += 1;
    }
  }
  return hits / (SUBSAMPLES * SUBSAMPLES);
};

const insideFor = (node: SketchNode, width: number, height: number): Inside | null => {
  switch (node.kind) {
    case SketchNodeKind.Rectangle:
      return insideRoundedRect(width, height, node.radius);
    case SketchNodeKind.Oval:
      return insideEllipse(width, height);
    case SketchNodeKind.Path:
      return node.points.length < 3
        ? null
        : insidePolygon(
            pathPolygon(
              node.points,
              { width, height },
              { horizontal: node.flipHorizontal, vertical: node.flipVertical },
            ),
          );
    default:
      return null;
  }
};

export const renderShape = (node: SketchNode): PixelBuffer | null => {
  const { fill } = node;
  if (fill === null) return null;
  const width = clampSide(node.frame.width);
  const height = clampSide(node.frame.height);
  const inside = insideFor(node, node.frame.width, node.frame.height);
  if (inside === null) return null;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const share = coverage(inside, x, y);
      if (share === 0) continue;
      const offset = (y * width + x) * 4;
      data[offset] = fill.r;
      data[offset + 1] = fill.g;
      data[offset + 2] = fill.b;
      data[offset + 3] = Math.round(fill.a * share * ALPHA_STEPS);
    }
  }
  return { width, height, data };
};

export const renderText = (node: SketchNode, painter: TextPainter): PixelBuffer | null =>
  node.text === null || node.text.value.trim() === ""
    ? null
    : painter(node.text, {
        width: clampSide(node.frame.width),
        height: clampSide(node.frame.height),
      });

export const canvasTextPainter: TextPainter = (text, size) => {
  if (typeof OffscreenCanvas === "undefined") return null;
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext("2d");
  if (context === null) return null;
  const color = text.color ?? { r: 0, g: 0, b: 0, a: 1 };
  context.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  context.font = `${text.size}px sans-serif`;
  context.textBaseline = "top";
  text.value.split("\n").forEach((line, index) => {
    context.fillText(line, 0, index * text.size * 1.25, size.width);
  });
  const image = context.getImageData(0, 0, size.width, size.height);
  return { width: size.width, height: size.height, data: image.data };
};

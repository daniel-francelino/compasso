import {
  SvgFallback,
  type XmlElement,
  reject,
} from "@/lib/shared/design/import/handlers/svg-vector-types";
import { readLength, readNumberList } from "@/lib/shared/design/import/handlers/svg-values";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import {
  type PathCommand,
  type PathFailureReason,
  PathFailure,
  parsePathData,
} from "@/lib/shared/design/vector/path-data";
import { SVG_VECTOR_LIMITS } from "@/lib/shared/design/import/limits";

const KAPPA = 0.5522847498;

export const SVG_PATH_LIMITS = {
  maxData: DESIGN_LIMITS.maxPathData,
  maxCommands: DESIGN_LIMITS.maxPathCommands,
  maxCoordinate: SVG_VECTOR_LIMITS.maxNumber,
};

const lengthAttribute = (element: XmlElement, name: string): number | null => {
  const text = element.attrs.get(name);
  return text === undefined ? null : readLength(text);
};

const lengthOr = (element: XmlElement, name: string, fallback: number): number =>
  lengthAttribute(element, name) ?? fallback;

const ellipsePath = (cx: number, cy: number, rx: number, ry: number): PathCommand[] => {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    { type: "M", x: cx + rx, y: cy },
    { type: "C", x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { type: "C", x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { type: "C", x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { type: "C", x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
    { type: "Z" },
  ];
};

const cornerRadii = (element: XmlElement, width: number, height: number): [number, number] => {
  const rx = lengthAttribute(element, "rx");
  const ry = lengthAttribute(element, "ry");
  const first = Math.max(0, rx ?? ry ?? 0);
  const second = Math.max(0, ry ?? rx ?? 0);
  return [Math.min(first, width / 2), Math.min(second, height / 2)];
};

const rectPath = (element: XmlElement): PathCommand[] | null => {
  const x = lengthOr(element, "x", 0);
  const y = lengthOr(element, "y", 0);
  const width = lengthOr(element, "width", 0);
  const height = lengthOr(element, "height", 0);
  if (width <= 0 || height <= 0) return null;
  const [rx, ry] = cornerRadii(element, width, height);
  const right = x + width;
  const bottom = y + height;
  if (rx === 0 || ry === 0) {
    return [
      { type: "M", x, y },
      { type: "L", x: right, y },
      { type: "L", x: right, y: bottom },
      { type: "L", x, y: bottom },
      { type: "Z" },
    ];
  }
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    { type: "M", x: x + rx, y },
    { type: "L", x: right - rx, y },
    { type: "C", x1: right - rx + kx, y1: y, x2: right, y2: y + ry - ky, x: right, y: y + ry },
    { type: "L", x: right, y: bottom - ry },
    {
      type: "C",
      x1: right,
      y1: bottom - ry + ky,
      x2: right - rx + kx,
      y2: bottom,
      x: right - rx,
      y: bottom,
    },
    { type: "L", x: x + rx, y: bottom },
    { type: "C", x1: x + rx - kx, y1: bottom, x2: x, y2: bottom - ry + ky, x, y: bottom - ry },
    { type: "L", x, y: y + ry },
    { type: "C", x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y },
    { type: "Z" },
  ];
};

const circlePath = (element: XmlElement): PathCommand[] | null => {
  const r = lengthOr(element, "r", 0);
  if (r <= 0) return null;
  return ellipsePath(lengthOr(element, "cx", 0), lengthOr(element, "cy", 0), r, r);
};

const ellipseShape = (element: XmlElement): PathCommand[] | null => {
  const rx = lengthOr(element, "rx", 0);
  const ry = lengthOr(element, "ry", 0);
  if (rx <= 0 || ry <= 0) return null;
  return ellipsePath(lengthOr(element, "cx", 0), lengthOr(element, "cy", 0), rx, ry);
};

const linePath = (element: XmlElement): PathCommand[] => [
  { type: "M", x: lengthOr(element, "x1", 0), y: lengthOr(element, "y1", 0) },
  { type: "L", x: lengthOr(element, "x2", 0), y: lengthOr(element, "y2", 0) },
];

const pointsPath = (element: XmlElement, close: boolean): PathCommand[] | null => {
  const numbers = readNumberList(
    element.attrs.get("points") ?? "",
    DESIGN_LIMITS.maxPathCommands * 2,
  );
  if (numbers.length % 2 !== 0) throw reject(SvgFallback.Malformed);
  if (numbers.length < 4) return null;
  const commands: PathCommand[] = [];
  for (let index = 0; index < numbers.length; index += 2) {
    const x = numbers[index] ?? 0;
    const y = numbers[index + 1] ?? 0;
    commands.push({ type: index === 0 ? "M" : "L", x, y });
  }
  if (close) commands.push({ type: "Z" });
  return commands;
};

const failureReason = (message: string): PathFailureReason | null =>
  Object.values(PathFailure).find((value) => value === message) ?? null;

const dataPath = (element: XmlElement): PathCommand[] | null => {
  const source = element.attrs.get("d");
  if (source === undefined || source.trim() === "") return null;
  const parsed = parsePathData(source, SVG_PATH_LIMITS);
  if (parsed.ok) return parsed.commands.length === 0 ? null : parsed.commands;
  const reason = failureReason(parsed.message);
  if (reason === PathFailure.OutOfRange) throw reject(SvgFallback.TooLarge);
  const limits: (PathFailureReason | null)[] = [
    PathFailure.SourceTooLong,
    PathFailure.DataTooLong,
    PathFailure.TooManyCommands,
  ];
  throw reject(limits.includes(reason) ? SvgFallback.VectorLimit : SvgFallback.Malformed);
};

export const shapeCommands = (element: XmlElement): PathCommand[] | null => {
  switch (element.name) {
    case "rect":
      return rectPath(element);
    case "circle":
      return circlePath(element);
    case "ellipse":
      return ellipseShape(element);
    case "line":
      return linePath(element);
    case "polyline":
      return pointsPath(element, false);
    case "polygon":
      return pointsPath(element, true);
    default:
      return dataPath(element);
  }
};

export const SHAPE_NAMES: ReadonlySet<string> = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
]);

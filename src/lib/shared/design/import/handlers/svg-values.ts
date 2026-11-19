import { SVG_VECTOR_LIMITS } from "@/lib/shared/design/import/limits";
import { SvgFallback, reject } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { normalizeColor, rgbToHex } from "@/lib/shared/design/document";
import {
  type Matrix,
  composeAll,
  isFiniteMatrix,
  matrix,
  rotate,
  scale,
  skewX,
  skewY,
  translate,
} from "@/lib/shared/design/vector/matrix";

const SEPARATOR = /[\s,]+/;
const TRANSFORM_FUNCTION = /\s*(translate|scale|rotate|skewX|skewY|matrix)\s*\(([^()]*)\)[\s,]*/y;
const URL_REFERENCE = /^url\(\s*(['"]?)#([\w.:-]+)\1\s*\)\s*(.*)$/i;
const ANY_REFERENCE = /url\(\s*['"]?#[\w.:-]+['"]?\s*\)/gi;
const UNSAFE_VALUE = /(javascript:|expression\s*\(|@import|image-set|\\|<|&)/i;
const MAX_TRANSFORM_FUNCTIONS = 64;
const MATRIX_SIZE = 6;
const PERCENT = "%";
const PIXEL = "px";

export const SvgPaintKind = {
  None: "none",
  Solid: "solid",
  Reference: "reference",
} as const;

export type SvgPaint =
  | { kind: typeof SvgPaintKind.None }
  | { kind: typeof SvgPaintKind.Solid; color: string }
  | { kind: typeof SvgPaintKind.Reference; id: string };

export const NO_PAINT: SvgPaint = { kind: SvgPaintKind.None };
export const BLACK = rgbToHex(0, 0, 0);

type Rgb = readonly [number, number, number];

const NAMED_COLORS: ReadonlyMap<string, Rgb> = new Map<string, Rgb>(
  Object.entries({
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    lime: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    cyan: [0, 255, 255],
    aqua: [0, 255, 255],
    magenta: [255, 0, 255],
    fuchsia: [255, 0, 255],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
    silver: [192, 192, 192],
    maroon: [128, 0, 0],
    olive: [128, 128, 0],
    green: [0, 128, 0],
    purple: [128, 0, 128],
    teal: [0, 128, 128],
    navy: [0, 0, 128],
    orange: [255, 165, 0],
  }),
);

const CODE_ZERO = 48;
const CODE_NINE = 57;
const CODE_DOT = 46;
const CODE_PLUS = 43;
const CODE_MINUS = 45;
const CODE_E_LOWER = 101;
const CODE_E_UPPER = 69;
const UNIT = /^[a-zA-Z%]*$/;
const STRICT_RGB =
  /^rgb\(\s{0,4}\d{1,3}\s{0,4}(?:,\s{0,4}\d{1,3}\s{0,4},|\s{1,4}\d{1,3}\s{1,4})\d{1,3}\s{0,4}\)$/;
const STRICT_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
const MAX_COLOR_CHARS = 64;
const MAX_CHANNEL = 255;

const isDigitAt = (text: string, index: number): boolean => {
  const code = text.charCodeAt(index);
  return code >= CODE_ZERO && code <= CODE_NINE;
};

const skipDigits = (text: string, from: number): number => {
  let index = from;
  while (isDigitAt(text, index)) index += 1;
  return index;
};

const isSign = (text: string, index: number): boolean => {
  const code = text.charCodeAt(index);
  return code === CODE_PLUS || code === CODE_MINUS;
};

const isExponent = (text: string, index: number): boolean => {
  const code = text.charCodeAt(index);
  return code === CODE_E_LOWER || code === CODE_E_UPPER;
};

const scanExponent = (text: string, index: number): number => {
  if (!isExponent(text, index)) return index;
  const digits = isSign(text, index + 1) ? index + 2 : index + 1;
  const end = skipDigits(text, digits);
  return end > digits ? end : index;
};

const scanNumber = (text: string): number => {
  const start = isSign(text, 0) ? 1 : 0;
  const whole = skipDigits(text, start);
  const hasDot = text.charCodeAt(whole) === CODE_DOT;
  const fraction = hasDot ? skipDigits(text, whole + 1) : whole;
  const digits = whole - start + (hasDot ? fraction - whole - 1 : 0);
  return digits === 0 ? -1 : scanExponent(text, fraction);
};

const clean = (text: string, limit: number): string => {
  const trimmed = text.trim();
  if (trimmed.length > limit) throw reject(SvgFallback.Malformed);
  return trimmed;
};

const toNumber = (text: string): number => {
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > SVG_VECTOR_LIMITS.maxNumber) {
    throw reject(SvgFallback.TooLarge);
  }
  return value;
};

export const readNumber = (text: string): number => {
  const trimmed = clean(text, SVG_VECTOR_LIMITS.maxNumberChars);
  if (scanNumber(trimmed) !== trimmed.length) throw reject(SvgFallback.Malformed);
  return toNumber(trimmed);
};

export type Length = { value: number; percent: boolean };

export const readLengthOrPercent = (text: string): Length => {
  const trimmed = clean(text, SVG_VECTOR_LIMITS.maxNumberChars);
  const end = scanNumber(trimmed);
  const unit = trimmed.slice(Math.max(end, 0));
  if (end < 0 || !UNIT.test(unit)) throw reject(SvgFallback.Malformed);
  if (unit !== "" && unit !== PIXEL && unit !== PERCENT) throw reject(SvgFallback.Unsupported);
  return { value: toNumber(trimmed.slice(0, end)), percent: unit === PERCENT };
};

export const readLength = (text: string): number => {
  const length = readLengthOrPercent(text);
  if (length.percent) throw reject(SvgFallback.Unsupported);
  return length.value;
};

export const readNumberList = (text: string, maxItems: number): number[] => {
  const parts = text.trim().split(SEPARATOR).filter(Boolean);
  if (parts.length > maxItems) throw reject(SvgFallback.ParseLimit);
  return parts.map(readNumber);
};

const ARGUMENT_COUNTS: ReadonlyMap<string, readonly number[]> = new Map(
  Object.entries({
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
    matrix: [MATRIX_SIZE],
  }),
);

const transformOf = (name: string, args: readonly number[]): Matrix => {
  const [first = 0, second, third] = args;
  switch (name) {
    case "translate":
      return translate(first, second ?? 0);
    case "scale":
      return scale(first, second ?? first);
    case "rotate":
      return rotate(first, second ?? 0, third ?? 0);
    case "skewX":
      return skewX(first);
    case "skewY":
      return skewY(first);
    default:
      return matrix(
        args[0] ?? 0,
        args[1] ?? 0,
        args[2] ?? 0,
        args[3] ?? 0,
        args[4] ?? 0,
        args[5] ?? 0,
      );
  }
};

export const readTransform = (text: string): Matrix => {
  const list: Matrix[] = [];
  const source = text.trim();
  let index = 0;
  while (index < source.length) {
    TRANSFORM_FUNCTION.lastIndex = index;
    const match = TRANSFORM_FUNCTION.exec(source);
    if (match === null) throw reject(SvgFallback.Malformed);
    const name = match[1] ?? "";
    const args = readNumberList(match[2] ?? "", MATRIX_SIZE);
    if (!(ARGUMENT_COUNTS.get(name) ?? []).includes(args.length))
      throw reject(SvgFallback.Malformed);
    list.push(transformOf(name, args));
    if (list.length > MAX_TRANSFORM_FUNCTIONS) throw reject(SvgFallback.ParseLimit);
    index = TRANSFORM_FUNCTION.lastIndex;
  }
  const total = composeAll(list);
  if (!isFiniteMatrix(total)) throw reject(SvgFallback.TooLarge);
  return total;
};

export const checkSafeValue = (value: string): void => {
  if (UNSAFE_VALUE.test(value)) throw reject(SvgFallback.Unsupported);
  const urls = value.toLowerCase().split("url(").length - 1;
  const references = value.match(ANY_REFERENCE)?.length ?? 0;
  if (urls !== references) throw reject(SvgFallback.Unsupported);
};

const channelsInRange = (text: string): boolean =>
  (text.match(/\d+/g) ?? []).every((channel) => Number(channel) <= MAX_CHANNEL);

const readColor = (text: string, current: string): string => {
  if (text.length > MAX_COLOR_CHARS) throw reject(SvgFallback.Malformed);
  const lower = text.toLowerCase();
  if (lower === "currentcolor") return current;
  const named = NAMED_COLORS.get(lower);
  if (named !== undefined) return rgbToHex(...named);
  const strict = STRICT_HEX.test(lower) || (STRICT_RGB.test(lower) && channelsInRange(lower));
  const color = strict ? normalizeColor(lower) : null;
  if (color === null) throw reject(SvgFallback.Unsupported);
  return color;
};

export const readSolidColor = (text: string, current: string): string => {
  const value = clean(text, SVG_VECTOR_LIMITS.maxPaintChars);
  checkSafeValue(value);
  return readColor(value, current);
};

export const readPaint = (text: string, current: string): SvgPaint | null => {
  const value = clean(text, SVG_VECTOR_LIMITS.maxPaintChars);
  checkSafeValue(value);
  const lower = value.toLowerCase();
  if (lower === "inherit") return null;
  if (lower === "none" || lower === "transparent") return NO_PAINT;
  const reference = URL_REFERENCE.exec(value);
  if (reference !== null) return { kind: SvgPaintKind.Reference, id: reference[2] ?? "" };
  return { kind: SvgPaintKind.Solid, color: readColor(value, current) };
};

export const readUnit = (text: string): number => {
  const length = readLengthOrPercent(text);
  const value = length.percent ? length.value / 100 : length.value;
  return Math.min(1, Math.max(0, value));
};

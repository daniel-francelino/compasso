import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { sanitizeImportText } from "@/lib/shared/design/import/sanitize";
import {
  DesignImportKind,
  DesignImportNoteKind,
  type ImportOutcome,
  type ImportSwatch,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

export const PALETTE_LIMITS = {
  maxBytes: 1024 * 1024,
  maxSwatches: 1000,
  maxNameRead: 255,
  maxNameStored: 40,
  maxGplLines: 5000,
  maxGplLineChars: 256,
} as const;

export type RawSwatch = {
  name: string;
  red: number;
  green: number;
  blue: number;
  converted: boolean;
};

const CHANNEL_MAX = 255;
const HEX_RADIX = 16;
const FALLBACK_NAME = "Cor";

const D50_X = 0.96422;
const D50_Z = 0.82521;
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

const unit = (value: number): number => Math.min(1, Math.max(0, finite(value)));

const channel = (value: number): number =>
  Math.round(Math.min(CHANNEL_MAX, Math.max(0, finite(value))));

export const toHex = (red: number, green: number, blue: number): string =>
  `#${[red, green, blue].map((value) => channel(value).toString(HEX_RADIX).padStart(2, "0")).join("")}`;

export const cmykToRgb = (
  cyan: number,
  magenta: number,
  yellow: number,
  black: number,
): [number, number, number] => {
  const key = 1 - unit(black);
  return [
    CHANNEL_MAX * (1 - unit(cyan)) * key,
    CHANNEL_MAX * (1 - unit(magenta)) * key,
    CHANNEL_MAX * (1 - unit(yellow)) * key,
  ];
};

export const grayToRgb = (lightness: number): [number, number, number] => {
  const value = CHANNEL_MAX * unit(lightness);
  return [value, value, value];
};

const gamma = (linear: number): number => {
  const clamped = unit(linear);
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
};

const inverseLab = (value: number): number => {
  const cube = value ** 3;
  return cube > LAB_EPSILON ? cube : (116 * value - 16) / LAB_KAPPA;
};

export const labToRgb = (
  lightness: number,
  greenRed: number,
  blueYellow: number,
): [number, number, number] => {
  const l = Math.min(100, Math.max(0, finite(lightness)));
  const fy = (l + 16) / 116;
  const fx = fy + Math.min(128, Math.max(-128, finite(greenRed))) / 500;
  const fz = fy - Math.min(128, Math.max(-128, finite(blueYellow))) / 200;
  const x = D50_X * inverseLab(fx);
  const y = l > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : l / LAB_KAPPA;
  const z = D50_Z * inverseLab(fz);
  const red = 3.1338561 * x - 1.6168667 * y - 0.4906146 * z;
  const green = -0.9787684 * x + 1.9161415 * y + 0.033454 * z;
  const blue = 0.0719453 * x - 0.2289914 * y + 1.4052427 * z;
  return [CHANNEL_MAX * gamma(red), CHANNEL_MAX * gamma(green), CHANNEL_MAX * gamma(blue)];
};

export const hsbToRgb = (
  hue: number,
  saturation: number,
  brightness: number,
): [number, number, number] => {
  const h = (((finite(hue) % 360) + 360) % 360) / 60;
  const s = unit(saturation);
  const v = unit(brightness);
  const sector = Math.floor(h);
  const fraction = h - sector;
  const p = v * (1 - s);
  const q = v * (1 - s * fraction);
  const t = v * (1 - s * (1 - fraction));
  const table: Array<[number, number, number]> = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  const [red, green, blue] = table[sector % 6] ?? [0, 0, 0];
  return [CHANNEL_MAX * red, CHANNEL_MAX * green, CHANNEL_MAX * blue];
};

export const swatchName = (raw: string): string =>
  sanitizeImportText(raw, PALETTE_LIMITS.maxNameStored) || FALLBACK_NAME;

export const finishPalette = (raw: readonly RawSwatch[]): Result<ImportOutcome> => {
  if (raw.length > PALETTE_LIMITS.maxSwatches) {
    return invalid(DESIGN_IMPORT_MESSAGE.paletteTooManySwatches);
  }
  const seen = new Set<string>();
  const swatches: ImportSwatch[] = [];
  for (const entry of raw) {
    const hex = toHex(entry.red, entry.green, entry.blue);
    if (seen.has(hex)) continue;
    seen.add(hex);
    swatches.push({ name: swatchName(entry.name), hex, converted: entry.converted });
  }
  if (swatches.length === 0) return invalid(DESIGN_IMPORT_MESSAGE.paletteEmpty);
  const converted = swatches.filter((swatch) => swatch.converted).length;
  return {
    ok: true,
    kind: DesignImportKind.Palette,
    palette: {
      swatches,
      notes:
        converted > 0 ? [{ kind: DesignImportNoteKind.SwatchConverted, count: converted }] : [],
    },
  };
};

export const decodeUtf16Be = (bytes: Uint8Array, start: number, chars: number): string | null => {
  if (chars > PALETTE_LIMITS.maxNameRead || start + chars * 2 > bytes.length) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const units: number[] = [];
  for (let index = 0; index < chars; index += 1) {
    const unitValue = view.getUint16(start + index * 2, false);
    if (unitValue === 0) break;
    units.push(unitValue);
  }
  return String.fromCharCode(...units);
};

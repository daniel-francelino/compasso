import type { BrushParams } from "@/lib/shared/design/raster/brush";
import type { Point } from "@/lib/shared/design/raster/pixel-buffer";
import { DesignTool } from "@/lib/shared/design/types";
import type { ValueOf } from "@/lib/shared/utils";

export const PaintSampleMode = {
  Layer: "layer",
  All: "all",
} as const;
export type PaintSampleMode = ValueOf<typeof PaintSampleMode>;

export const PAINT_SAMPLE_LABEL: Record<PaintSampleMode, string> = {
  [PaintSampleMode.Layer]: "Camada atual",
  [PaintSampleMode.All]: "Camadas de pixels",
};

export const PAINT_LIMITS = {
  minSize: 1,
  maxSize: 1000,
  minPercent: 0,
  maxPercent: 100,
  spacingPercent: 25,
  smoothingRadiusPx: 50,
  sizeStepRatio: 0.1,
  hardnessStep: 10,
} as const;

export const PAINT_REASON = "Selecione uma camada de pixels visível e desbloqueada para pintar.";

export const PAINT_UPLOAD_REASON =
  "Pintar exige permissão para enviar arquivos à biblioteca de mídia.";

export type BrushTool =
  | typeof DesignTool.Brush
  | typeof DesignTool.Eraser
  | typeof DesignTool.Clone
  | typeof DesignTool.Dodge
  | typeof DesignTool.Burn;

export type PaintSample = Point & { pressure: number };

export type PaintInput = { shift: boolean; alt: boolean; pressure: number };

export type PressureOptions = { size: boolean; opacity: boolean };

export const DEFAULT_PRESSURE_OPTIONS: PressureOptions = { size: false, opacity: false };

export const MIN_PRESSURE_SIZE_RATIO = 0.1;

export const PRESSURE_LABEL: Record<keyof PressureOptions, string> = {
  size: "Pressão no tamanho",
  opacity: "Pressão na opacidade",
};

export const withPressure = (
  params: BrushParams,
  pressure: number,
  options: PressureOptions,
): BrushParams => {
  const level = Math.min(1, Math.max(0, Number.isFinite(pressure) ? pressure : 1));
  return {
    ...params,
    size: options.size ? params.size * Math.max(MIN_PRESSURE_SIZE_RATIO, level) : params.size,
    opacity: options.opacity ? params.opacity * level : params.opacity,
  };
};

export type BrushOptions = {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  smoothing: number;
};

export type BrushOptionKey = keyof BrushOptions;

export const DEFAULT_BRUSH_OPTIONS: BrushOptions = {
  size: 40,
  hardness: 80,
  opacity: 100,
  flow: 100,
  smoothing: 0,
};

export const isBrushTool = (tool: DesignTool): tool is BrushTool =>
  tool === DesignTool.Brush ||
  tool === DesignTool.Eraser ||
  tool === DesignTool.Clone ||
  tool === DesignTool.Dodge ||
  tool === DesignTool.Burn;

export const isRetouchTool = (tool: DesignTool): boolean =>
  tool === DesignTool.Clone || tool === DesignTool.Dodge || tool === DesignTool.Burn;

export const CLONE_SOURCE_HINT = "Alt+clique para definir a origem.";

export const isFillTool = (tool: DesignTool): boolean =>
  tool === DesignTool.Fill || tool === DesignTool.Gradient;

export const isPaintTool = (tool: DesignTool): boolean =>
  isBrushTool(tool) || isFillTool(tool) || tool === DesignTool.Eyedropper;

const clampTo = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

const clampBrushOption = (key: BrushOptionKey, value: number): number =>
  key === "size"
    ? clampTo(Math.round(value), PAINT_LIMITS.minSize, PAINT_LIMITS.maxSize)
    : clampTo(Math.round(value), PAINT_LIMITS.minPercent, PAINT_LIMITS.maxPercent);

export const withBrushOption = (
  options: BrushOptions,
  key: BrushOptionKey,
  value: number,
): BrushOptions => ({ ...options, [key]: clampBrushOption(key, value) });

const DIGIT = /^[0-9]$/;

const sizeStep = (size: number): number =>
  Math.max(1, Math.round(size * PAINT_LIMITS.sizeStepRatio));

const DECREASE_KEYS: readonly string[] = ["[", "{", ",", "<"];
const INCREASE_KEYS: readonly string[] = ["]", "}", ".", ">"];
const HARDNESS_KEYS: readonly string[] = ["{", "}", "<", ">"];
const DECREASE_CODE = "BracketLeft";
const INCREASE_CODE = "BracketRight";

const stepDirection = (key: string, code: string): number => {
  if (DECREASE_KEYS.includes(key) || code === DECREASE_CODE) return -1;
  if (INCREASE_KEYS.includes(key) || code === INCREASE_CODE) return 1;
  return 0;
};

export const adjustBrushByKey = (
  options: BrushOptions,
  key: string,
  shift: boolean,
  code = "",
): BrushOptions | null => {
  if (DIGIT.test(key)) {
    return withBrushOption(options, "opacity", key === "0" ? 100 : Number(key) * 10);
  }
  const direction = stepDirection(key, code);
  if (direction === 0) return null;
  const hardness = HARDNESS_KEYS.includes(key) || shift;
  if (hardness) {
    return withBrushOption(
      options,
      "hardness",
      options.hardness + direction * PAINT_LIMITS.hardnessStep,
    );
  }
  return withBrushOption(options, "size", options.size + direction * sizeStep(options.size));
};

export const toBrushParams = (
  options: BrushOptions,
  color: { r: number; g: number; b: number },
  erase: boolean,
): BrushParams => ({
  size: options.size,
  hardness: options.hardness / 100,
  opacity: options.opacity / 100,
  flow: options.flow / 100,
  color,
  erase,
});

export const smoothingRadius = (options: BrushOptions): number =>
  (options.smoothing / 100) * PAINT_LIMITS.smoothingRadiusPx;

type RasterPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  pixelWidth: number;
  pixelHeight: number;
};

export const docToLayerPoint = (placement: RasterPlacement, point: Point): Point => {
  const radians = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - (placement.x + placement.width / 2);
  const dy = point.y - (placement.y + placement.height / 2);
  const localX = dx * cos + dy * sin + placement.width / 2;
  const localY = -dx * sin + dy * cos + placement.height / 2;
  return {
    x: (localX * placement.pixelWidth) / placement.width,
    y: (localY * placement.pixelHeight) / placement.height,
  };
};

export const layerScale = (placement: RasterPlacement): number =>
  placement.width / placement.pixelWidth;

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) return null;
  const [, r = "0", g = "0", b = "0"] = match;
  return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) };
};

export const cursorDiameterPx = (options: BrushOptions, layerToScreen: number): number =>
  Math.max(2, options.size * layerToScreen);

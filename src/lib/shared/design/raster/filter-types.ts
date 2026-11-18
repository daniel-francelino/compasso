import { clamp } from "@/lib/shared/design/raster/numeric";
import type { ValueOf } from "@/lib/shared/utils";

export const DesignFilter = {
  GaussianBlur: "gaussian_blur",
  Sharpen: "sharpen",
  Noise: "noise",
  Pixelate: "pixelate",
} as const;
export type DesignFilter = ValueOf<typeof DesignFilter>;

export const DESIGN_FILTER_LABEL: Record<DesignFilter, string> = {
  [DesignFilter.GaussianBlur]: "Desfoque gaussiano",
  [DesignFilter.Sharpen]: "Nitidez",
  [DesignFilter.Noise]: "Ruído",
  [DesignFilter.Pixelate]: "Mosaico",
};

export const FILTER_LIMITS = {
  blurRadius: { min: 1, max: 100 },
  sharpenAmount: { min: 1, max: 300 },
  sharpenRadius: { min: 1, max: 50 },
  sharpenThreshold: { min: 0, max: 255 },
  noiseAmount: { min: 1, max: 100 },
  pixelateCell: { min: 2, max: 128 },
} as const;

export const FILTER_REASON =
  "Selecione uma camada de pixels visível e desbloqueada para aplicar o filtro.";
export const FILTER_FAILED_MESSAGE = "Não foi possível aplicar o filtro. Tente de novo.";
export const FILTER_WORKING_MESSAGE = "Processando…";

export type FilterParams =
  | { filter: typeof DesignFilter.GaussianBlur; radius: number }
  | { filter: typeof DesignFilter.Sharpen; amount: number; radius: number; threshold: number }
  | { filter: typeof DesignFilter.Noise; amount: number; monochrome: boolean; seed: number }
  | { filter: typeof DesignFilter.Pixelate; cell: number };

export const defaultFilterParams = (filter: DesignFilter, seed = 1): FilterParams => {
  if (filter === DesignFilter.GaussianBlur) return { filter, radius: 8 };
  if (filter === DesignFilter.Sharpen) return { filter, amount: 100, radius: 2, threshold: 0 };
  if (filter === DesignFilter.Noise) return { filter, amount: 20, monochrome: true, seed };
  return { filter, cell: 12 };
};

const whole = (value: number, min: number, max: number): number =>
  clamp(Number.isFinite(value) ? Math.round(value) : min, min, max);

export const normalizeFilterParams = (params: FilterParams): FilterParams => {
  if (params.filter === DesignFilter.GaussianBlur) {
    const { min, max } = FILTER_LIMITS.blurRadius;
    return { ...params, radius: whole(params.radius, min, max) };
  }
  if (params.filter === DesignFilter.Sharpen) {
    const amount = FILTER_LIMITS.sharpenAmount;
    const radius = FILTER_LIMITS.sharpenRadius;
    const threshold = FILTER_LIMITS.sharpenThreshold;
    return {
      ...params,
      amount: whole(params.amount, amount.min, amount.max),
      radius: whole(params.radius, radius.min, radius.max),
      threshold: whole(params.threshold, threshold.min, threshold.max),
    };
  }
  if (params.filter === DesignFilter.Noise) {
    const { min, max } = FILTER_LIMITS.noiseAmount;
    return { ...params, amount: whole(params.amount, min, max) };
  }
  const { min, max } = FILTER_LIMITS.pixelateCell;
  return { ...params, cell: whole(params.cell, min, max) };
};

const KERNEL_SIGMAS = 3;

export const filterHalo = (params: FilterParams): number => {
  if (params.filter === DesignFilter.GaussianBlur || params.filter === DesignFilter.Sharpen) {
    return Math.max(1, Math.ceil(params.radius * KERNEL_SIGMAS));
  }
  return 0;
};

export const filterSignature = (params: FilterParams): string => JSON.stringify(params);

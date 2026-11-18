import { DesignBlendMode } from "@/lib/shared/design/types";
import type { ValueOf } from "@/lib/shared/utils";

export const GradientKind = { Linear: "linear", Radial: "radial" } as const;
export type GradientKind = ValueOf<typeof GradientKind>;

export const GRADIENT_KIND_LABEL: Record<GradientKind, string> = {
  [GradientKind.Linear]: "Linear",
  [GradientKind.Radial]: "Radial",
};

export const FILL_LIMITS = {
  minTolerance: 0,
  maxTolerance: 255,
  minPercent: 0,
  maxPercent: 100,
  defaultTolerance: 32,
} as const;

export const FILL_HISTORY_LABEL = "Balde de tinta";
export const GRADIENT_HISTORY_LABEL = "Gradiente";

export type BucketToolOptions = {
  tolerance: number;
  contiguous: boolean;
  opacity: number;
  blendMode: DesignBlendMode;
};

export type GradientOptions = {
  kind: GradientKind;
  reverse: boolean;
  opacity: number;
  blendMode: DesignBlendMode;
};

export const DEFAULT_BUCKET_TOOL_OPTIONS: BucketToolOptions = {
  tolerance: FILL_LIMITS.defaultTolerance,
  contiguous: true,
  opacity: 100,
  blendMode: DesignBlendMode.Normal,
};

export const DEFAULT_GRADIENT_OPTIONS: GradientOptions = {
  kind: GradientKind.Linear,
  reverse: false,
  opacity: 100,
  blendMode: DesignBlendMode.Normal,
};

const clampTo = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));

export const clampPercent = (value: number): number =>
  clampTo(value, FILL_LIMITS.minPercent, FILL_LIMITS.maxPercent);

export const clampTolerance = (value: number): number =>
  clampTo(value, FILL_LIMITS.minTolerance, FILL_LIMITS.maxTolerance);

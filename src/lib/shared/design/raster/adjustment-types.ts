import type { ValueOf } from "@/lib/shared/utils";

export const AdjustmentType = {
  BrightnessContrast: "brightness_contrast",
  Levels: "levels",
  Curves: "curves",
  HueSaturation: "hue_saturation",
  ColorBalance: "color_balance",
  BlackWhite: "black_white",
  Invert: "invert",
  Threshold: "threshold",
} as const;
export type AdjustmentType = ValueOf<typeof AdjustmentType>;

export const ChannelTarget = {
  Rgb: "rgb",
  Red: "red",
  Green: "green",
  Blue: "blue",
} as const;
export type ChannelTarget = ValueOf<typeof ChannelTarget>;

export const ToneRange = {
  Shadows: "shadows",
  Midtones: "midtones",
  Highlights: "highlights",
} as const;
export type ToneRange = ValueOf<typeof ToneRange>;

export const MAX_CURVE_POINTS = 16;
export const MIN_CURVE_POINTS = 2;

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

export const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  [AdjustmentType.BrightnessContrast]: "Brilho/contraste",
  [AdjustmentType.Levels]: "Níveis",
  [AdjustmentType.Curves]: "Curvas",
  [AdjustmentType.HueSaturation]: "Matiz/saturação",
  [AdjustmentType.ColorBalance]: "Equilíbrio de cores",
  [AdjustmentType.BlackWhite]: "Preto e branco",
  [AdjustmentType.Invert]: "Inverter",
  [AdjustmentType.Threshold]: "Limiar",
};

export const CHANNEL_TARGET_LABEL: Record<ChannelTarget, string> = {
  [ChannelTarget.Rgb]: "RGB",
  [ChannelTarget.Red]: "Vermelho",
  [ChannelTarget.Green]: "Verde",
  [ChannelTarget.Blue]: "Azul",
};

export const TONE_RANGE_LABEL: Record<ToneRange, string> = {
  [ToneRange.Shadows]: "Sombras",
  [ToneRange.Midtones]: "Tons médios",
  [ToneRange.Highlights]: "Realces",
};

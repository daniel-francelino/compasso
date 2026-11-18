import {
  AdjustmentType,
  ChannelTarget,
  ToneRange,
} from "@/lib/shared/design/raster/adjustment-types";
import type { AdjustmentParams, ColorShift } from "@/lib/shared/design/raster/adjustment-schemas";
import {
  brightnessContrastLut,
  composeLuts,
  curveLut,
  levelsLut,
  type Lut,
} from "@/lib/shared/design/raster/adjustment-luts";
import {
  LUMA_BLUE,
  LUMA_GREEN,
  LUMA_RED,
  at,
  clamp,
  clampByte,
} from "@/lib/shared/design/raster/numeric";
import { type PixelBuffer, clonePixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

type ColorBalanceParams = Extract<AdjustmentParams, { type: typeof AdjustmentType.ColorBalance }>;
type BlackWhiteParams = Extract<AdjustmentParams, { type: typeof AdjustmentType.BlackWhite }>;

const COLOR_BALANCE_RANGE = 0.4;
const HUE_SECTOR = 60;

const identityShift: ColorShift = { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 };

export const defaultAdjustment = (type: AdjustmentType): AdjustmentParams => {
  switch (type) {
    case AdjustmentType.BrightnessContrast:
      return { type, brightness: 0, contrast: 0 };
    case AdjustmentType.Levels: {
      const channel = {
        inputBlack: 0,
        inputWhite: 255,
        gamma: 1,
        outputBlack: 0,
        outputWhite: 255,
      };
      return {
        type,
        channels: {
          [ChannelTarget.Rgb]: channel,
          [ChannelTarget.Red]: channel,
          [ChannelTarget.Green]: channel,
          [ChannelTarget.Blue]: channel,
        },
      };
    }
    case AdjustmentType.Curves: {
      const line = [
        { x: 0, y: 0 },
        { x: 255, y: 255 },
      ];
      return {
        type,
        channels: {
          [ChannelTarget.Rgb]: line,
          [ChannelTarget.Red]: line,
          [ChannelTarget.Green]: line,
          [ChannelTarget.Blue]: line,
        },
      };
    }
    case AdjustmentType.HueSaturation:
      return { type, hue: 0, saturation: 0, lightness: 0 };
    case AdjustmentType.ColorBalance:
      return {
        type,
        shadows: identityShift,
        midtones: identityShift,
        highlights: identityShift,
        preserveLuminosity: true,
      };
    case AdjustmentType.BlackWhite:
      return { type, reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 };
    case AdjustmentType.Invert:
      return { type };
    case AdjustmentType.Threshold:
      return { type, level: 128 };
  }
};

const applyLuts = (src: PixelBuffer, dst: PixelBuffer, red: Lut, green: Lut, blue: Lut): void => {
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = at(red, at(s, i));
    d[i + 1] = at(green, at(s, i + 1));
    d[i + 2] = at(blue, at(s, i + 2));
    d[i + 3] = at(s, i + 3);
  }
};

const channelLuts = (master: Lut, red: Lut, green: Lut, blue: Lut): [Lut, Lut, Lut] => [
  composeLuts(master, red),
  composeLuts(master, green),
  composeLuts(master, blue),
];

const hsl = new Float64Array(3);

const rgbToHsl = (r: number, g: number, b: number): void => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  hsl[2] = l;
  if (d === 0) {
    hsl[0] = 0;
    hsl[1] = 0;
    return;
  }
  hsl[1] = d / (1 - Math.abs(2 * l - 1));
  if (max === r) hsl[0] = (((g - b) / d) % 6) * HUE_SECTOR;
  else if (max === g) hsl[0] = ((b - r) / d + 2) * HUE_SECTOR;
  else hsl[0] = ((r - g) / d + 4) * HUE_SECTOR;
  if (at(hsl, 0) < 0) hsl[0] = at(hsl, 0) + 360;
};

const hslChannel = (n: number, h: number, s: number, l: number): number => {
  const k = (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
};

const hueSaturation = (
  src: PixelBuffer,
  dst: PixelBuffer,
  hue: number,
  saturation: number,
  lightness: number,
): void => {
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    rgbToHsl(at(s, i) / 255, at(s, i + 1) / 255, at(s, i + 2) / 255);
    const h = (((at(hsl, 0) + hue) % 360) + 360) % 360;
    const sat0 = at(hsl, 1);
    const sat =
      saturation < 0 ? sat0 * (1 + saturation / 100) : sat0 + (1 - sat0) * (saturation / 100);
    const l0 = at(hsl, 2);
    const light = lightness < 0 ? l0 * (1 + lightness / 100) : l0 + (1 - l0) * (lightness / 100);
    d[i] = hslChannel(0, h, sat, light) * 255;
    d[i + 1] = hslChannel(8, h, sat, light) * 255;
    d[i + 2] = hslChannel(4, h, sat, light) * 255;
    d[i + 3] = at(s, i + 3);
  }
};

const colorBalance = (src: PixelBuffer, dst: PixelBuffer, params: ColorBalanceParams): void => {
  const shadows = params[ToneRange.Shadows];
  const mids = params[ToneRange.Midtones];
  const highs = params[ToneRange.Highlights];
  const scale = COLOR_BALANCE_RANGE / 100;
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    const r = at(s, i) / 255;
    const g = at(s, i + 1) / 255;
    const b = at(s, i + 2) / 255;
    const l = LUMA_RED * r + LUMA_GREEN * g + LUMA_BLUE * b;
    const wShadow = clamp(1 - 2 * l, 0, 1);
    const wHigh = clamp(2 * l - 1, 0, 1);
    const wMid = 1 - wShadow - wHigh;
    let nr = r + scale * (wShadow * shadows.cyanRed + wMid * mids.cyanRed + wHigh * highs.cyanRed);
    let ng =
      g +
      scale *
        (wShadow * shadows.magentaGreen + wMid * mids.magentaGreen + wHigh * highs.magentaGreen);
    let nb =
      b +
      scale * (wShadow * shadows.yellowBlue + wMid * mids.yellowBlue + wHigh * highs.yellowBlue);
    if (params.preserveLuminosity) {
      const delta = l - (LUMA_RED * nr + LUMA_GREEN * ng + LUMA_BLUE * nb);
      nr += delta;
      ng += delta;
      nb += delta;
    }
    d[i] = clampByte(nr * 255);
    d[i + 1] = clampByte(ng * 255);
    d[i + 2] = clampByte(nb * 255);
    d[i + 3] = at(s, i + 3);
  }
};

const blackWhite = (src: PixelBuffer, dst: PixelBuffer, params: BlackWhiteParams): void => {
  const weights = [
    params.reds,
    params.yellows,
    params.greens,
    params.cyans,
    params.blues,
    params.magentas,
  ].map((value) => value / 100);
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    const r = at(s, i) / 255;
    const g = at(s, i + 1) / 255;
    const b = at(s, i + 2) / 255;
    rgbToHsl(r, g, b);
    const position = at(hsl, 0) / HUE_SECTOR;
    const sector = Math.floor(position) % 6;
    const fraction = position - Math.floor(position);
    const weight = at(weights, sector) * (1 - fraction) + at(weights, (sector + 1) % 6) * fraction;
    const min = Math.min(r, g, b);
    const gray = clampByte((min + (Math.max(r, g, b) - min) * weight) * 255);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
    d[i + 3] = at(s, i + 3);
  }
};

const invert = (src: PixelBuffer, dst: PixelBuffer): void => {
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = 255 - at(s, i);
    d[i + 1] = 255 - at(s, i + 1);
    d[i + 2] = 255 - at(s, i + 2);
    d[i + 3] = at(s, i + 3);
  }
};

const threshold = (src: PixelBuffer, dst: PixelBuffer, level: number): void => {
  const s = src.data;
  const d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    const luma = LUMA_RED * at(s, i) + LUMA_GREEN * at(s, i + 1) + LUMA_BLUE * at(s, i + 2);
    const value = luma >= level ? 255 : 0;
    d[i] = value;
    d[i + 1] = value;
    d[i + 2] = value;
    d[i + 3] = at(s, i + 3);
  }
};

export const applyAdjustmentTo = (
  src: PixelBuffer,
  dst: PixelBuffer,
  params: AdjustmentParams,
): void => {
  switch (params.type) {
    case AdjustmentType.BrightnessContrast: {
      const lut = brightnessContrastLut(params.brightness, params.contrast);
      applyLuts(src, dst, lut, lut, lut);
      return;
    }
    case AdjustmentType.Levels: {
      const c = params.channels;
      const [r, g, b] = channelLuts(
        levelsLut(c.rgb),
        levelsLut(c.red),
        levelsLut(c.green),
        levelsLut(c.blue),
      );
      applyLuts(src, dst, r, g, b);
      return;
    }
    case AdjustmentType.Curves: {
      const c = params.channels;
      const [r, g, b] = channelLuts(
        curveLut(c.rgb),
        curveLut(c.red),
        curveLut(c.green),
        curveLut(c.blue),
      );
      applyLuts(src, dst, r, g, b);
      return;
    }
    case AdjustmentType.HueSaturation:
      hueSaturation(src, dst, params.hue, params.saturation, params.lightness);
      return;
    case AdjustmentType.ColorBalance:
      colorBalance(src, dst, params);
      return;
    case AdjustmentType.BlackWhite:
      blackWhite(src, dst, params);
      return;
    case AdjustmentType.Invert:
      invert(src, dst);
      return;
    case AdjustmentType.Threshold:
      threshold(src, dst, params.level);
  }
};

export const applyAdjustment = (buffer: PixelBuffer, params: AdjustmentParams): PixelBuffer => {
  const out = clonePixelBuffer(buffer);
  applyAdjustmentTo(buffer, out, params);
  return out;
};

import { z } from "zod";
import {
  AdjustmentType,
  ChannelTarget,
  MAX_CURVE_POINTS,
  MIN_CURVE_POINTS,
  type ToneRange,
} from "@/lib/shared/design/raster/adjustment-types";
import { clamp } from "@/lib/shared/design/raster/numeric";

const clamped = (min: number, max: number) =>
  z
    .number()
    .finite()
    .transform((value) => clamp(value, min, max));

const byte = clamped(0, 255);

export const levelsChannelSchema = z.object({
  inputBlack: byte,
  inputWhite: byte,
  gamma: clamped(0.1, 10),
  outputBlack: byte,
  outputWhite: byte,
});

export const curvePointSchema = z.object({ x: byte, y: byte });

export const curveSchema = z
  .array(curvePointSchema)
  .min(MIN_CURVE_POINTS)
  .max(MAX_CURVE_POINTS)
  .refine((points) => points.every((point, i) => i === 0 || point.x > (points[i - 1]?.x ?? 0)), {
    message: "curve_points_not_increasing",
  });

const channelRecord = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    [ChannelTarget.Rgb]: schema,
    [ChannelTarget.Red]: schema,
    [ChannelTarget.Green]: schema,
    [ChannelTarget.Blue]: schema,
  });

export const colorShiftSchema = z.object({
  cyanRed: clamped(-100, 100),
  magentaGreen: clamped(-100, 100),
  yellowBlue: clamped(-100, 100),
});

const blackWhiteWeight = clamped(-200, 300);

export const adjustmentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(AdjustmentType.BrightnessContrast),
    brightness: clamped(-100, 100),
    contrast: clamped(-100, 100),
  }),
  z.object({
    type: z.literal(AdjustmentType.Levels),
    channels: channelRecord(levelsChannelSchema),
  }),
  z.object({
    type: z.literal(AdjustmentType.Curves),
    channels: channelRecord(curveSchema),
  }),
  z.object({
    type: z.literal(AdjustmentType.HueSaturation),
    hue: clamped(-180, 180),
    saturation: clamped(-100, 100),
    lightness: clamped(-100, 100),
  }),
  z.object({
    type: z.literal(AdjustmentType.ColorBalance),
    shadows: colorShiftSchema,
    midtones: colorShiftSchema,
    highlights: colorShiftSchema,
    preserveLuminosity: z.boolean(),
  }),
  z.object({
    type: z.literal(AdjustmentType.BlackWhite),
    reds: blackWhiteWeight,
    yellows: blackWhiteWeight,
    greens: blackWhiteWeight,
    cyans: blackWhiteWeight,
    blues: blackWhiteWeight,
    magentas: blackWhiteWeight,
  }),
  z.object({ type: z.literal(AdjustmentType.Invert) }),
  z.object({ type: z.literal(AdjustmentType.Threshold), level: byte }),
]);

export type AdjustmentParams = z.infer<typeof adjustmentSchema>;
export type LevelsChannelParams = z.infer<typeof levelsChannelSchema>;
export type CurvePoint = z.infer<typeof curvePointSchema>;
export type ColorShift = z.infer<typeof colorShiftSchema>;
export type ToneShifts = Record<ToneRange, ColorShift>;

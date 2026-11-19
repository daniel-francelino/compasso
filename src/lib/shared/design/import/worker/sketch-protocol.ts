import { z } from "zod";
import { DESIGN_IMPORT_LIMITS, SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { SketchRefusal } from "@/lib/shared/design/import/types";

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === "[object ArrayBuffer]";

const FileSchema = z.custom<File>(
  (value) =>
    typeof File !== "undefined" &&
    value instanceof File &&
    value.size <= SKETCH_LIMITS.maxFileBytes,
  { message: "file" },
);

export { SketchRefusal };

export const ARTBOARD_ID = /^\d{1,4}:\d{1,6}$/;

export const SketchRequestSchema = z
  .object({
    id: z.number().int().min(0),
    file: FileSchema,
    usedBytes: z.number().int().min(0).max(DESIGN_LIMITS.rasterBudgetBytes),
    capacityElements: z.number().int().min(0).max(DESIGN_LIMITS.maxElements),
    artboard: z.string().regex(ARTBOARD_ID).nullable(),
  })
  .strict();
export type SketchRequest = z.infer<typeof SketchRequestSchema>;

const side = z.number().int().min(1).max(DESIGN_IMPORT_LIMITS.maxPageSide);
const count = z.number().int().min(0).max(DESIGN_LIMITS.maxElements);

const LayerSchema = z
  .object({
    name: z.string().max(DESIGN_LIMITS.layerNameMax),
    x: z.number().int().min(-DESIGN_LIMITS.maxCoordinate).max(DESIGN_LIMITS.maxCoordinate),
    y: z.number().int().min(-DESIGN_LIMITS.maxCoordinate).max(DESIGN_LIMITS.maxCoordinate),
    width: z.number().int().min(1).max(DESIGN_LIMITS.maxSize),
    height: z.number().int().min(1).max(DESIGN_LIMITS.maxSize),
    rotation: z.number().finite().min(-360).max(360),
    opacity: z.number().min(0).max(1),
    hidden: z.boolean(),
    isText: z.boolean(),
    pixelWidth: side,
    pixelHeight: side,
    pixels: z.custom<ArrayBuffer>(isArrayBuffer, { message: "array-buffer" }),
  })
  .strict();
export type SketchLayer = z.infer<typeof LayerSchema>;

const OptionSchema = z
  .object({
    id: z.string().regex(ARTBOARD_ID),
    name: z.string().max(200),
    width: z.number().finite().min(0).max(1e9),
    height: z.number().finite().min(0).max(1e9),
  })
  .strict();
export type SketchOption = z.infer<typeof OptionSchema>;

export const SketchResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal("result"),
      width: side,
      height: side,
      layers: z.array(LayerSchema).max(DESIGN_LIMITS.maxElements),
      downscaled: z.boolean(),
      styles: count,
      unsupported: count,
      deepGroups: count,
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal("choice"),
      options: z.array(OptionSchema).min(2).max(100),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal("error"),
      refusal: z.nativeEnum(SketchRefusal),
      args: z.array(z.number().int().min(0).max(1e9)).max(2),
    })
    .strict(),
]);
export type SketchResponse = z.infer<typeof SketchResponseSchema>;

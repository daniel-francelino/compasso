import { z } from "zod";
import { SVG_PATH_LIMITS } from "@/lib/shared/design/import/handlers/svg-shapes";
import { SvgFallback } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { SVG_LIMITS } from "@/lib/shared/design/import/limits";
import { pathPaintSchema, pathStrokeSchema } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignPathFillRule } from "@/lib/shared/design/types";
import { validatePathData } from "@/lib/shared/design/vector/path-data";

const isUint8Array = (value: unknown): value is Uint8Array =>
  Object.prototype.toString.call(value) === "[object Uint8Array]";

export const SvgRequestSchema = z
  .object({
    id: z.number().int().min(0),
    bytes: z
      .custom<Uint8Array>(isUint8Array, { message: "uint8-array" })
      .refine((bytes) => bytes.byteLength <= SVG_LIMITS.maxFileBytes, { message: "file-size" }),
  })
  .strict();
export type SvgRequest = z.infer<typeof SvgRequestSchema>;

const coordinate = z
  .number()
  .finite()
  .min(-SVG_PATH_LIMITS.maxCoordinate)
  .max(SVG_PATH_LIMITS.maxCoordinate);

const pathData = z
  .string()
  .min(1)
  .max(DESIGN_LIMITS.maxPathData)
  .refine((data) => validatePathData(data, SVG_PATH_LIMITS).ok, { message: "path-data" });

const shapeSchema = z
  .object({
    name: z.string().max(DESIGN_LIMITS.layerNameMax).nullable(),
    d: pathData,
    commandCount: z.number().int().min(1).max(DESIGN_LIMITS.maxPathCommands),
    fill: pathPaintSchema.nullable(),
    stroke: pathStrokeSchema.nullable(),
    fillRule: z.nativeEnum(DesignPathFillRule),
    opacity: z.number().finite().gt(0).max(1),
    bounds: z
      .object({ minX: coordinate, minY: coordinate, maxX: coordinate, maxY: coordinate })
      .strict(),
  })
  .strict();

const side = z.number().finite().gt(0).max(DESIGN_LIMITS.maxSize);

const dataBytesMatch = (response: {
  status: string;
  shapes?: { d: string }[];
  dataBytes?: number;
}) =>
  response.status !== "result" ||
  (response.shapes ?? []).reduce((total, shape) => total + shape.d.length, 0) ===
    response.dataBytes;

export const SvgResponseSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        id: z.number().int().min(0),
        status: z.literal("result"),
        width: side,
        height: side,
        shapes: z.array(shapeSchema).min(1).max(DESIGN_LIMITS.maxElements),
        dataBytes: z.number().int().min(1).max(DESIGN_LIMITS.maxVectorImportBytes),
      })
      .strict(),
    z
      .object({
        id: z.number().int().min(0),
        status: z.literal("failure"),
        reason: z.nativeEnum(SvgFallback),
      })
      .strict(),
  ])
  .refine(dataBytesMatch, { message: "data-bytes" });
export type SvgResponse = z.infer<typeof SvgResponseSchema>;

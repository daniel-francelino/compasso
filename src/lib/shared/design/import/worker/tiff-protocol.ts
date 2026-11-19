import { z } from "zod";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { TiffRefusal } from "@/lib/shared/design/import/worker/tiff-header";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === "[object ArrayBuffer]";

const FileSchema = z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, {
  message: "file",
});

export const TiffRequestSchema = z
  .object({
    id: z.number().int().min(0),
    file: FileSchema,
    usedBytes: z.number().int().min(0).max(DESIGN_LIMITS.rasterBudgetBytes),
  })
  .strict();
export type TiffRequest = z.infer<typeof TiffRequestSchema>;

const side = z.number().int().min(1).max(DESIGN_IMPORT_LIMITS.maxPageSide);

export const TiffResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal("result"),
      width: side,
      height: side,
      sourceWidth: z.number().int().min(1).max(32768),
      sourceHeight: z.number().int().min(1).max(32768),
      pixels: z.custom<ArrayBuffer>(isArrayBuffer, { message: "array-buffer" }),
      bitsPerSample: z.number().int().min(1).max(32),
      cmyk: z.boolean(),
      gray: z.boolean(),
      downscaled: z.boolean(),
      ifdCount: z.number().int().min(1).max(64),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal("error"),
      refusal: z.nativeEnum(TiffRefusal),
    })
    .strict(),
]);
export type TiffResponse = z.infer<typeof TiffResponseSchema>;

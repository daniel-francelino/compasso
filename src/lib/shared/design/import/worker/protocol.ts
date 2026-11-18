import { z } from "zod";
import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { DesignImportFailure, DesignImportFormat } from "@/lib/shared/design/import/types";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const MAX_NODES = 65535;
const MAX_BLEND_NAME = 40;

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === "[object ArrayBuffer]";

const ArrayBufferSchema = z.custom<ArrayBuffer>(isArrayBuffer, { message: "array-buffer" });

const FileSchema = z.custom<File>((value) => typeof File !== "undefined" && value instanceof File, {
  message: "file",
});

const unit = z.number().min(0).max(1);
const side = z.number().int().min(1).max(DESIGN_IMPORT_LIMITS.maxPageSide);

export const WorkerLimitsSchema = z
  .object({
    capacityElements: z.number().int().min(0).max(DESIGN_LIMITS.maxElements),
    usedBytes: z.number().int().min(0).max(DESIGN_LIMITS.rasterBudgetBytes),
  })
  .strict();
export type WorkerLimits = z.infer<typeof WorkerLimitsSchema>;

export const WorkerRequestSchema = z
  .object({
    id: z.number().int().min(0),
    format: z.nativeEnum(DesignImportFormat),
    file: FileSchema,
    limits: WorkerLimitsSchema,
  })
  .strict();
export type WorkerRequest = z.infer<typeof WorkerRequestSchema>;

export const WorkerBoxSchema = z
  .object({
    left: z.number().int().min(0).max(DESIGN_IMPORT_LIMITS.maxPageSide),
    top: z.number().int().min(0).max(DESIGN_IMPORT_LIMITS.maxPageSide),
    width: side,
    height: side,
  })
  .strict();
export type WorkerBox = z.infer<typeof WorkerBoxSchema>;

export const WorkerNodeSchema = z
  .object({
    group: z.boolean(),
    depth: z.number().int().min(0).max(MAX_NODES),
    name: z.string().max(DESIGN_LIMITS.layerNameMax * 2),
    hidden: z.boolean(),
    opened: z.boolean(),
    opacity: unit,
    fillOpacity: unit,
    blendMode: z.string().max(MAX_BLEND_NAME),
    clipping: z.boolean(),
    text: z.boolean(),
    smartObject: z.boolean(),
    effects: z.boolean(),
    adjustment: z.boolean(),
    box: WorkerBoxSchema.nullable(),
    pixels: ArrayBufferSchema.nullable(),
  })
  .strict();
export type WorkerNode = z.infer<typeof WorkerNodeSchema>;

export const WorkerDocumentSchema = z
  .object({
    width: side,
    height: side,
    depthReduced: z.boolean(),
    cmyk: z.boolean(),
    flattened: z.boolean(),
    nodes: z.array(WorkerNodeSchema).max(MAX_NODES),
  })
  .strict();
export type WorkerDocument = z.infer<typeof WorkerDocumentSchema>;

export const WorkerStatus = {
  Progress: "progress",
  Result: "result",
  Error: "error",
} as const;

const ResponseUnion = z.discriminatedUnion("status", [
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal(WorkerStatus.Progress),
      done: z.number().int().min(0),
      total: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal(WorkerStatus.Result),
      document: WorkerDocumentSchema,
    })
    .strict(),
  z
    .object({
      id: z.number().int().min(0),
      status: z.literal(WorkerStatus.Error),
      failure: z.nativeEnum(DesignImportFailure),
    })
    .strict(),
]);
export const WorkerResponseSchema = ResponseUnion.refine(
  (value) => value.status !== WorkerStatus.Progress || value.done <= value.total,
  { message: "progress-range" },
);
export type WorkerResponse = z.infer<typeof WorkerResponseSchema>;

export const pixelBytesOf = (box: { width: number; height: number }): number =>
  rasterBytes(box.width, box.height);

export const transferablesOf = (document: WorkerDocument): ArrayBuffer[] =>
  document.nodes.flatMap((node) => (node.pixels === null ? [] : [node.pixels]));

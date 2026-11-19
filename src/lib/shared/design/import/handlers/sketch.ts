import { SKETCH_LIMITS } from "@/lib/shared/design/import/limits";
import {
  DESIGN_IMPORT_LAYER_NAME,
  DESIGN_IMPORT_MESSAGE,
  SKETCH_ARTBOARD_CHOICE,
} from "@/lib/shared/design/import/messages";
import { hasZipSignature } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  IMPORT_NEEDS_CHOICE,
  type ImportHandler,
  type ImportNote,
  type ImportOutcome,
  type WorkerImportInput,
} from "@/lib/shared/design/import/types";
import {
  type SketchChoice,
  type SketchJob,
  type SketchJobRequest,
  type SketchResult,
  runSketchJob,
} from "@/lib/shared/design/import/worker/sketch-client";
import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import type { RasterElement } from "@/lib/shared/design/schemas";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type SketchRunner = (
  request: SketchJobRequest,
  signal: AbortSignal | undefined,
) => Promise<Result<{ job: SketchJob }>>;

const notesOf = (result: SketchResult): ImportNote[] => {
  const texts = result.layers.filter((layer) => layer.isText).length;
  return [
    { kind: DesignImportNoteKind.Downscaled, count: result.downscaled ? 1 : 0 },
    { kind: DesignImportNoteKind.LayerStyleDropped, count: result.styles },
    { kind: DesignImportNoteKind.UnsupportedNode, count: result.unsupported },
    { kind: DesignImportNoteKind.TextAsPixels, count: texts },
    { kind: DesignImportNoteKind.FontsNotImported, count: texts },
    { kind: DesignImportNoteKind.GroupsFlattened, count: result.deepGroups },
  ].filter((note) => note.count > 0);
};

const designOf = (result: SketchResult, input: WorkerImportInput): ImportOutcome => {
  const elements: RasterElement[] = [];
  const buffers = new Map<string, PixelBuffer>();
  for (const layer of result.layers) {
    const id = input.newId();
    const buffer: PixelBuffer = {
      width: layer.pixelWidth,
      height: layer.pixelHeight,
      data: new Uint8ClampedArray(layer.pixels),
    };
    elements.push({
      ...createRasterLayer(id, emptyPage("import"), buffer),
      name: layer.name === "" ? DESIGN_IMPORT_LAYER_NAME.layer : layer.name,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      opacity: layer.opacity,
      hidden: layer.hidden,
      pixelWidth: buffer.width,
      pixelHeight: buffer.height,
    });
    buffers.set(id, buffer);
  }
  return {
    kind: DesignImportKind.Document,
    design: {
      format: DesignImportFormat.Sketch,
      width: result.width,
      height: result.height,
      elements,
      buffers,
      notes: notesOf(result),
      metadata: null,
    },
  };
};

const requestOf = (input: WorkerImportInput, artboard: string | null): SketchJobRequest => ({
  file: input.file,
  usedBytes: input.usedBytes,
  capacityElements: input.capacityElements,
  artboard,
});

const resumed = (job: SketchJob, input: WorkerImportInput): Result<ImportOutcome> =>
  job.status === "result"
    ? { ok: true, ...designOf(job, input) }
    : invalid(DESIGN_IMPORT_MESSAGE.sketchCorrupt);

const choiceOutcome = (
  choice: SketchChoice,
  input: WorkerImportInput,
  run: SketchRunner,
): ImportOutcome => ({
  kind: IMPORT_NEEDS_CHOICE,
  choice: {
    title: SKETCH_ARTBOARD_CHOICE.title,
    confirmLabel: SKETCH_ARTBOARD_CHOICE.confirmLabel,
    options: choice.options.map((option, index) => ({
      id: option.id,
      label: option.name === "" ? SKETCH_ARTBOARD_CHOICE.option(index + 1) : option.name,
      detail: SKETCH_ARTBOARD_CHOICE.detail(Math.round(option.width), Math.round(option.height)),
    })),
  },
  resume: async (chosen, signal) => {
    if (!choice.options.some((option) => option.id === chosen)) {
      return invalid(DESIGN_IMPORT_MESSAGE.sketchCorrupt);
    }
    const job = await run(requestOf(input, chosen), signal);
    return job.ok ? resumed(job.job, input) : job;
  },
});

export const createSketchHandler = (run: SketchRunner): ImportHandler => ({
  format: DesignImportFormat.Sketch,
  kind: DesignImportKind.Document,
  extensions: ["sketch"],
  maxBytes: SKETCH_LIMITS.maxFileBytes,
  runsIn: "worker",
  sniff: hasZipSignature,
  decode: async (input) => {
    const job = await run(requestOf(input, null), input.signal);
    if (!job.ok) return job;
    return job.job.status === "choice"
      ? { ok: true, ...choiceOutcome(job.job, input, run) }
      : { ok: true, ...designOf(job.job, input) };
  },
});

export const sketchHandler: ImportHandler = createSketchHandler(runSketchJob);

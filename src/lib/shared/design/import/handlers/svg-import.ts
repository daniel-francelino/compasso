import { decodeSvg } from "@/lib/shared/design/import/handlers/svg-raster";
import { buildPathElements } from "@/lib/shared/design/import/handlers/svg-vector-build";
import { SvgFallback } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { DESIGN_IMPORT_LIMITS, SVG_LIMITS } from "@/lib/shared/design/import/limits";
import { buildMetadata } from "@/lib/shared/design/import/metadata";
import { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { failureReason } from "@/lib/shared/design/import/refusal";
import { hasSvgHead } from "@/lib/shared/design/import/sniff";
import {
  DesignImportColorMode,
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  type ImportHandler,
  type ImportInput,
  type ImportKindResult,
} from "@/lib/shared/design/import/types";
import type { PageSize } from "@/lib/shared/design/types";
import { type SvgJobOutcome, runSvgVectorJob } from "@/lib/shared/design/import/worker/svg-client";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type SvgImportDeps = {
  parse: (
    bytes: Uint8Array,
    signal: AbortSignal | undefined,
  ) => SvgJobOutcome | Promise<SvgJobOutcome>;
  raster: (input: ImportInput) => Promise<Result<ImportKindResult>>;
};

const DEFAULT_DEPS: SvgImportDeps = {
  parse: (bytes, signal) => runSvgVectorJob(bytes, signal),
  raster: (input) => decodeSvg(input),
};

const clampSide = (value: number): number =>
  Math.min(
    DESIGN_IMPORT_LIMITS.maxPageSide,
    Math.max(DESIGN_IMPORT_LIMITS.minPageSide, Math.round(value)),
  );

const pageOf = (input: ImportInput, width: number, height: number): PageSize =>
  input.page ?? { width: clampSide(width), height: clampSide(height) };

const withLimitNote = (result: Result<ImportKindResult>): Result<ImportKindResult> =>
  result.ok
    ? {
        ...result,
        design: {
          ...result.design,
          notes: [
            ...result.design.notes,
            { kind: DesignImportNoteKind.VectorLimitReached, count: 1 },
          ],
        },
      }
    : result;

const rasterFallback = async (
  deps: SvgImportDeps,
  input: ImportInput,
  reason: SvgFallback,
): Promise<Result<ImportKindResult>> => {
  switch (reason) {
    case SvgFallback.Timeout:
      return invalid(DESIGN_IMPORT_MESSAGE.svgVectorTimeout);
    case SvgFallback.VectorLimit:
      return withLimitNote(await deps.raster(input));
    case SvgFallback.Unsupported:
    case SvgFallback.Malformed:
    case SvgFallback.ParseLimit:
    case SvgFallback.TooLarge:
    case SvgFallback.Internal:
      return deps.raster(input);
  }
};

export const decodeSvgVector = async (
  input: ImportInput,
  deps: SvgImportDeps = DEFAULT_DEPS,
): Promise<Result<ImportKindResult>> => {
  if (input.signal?.aborted === true) return IMPORT_CANCELLED;
  const parsed = await deps.parse(input.bytes, input.signal);
  if (!parsed.ok) {
    const coded = failureReason(parsed, SvgFallback);
    return coded === null ? parsed : rasterFallback(deps, input, coded.reason);
  }
  const page = pageOf(input, parsed.width, parsed.height);
  const built = buildPathElements(parsed, {
    page,
    capacityElements: input.capacityElements,
    documentBytes: input.documentBytes ?? 0,
    newId: input.newId,
  });
  if (!built.ok) return rasterFallback(deps, input, built.reason);
  return {
    ok: true,
    kind: DesignImportKind.Document,
    design: {
      format: DesignImportFormat.Svg,
      width: page.width,
      height: page.height,
      elements: built.elements,
      buffers: new Map(),
      notes: [],
      metadata: buildMetadata({
        source: {
          format: DesignImportFormat.Svg,
          colorMode: DesignImportColorMode.Rgb,
          bitsPerChannel: null,
          pageCount: null,
        },
        dimensions: {
          sourceWidth: Math.round(parsed.width),
          sourceHeight: Math.round(parsed.height),
          pageWidth: page.width,
          pageHeight: page.height,
        },
      }),
    },
  };
};

export const svgVectorHandler: ImportHandler = {
  format: DesignImportFormat.Svg,
  kind: DesignImportKind.Document,
  extensions: ["svg"],
  maxBytes: SVG_LIMITS.maxFileBytes,
  runsIn: "main",
  sniff: hasSvgHead,
  decode: (input) => decodeSvgVector(input),
};

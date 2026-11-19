import {
  type GatedSvg,
  type SvgParser,
  type SvgSize,
  gateSvg,
} from "@/lib/shared/design/import/handlers/svg-gate";
import {
  type SvgRender,
  domSvgParser,
  renderSvgBlob,
} from "@/lib/shared/design/import/handlers/svg-render";
import { DESIGN_IMPORT_LIMITS, SVG_LIMITS } from "@/lib/shared/design/import/limits";
import { buildMetadata } from "@/lib/shared/design/import/metadata";
import {
  DESIGN_IMPORT_LAYER_NAME,
  DESIGN_IMPORT_MESSAGE,
  IMPORT_CANCELLED,
} from "@/lib/shared/design/import/messages";
import { ImportAbortedError, ImportTimeoutError } from "@/lib/shared/design/import/run-limits";
import { hasSvgHead } from "@/lib/shared/design/import/sniff";
import { singleLayerDesign } from "@/lib/shared/design/import/single-layer";
import {
  DesignImportColorMode,
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  type ImportHandler,
  type ImportInput,
  type ImportKindResult,
  type ImportNote,
} from "@/lib/shared/design/import/types";
import { rasterBytes } from "@/lib/shared/design/raster-store";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

export type SvgDeps = { parse: SvgParser; render: SvgRender };

const DEFAULT_DEPS: SvgDeps = { parse: domSvgParser, render: renderSvgBlob };
const SVG_MIME = "image/svg+xml;charset=utf-8";

export const planSvgRaster = (size: SvgSize, usedBytes: number): Result<{ target: SvgSize }> => {
  const longest = Math.max(size.width, size.height);
  const scale = Math.min(SVG_LIMITS.maxScale, DESIGN_IMPORT_LIMITS.maxPageSide / longest);
  const side = (value: number): number => Math.max(1, Math.round(value * scale));
  const target = { width: side(size.width), height: side(size.height) };
  const { minPageSide, maxPageSide } = DESIGN_IMPORT_LIMITS;
  if (Math.min(target.width, target.height) < minPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooSmall(minPageSide));
  }
  if (Math.max(target.width, target.height) > maxPageSide) {
    return invalid(DESIGN_IMPORT_MESSAGE.canvasTooLarge(maxPageSide));
  }
  if (usedBytes + rasterBytes(target.width, target.height) > DESIGN_LIMITS.rasterBudgetBytes) {
    return invalid(DESIGN_IMPORT_MESSAGE.memory);
  }
  return { ok: true, target };
};

const withExplicitSize = (svg: GatedSvg, parse: SvgParser): Result<{ markup: string }> => {
  svg.document.setRootSize(svg.size.width, svg.size.height);
  const markup = svg.document.serialize();
  const again = gateSvg(new TextEncoder().encode(markup), parse);
  if (!again.ok) return invalid(DESIGN_IMPORT_MESSAGE.svgBlockedContent);
  return again.svg.explicitSize ? { ok: true, markup } : invalid(DESIGN_IMPORT_MESSAGE.svgNoSize);
};

const notesOf = (svg: GatedSvg): ImportNote[] => [
  { kind: DesignImportNoteKind.VectorRasterized, count: 1 },
  ...(svg.textCount > 0
    ? [{ kind: DesignImportNoteKind.FontsNotImported, count: svg.textCount }]
    : []),
];

const pixelsMatch = (
  pixels: { width: number; height: number; data: Uint8ClampedArray },
  target: SvgSize,
): boolean =>
  pixels.width === target.width &&
  pixels.height === target.height &&
  pixels.data.length === rasterBytes(target.width, target.height);

export const decodeSvg = async (
  input: ImportInput,
  deps: SvgDeps = DEFAULT_DEPS,
): Promise<Result<ImportKindResult>> => {
  if (input.signal?.aborted === true) return IMPORT_CANCELLED;
  const gated = gateSvg(input.bytes, deps.parse);
  if (!gated.ok) return gated;
  const { svg } = gated;
  const planned = planSvgRaster(svg.size, input.usedBytes);
  if (!planned.ok) return planned;
  const prepared = svg.explicitSize
    ? ({ ok: true, markup: new TextDecoder().decode(input.bytes) } as const)
    : withExplicitSize(svg, deps.parse);
  if (!prepared.ok) return prepared;
  let rendered: Awaited<ReturnType<SvgRender>>;
  try {
    rendered = await deps.render(new Blob([prepared.markup], { type: SVG_MIME }), planned.target, {
      timeoutMs: SVG_LIMITS.renderTimeoutMs,
      signal: input.signal,
    });
  } catch (error) {
    if (error instanceof ImportAbortedError) return IMPORT_CANCELLED;
    return invalid(
      error instanceof ImportTimeoutError
        ? DESIGN_IMPORT_MESSAGE.timedOut
        : DESIGN_IMPORT_MESSAGE.svgRender,
    );
  }
  if (!rendered.ok) return rendered;
  if (!pixelsMatch(rendered.pixels, planned.target))
    return invalid(DESIGN_IMPORT_MESSAGE.svgRender);
  return {
    ok: true,
    ...singleLayerDesign(DesignImportFormat.Svg, rendered.pixels, {
      newId: input.newId,
      fileName: input.file.name,
      notes: notesOf(svg),
      defaultName: DESIGN_IMPORT_LAYER_NAME.art,
      metadata: buildMetadata({
        source: {
          format: DesignImportFormat.Svg,
          colorMode: DesignImportColorMode.Rgb,
          bitsPerChannel: null,
          pageCount: null,
        },
        dimensions: {
          sourceWidth: Math.round(svg.size.width),
          sourceHeight: Math.round(svg.size.height),
          pageWidth: planned.target.width,
          pageHeight: planned.target.height,
        },
      }),
    }),
  };
};

export const svgHandler: ImportHandler = {
  format: DesignImportFormat.Svg,
  kind: DesignImportKind.Image,
  extensions: ["svg"],
  maxBytes: SVG_LIMITS.maxFileBytes,
  runsIn: "main",
  sniff: hasSvgHead,
  decode: (input) => decodeSvg(input),
};

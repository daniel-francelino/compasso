import { buildMetadata } from "@/lib/shared/design/import/metadata";
import { DESIGN_IMPORT_LAYER_NAME } from "@/lib/shared/design/import/messages";
import { singleLayerDesign } from "@/lib/shared/design/import/single-layer";
import { hasTiffSignature } from "@/lib/shared/design/import/sniff";
import {
  DesignImportColorMode,
  DesignImportFormat,
  DesignImportKind,
  DesignImportNoteKind,
  type ImportHandler,
  type ImportKindResult,
  type ImportNote,
  type WorkerImportInput,
} from "@/lib/shared/design/import/types";
import { type TiffResult, runTiffJob } from "@/lib/shared/design/import/worker/tiff-client";
import type { Result } from "@/lib/shared/server-utils";

const MAX_TIFF_BYTES = 100 * 1024 * 1024;
const BITS_PER_BYTE_CHANNEL = 8;

const notesOf = (result: TiffResult): ImportNote[] => [
  ...(result.bitsPerSample > BITS_PER_BYTE_CHANNEL
    ? [{ kind: DesignImportNoteKind.DepthReduced, count: 1 }]
    : []),
  ...(result.cmyk ? [{ kind: DesignImportNoteKind.CmykConverted, count: 1 }] : []),
  ...(result.ifdCount > 1 ? [{ kind: DesignImportNoteKind.FirstPageOnly, count: 1 }] : []),
  ...(result.downscaled ? [{ kind: DesignImportNoteKind.Downscaled, count: 1 }] : []),
];

const colorModeOf = (result: TiffResult): DesignImportColorMode =>
  result.cmyk
    ? DesignImportColorMode.Cmyk
    : result.gray
      ? DesignImportColorMode.Grayscale
      : DesignImportColorMode.Rgb;

const decodeTiff = async (input: WorkerImportInput): Promise<Result<ImportKindResult>> => {
  const job = await runTiffJob({ file: input.file, usedBytes: input.usedBytes }, input.signal);
  if (!job.ok) return job;
  const { result } = job;
  return {
    ok: true,
    ...singleLayerDesign(
      DesignImportFormat.Tiff,
      { width: result.width, height: result.height, data: new Uint8ClampedArray(result.pixels) },
      {
        newId: input.newId,
        fileName: input.file.name,
        notes: notesOf(result),
        defaultName: DESIGN_IMPORT_LAYER_NAME.image,
        metadata: buildMetadata({
          source: {
            format: DesignImportFormat.Tiff,
            colorMode: colorModeOf(result),
            bitsPerChannel: result.bitsPerSample,
            pageCount: result.ifdCount,
          },
          dimensions: {
            sourceWidth: result.sourceWidth,
            sourceHeight: result.sourceHeight,
            pageWidth: result.width,
            pageHeight: result.height,
          },
        }),
      },
    ),
  };
};

export const tiffHandler: ImportHandler = {
  format: DesignImportFormat.Tiff,
  kind: DesignImportKind.Image,
  extensions: ["tif", "tiff"],
  maxBytes: MAX_TIFF_BYTES,
  runsIn: "worker",
  sniff: hasTiffSignature,
  decode: decodeTiff,
};

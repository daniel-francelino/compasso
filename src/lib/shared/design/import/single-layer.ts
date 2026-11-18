import { createRasterLayer, emptyPage } from "@/lib/shared/design/document";
import { importBaseName } from "@/lib/shared/design/import/sniff";
import {
  DesignImportKind,
  type DesignImportFormat,
  type ImportKindResult,
  type ImportNote,
} from "@/lib/shared/design/import/types";
import type { ImportedDesignMetadata } from "@/lib/shared/design/import/metadata";
import type { PixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";

export type SinglePixels = { width: number; height: number; data: Uint8ClampedArray };

export const singleLayerDesign = (
  format: DesignImportFormat,
  pixels: SinglePixels,
  options: {
    newId: () => string;
    fileName: string;
    notes: ImportNote[];
    defaultName: string;
    metadata: ImportedDesignMetadata | null;
  },
): ImportKindResult => {
  const size = { width: pixels.width, height: pixels.height };
  const id = options.newId();
  const buffer: PixelBuffer = { ...size, data: pixels.data };
  const element = {
    ...createRasterLayer(id, emptyPage("import"), size),
    name: importBaseName(options.fileName) || options.defaultName,
    pixelWidth: size.width,
    pixelHeight: size.height,
  };
  return {
    kind: DesignImportKind.Image,
    design: {
      format,
      ...size,
      elements: [element],
      buffers: new Map([[id, buffer]]),
      notes: options.notes,
      metadata: options.metadata,
    },
  };
};

import { aiHandler } from "@/lib/shared/design/import/handlers/ai";
import { pdfHandler } from "@/lib/shared/design/import/handlers/pdf";
import { gifHandler } from "@/lib/shared/design/import/handlers/gif";
import { avifHandler } from "@/lib/shared/design/import/handlers/avif";
import { tiffHandler } from "@/lib/shared/design/import/handlers/tiff";
import { aseHandler } from "@/lib/shared/design/import/handlers/palette-ase";
import { acoHandler } from "@/lib/shared/design/import/handlers/palette-aco";
import { gplHandler } from "@/lib/shared/design/import/handlers/palette-gpl";
import { jpegHandler, pngHandler, webpHandler } from "@/lib/shared/design/import/handlers/image";
import { psdHandler } from "@/lib/shared/design/import/handlers/psd";
import { sketchHandler } from "@/lib/shared/design/import/handlers/sketch";
import { svgHandler } from "@/lib/shared/design/import/handlers/svg-raster";
import type { ImportHandler } from "@/lib/shared/design/import/types";

export const IMPORT_HANDLERS: readonly ImportHandler[] = [
  psdHandler,
  aiHandler,
  pdfHandler,
  pngHandler,
  jpegHandler,
  webpHandler,
  gifHandler,
  avifHandler,
  tiffHandler,
  aseHandler,
  acoHandler,
  gplHandler,

  svgHandler,
  sketchHandler,
];

export const DESIGN_IMPORT_ACCEPT = IMPORT_HANDLERS.flatMap((handler) => handler.extensions)
  .map((extension) => `.${extension}`)
  .join(",");

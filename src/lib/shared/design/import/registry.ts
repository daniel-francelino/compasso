import { aiHandler } from "@/lib/shared/design/import/handlers/ai";
import { pdfHandler } from "@/lib/shared/design/import/handlers/pdf";
import { jpegHandler, pngHandler, webpHandler } from "@/lib/shared/design/import/handlers/image";
import { psdHandler } from "@/lib/shared/design/import/handlers/psd";
import type { ImportHandler } from "@/lib/shared/design/import/types";

export const IMPORT_HANDLERS: readonly ImportHandler[] = [
  psdHandler,
  aiHandler,
  pdfHandler,
  pngHandler,
  jpegHandler,
  webpHandler,
];

export const DESIGN_IMPORT_ACCEPT = IMPORT_HANDLERS.flatMap((handler) => handler.extensions)
  .map((extension) => `.${extension}`)
  .join(",");

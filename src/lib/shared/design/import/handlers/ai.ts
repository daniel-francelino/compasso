import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { renderPdfPageDesign } from "@/lib/shared/design/import/render-pdf-page";
import { hasPdfContent } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
} from "@/lib/shared/design/import/types";

export const aiHandler: ImportHandler = {
  format: DesignImportFormat.Ai,
  kind: DesignImportKind.Image,
  extensions: ["ai"],
  maxBytes: 100 * 1024 * 1024,
  runsIn: "main",
  sniff: hasPdfContent,
  decode: ({ bytes, file, newId, usedBytes, signal }) =>
    renderPdfPageDesign(
      DesignImportFormat.Ai,
      {
        bytes,
        fileName: file.name,
        newId,
        usedBytes,
        signal,
        notPdf: DESIGN_IMPORT_MESSAGE.aiNotPdf,
      },
      DESIGN_IMPORT_MESSAGE.aiRender,
    ),
};

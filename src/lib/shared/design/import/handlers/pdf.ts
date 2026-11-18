import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { renderPdfPageDesign } from "@/lib/shared/design/import/render-pdf-page";
import { hasPdfHeader } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
} from "@/lib/shared/design/import/types";

export const pdfHandler: ImportHandler = {
  format: DesignImportFormat.Pdf,
  kind: DesignImportKind.Image,
  extensions: ["pdf"],
  maxBytes: 100 * 1024 * 1024,
  runsIn: "main",
  sniff: hasPdfHeader,
  decode: ({ bytes, file, newId, usedBytes, signal }) =>
    renderPdfPageDesign(
      DesignImportFormat.Pdf,
      { bytes, fileName: file.name, newId, usedBytes, signal },
      DESIGN_IMPORT_MESSAGE.corrupt,
    ),
};

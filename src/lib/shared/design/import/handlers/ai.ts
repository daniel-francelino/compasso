import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { extractPdfBytes, renderPdfPageDesign } from "@/lib/shared/design/import/render-pdf-page";
import { hasPdfContent } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
} from "@/lib/shared/design/import/types";
import { invalid } from "@/lib/shared/server-utils";

export const aiHandler: ImportHandler = {
  format: DesignImportFormat.Ai,
  kind: DesignImportKind.Image,
  extensions: ["ai"],
  maxBytes: 100 * 1024 * 1024,
  runsIn: "main",
  sniff: hasPdfContent,
  decode: async ({ bytes, file, newId, usedBytes, signal }) =>
    extractPdfBytes(bytes) === null
      ? invalid(DESIGN_IMPORT_MESSAGE.aiNotPdf)
      : renderPdfPageDesign(
          DesignImportFormat.Ai,
          { bytes, fileName: file.name, newId, usedBytes, signal },
          DESIGN_IMPORT_MESSAGE.aiRender,
        ),
};

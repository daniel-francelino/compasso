import {
  DESIGN_IMPORT_MESSAGE,
  IMPORT_CANCELLED,
  PDF_PAGE_CHOICE,
} from "@/lib/shared/design/import/messages";
import {
  extractPdfBytes,
  pdfPageDesign,
  probeOrRenderPdfPage,
  renderPdfPage,
} from "@/lib/shared/design/import/render-pdf-page";
import { hasPdfHeader } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  IMPORT_NEEDS_CHOICE,
  type ImportChoice,
  type ImportHandler,
  type ImportInput,
  type ImportOutcome,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const MAX_LISTED_PAGES = 500;
const PAGE_ID = /^[1-9][0-9]{0,8}$/;

const pageChoice = (pageCount: number): ImportChoice => ({
  title:
    pageCount > MAX_LISTED_PAGES
      ? PDF_PAGE_CHOICE.titleTruncated(MAX_LISTED_PAGES, pageCount)
      : PDF_PAGE_CHOICE.title,
  confirmLabel: PDF_PAGE_CHOICE.confirmLabel,
  cancelLabel: PDF_PAGE_CHOICE.cancelLabel,
  options: Array.from({ length: Math.min(pageCount, MAX_LISTED_PAGES) }, (_, index) => ({
    id: String(index + 1),
    label: PDF_PAGE_CHOICE.option(index + 1),
  })),
});

const isAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

type Retained = Pick<ImportInput, "file" | "usedBytes" | "newId">;

const renderChosen = async (
  input: Retained,
  optionId: string,
  signal: AbortSignal | undefined,
): Promise<Result<ImportOutcome>> => {
  if (!PAGE_ID.test(optionId)) return invalid(DESIGN_IMPORT_MESSAGE.pdfPageInvalid);
  if (isAborted(signal)) return IMPORT_CANCELLED;
  const fresh = new Uint8Array(await input.file.arrayBuffer());
  if (isAborted(signal)) return IMPORT_CANCELLED;
  const pdf = extractPdfBytes(fresh);
  if (pdf === null) return invalid(DESIGN_IMPORT_MESSAGE.corrupt);
  const rendered = await renderPdfPage(pdf, {
    usedBytes: input.usedBytes,
    renderFailure: DESIGN_IMPORT_MESSAGE.corrupt,
    pageNumber: Number(optionId),
    signal,
  });
  if (!rendered.ok) return rendered;
  return {
    ok: true,
    ...pdfPageDesign(DesignImportFormat.Pdf, rendered, {
      fileName: input.file.name,
      newId: input.newId,
      chosen: true,
    }),
  };
};

const decodePdf = async (input: ImportInput): Promise<Result<ImportOutcome>> => {
  const pdf = extractPdfBytes(input.bytes);
  if (pdf === null) return invalid(DESIGN_IMPORT_MESSAGE.corrupt);
  const probed = await probeOrRenderPdfPage(pdf, {
    usedBytes: input.usedBytes,
    renderFailure: DESIGN_IMPORT_MESSAGE.corrupt,
    signal: input.signal,
  });
  if (!probed.ok) return probed;
  if ("choose" in probed) {
    return {
      ok: true,
      kind: IMPORT_NEEDS_CHOICE,
      choice: pageChoice(probed.pageCount),
      resume: (
        (retained: Retained) => (optionId: string, signal?: AbortSignal | undefined) =>
          renderChosen(retained, optionId, signal)
      )({
        file: input.file,
        usedBytes: input.usedBytes,
        newId: input.newId,
      }),
    };
  }
  return {
    ok: true,
    ...pdfPageDesign(DesignImportFormat.Pdf, probed, {
      fileName: input.file.name,
      newId: input.newId,
      chosen: false,
    }),
  };
};

export const pdfHandler: ImportHandler = {
  format: DesignImportFormat.Pdf,
  kind: DesignImportKind.Image,
  extensions: ["pdf"],
  maxBytes: 100 * 1024 * 1024,
  runsIn: "main",
  sniff: hasPdfHeader,
  decode: decodePdf,
};

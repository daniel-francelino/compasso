import { DESIGN_IMPORT_LIMITS } from "@/lib/shared/design/import/limits";
import { sanitizeImportName } from "@/lib/shared/design/import/sanitize";

const PSD_SIGNATURE = "8BPS";
const POSTSCRIPT_HEADER = "%!PS-Adobe";
const PDF_HEADER = "%PDF-";

export const SNIFF_HEAD_BYTES = DESIGN_IMPORT_LIMITS.pdfHeaderWindowBytes + PDF_HEADER.length - 1;

export const startsWith = (bytes: Uint8Array, text: string, offset = 0): boolean => {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
};

export const findPdfStart = (bytes: Uint8Array, limit = bytes.length): number | null => {
  const last = Math.min(limit, bytes.length - PDF_HEADER.length + 1);
  for (let offset = 0; offset < last; offset += 1) {
    if (startsWith(bytes, PDF_HEADER, offset)) return offset;
  }
  return null;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_TAG = "RIFF";
const WEBP_TAG = "WEBP";
const WEBP_TAG_OFFSET = 8;

const startsWithBytes = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);

export const hasPngSignature = (head: Uint8Array): boolean => startsWithBytes(head, PNG_SIGNATURE);

export const hasJpegSignature = (head: Uint8Array): boolean =>
  startsWithBytes(head, JPEG_SIGNATURE);

export const hasWebpSignature = (head: Uint8Array): boolean =>
  startsWith(head, RIFF_TAG) && startsWith(head, WEBP_TAG, WEBP_TAG_OFFSET);

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const SVG_TAG = "<svg";
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const LESS_THAN = 0x3c;
const GREATER_THAN = 0x3e;
const SLASH = 0x2f;

const isXmlSpace = (byte: number | undefined): boolean =>
  byte === TAB || byte === LINE_FEED || byte === CARRIAGE_RETURN || byte === SPACE;

export const hasSvgHead = (head: Uint8Array): boolean => {
  let start = startsWithBytes(head, UTF8_BOM) ? UTF8_BOM.length : 0;
  while (start < head.length && isXmlSpace(head[start])) start += 1;
  if (head[start] !== LESS_THAN || head.includes(0)) return false;
  for (let offset = start; offset + SVG_TAG.length < head.length; offset += 1) {
    if (!startsWith(head, SVG_TAG, offset)) continue;
    const next = head[offset + SVG_TAG.length];
    if (isXmlSpace(next) || next === GREATER_THAN || next === SLASH) return true;
  }
  return false;
};

export const hasPsdSignature = (head: Uint8Array): boolean => startsWith(head, PSD_SIGNATURE);

export const hasPdfHeader = (head: Uint8Array): boolean =>
  findPdfStart(head, DESIGN_IMPORT_LIMITS.pdfHeaderWindowBytes) !== null;

export const hasPdfContent = (head: Uint8Array): boolean =>
  findPdfStart(head, DESIGN_IMPORT_LIMITS.pdfHeaderWindowBytes) !== null ||
  startsWith(head, POSTSCRIPT_HEADER);

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
};

export const importBaseName = (name: string): string => {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return sanitizeImportName(base);
};

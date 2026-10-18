export type PdfInfo = { mime: "application/pdf"; pages: number | null };

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(Math.max(0, from), to)));

export const inspectPdf = (bytes: Uint8Array): PdfInfo | null => {
  if (bytes.length < 8 || ascii(bytes, 0, 5) !== "%PDF-") return null;
  if (!ascii(bytes, bytes.length - 1100, bytes.length).includes("%%EOF")) return null;

  let pages: number | null = null;
  if (bytes.length <= 20 * 1024 * 1024) {
    const text = new TextDecoder("latin1").decode(bytes);
    const found = text.match(/\/Type\s*\/Page(?![A-Za-z])/g);
    pages = found ? found.length : null;
  }
  return { mime: "application/pdf", pages };
};

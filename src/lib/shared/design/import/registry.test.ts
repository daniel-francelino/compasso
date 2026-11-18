import { describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));

const { DESIGN_IMPORT_ACCEPT, IMPORT_HANDLERS } =
  await import("@/lib/shared/design/import/registry");

describe("IMPORT_HANDLERS", () => {
  it("has one handler per format and at least one extension each", () => {
    const formats = IMPORT_HANDLERS.map((handler) => handler.format);
    expect(new Set(formats).size).toBe(formats.length);
    for (const handler of IMPORT_HANDLERS) {
      expect(handler.extensions.length).toBeGreaterThan(0);
      expect(handler.maxBytes).toBeGreaterThan(0);
    }
  });

  it("does not repeat an extension", () => {
    const extensions = IMPORT_HANDLERS.flatMap((handler) => handler.extensions);
    expect(new Set(extensions).size).toBe(extensions.length);
  });

  it("derives the picker accept list from the handlers", () => {
    expect(DESIGN_IMPORT_ACCEPT.split(",")).toEqual(
      IMPORT_HANDLERS.flatMap((handler) => handler.extensions.map((extension) => `.${extension}`)),
    );
  });
});

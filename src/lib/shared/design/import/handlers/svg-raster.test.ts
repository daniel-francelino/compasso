import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  type SvgDeps,
  decodeSvg,
  planSvgRaster,
  svgHandler,
} from "@/lib/shared/design/import/handlers/svg-raster";
import { encodeText, svg, testSvgParser } from "@/lib/shared/design/import/handlers/svg-fixtures";
import type { SvgRender } from "@/lib/shared/design/import/handlers/svg-render";
import { DESIGN_IMPORT_MESSAGE, IMPORT_CANCELLED } from "@/lib/shared/design/import/messages";
import { ImportAbortedError, ImportTimeoutError } from "@/lib/shared/design/import/run-limits";
import { hasSvgHead } from "@/lib/shared/design/import/sniff";
import { DesignImportNoteKind, type ImportInput } from "@/lib/shared/design/import/types";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const fillRender = (): SvgRender =>
  vi.fn(async (_blob, target) => ({
    ok: true as const,
    pixels: {
      width: target.width,
      height: target.height,
      data: new Uint8ClampedArray(target.width * target.height * 4),
    },
  }));

const inputOf = (text: string, overrides: Partial<ImportInput> = {}): ImportInput => ({
  file: new File([text], "Logo.svg"),
  bytes: encodeText(text),
  capacityElements: 200,
  usedBytes: 0,
  newId: () => "layer-1",
  ...overrides,
});

const depsOf = (render: SvgRender): SvgDeps => ({ parse: testSvgParser, render });

describe("planSvgRaster", () => {
  it("scales a small file to 2x and a large one to 4096 at most", () => {
    const small = planSvgRaster({ width: 100, height: 50 }, 0);
    expect(small.ok && small.target).toEqual({ width: 200, height: 100 });
    const large = planSvgRaster({ width: 8000, height: 4000 }, 0);
    expect(large.ok && large.target).toEqual({ width: 4096, height: 2048 });
  });

  it("refuses tiny, extreme and over-budget sizes", () => {
    expect(planSvgRaster({ width: 20, height: 20 }, 0).ok).toBe(false);
    expect(planSvgRaster({ width: 1_000_000, height: 1 }, 0).ok).toBe(false);
    const used = DESIGN_LIMITS.rasterBudgetBytes - 10;
    const over = planSvgRaster({ width: 100, height: 100 }, used);
    expect(!over.ok && over.message).toBe(DESIGN_IMPORT_MESSAGE.memory);
  });
});

describe("decodeSvg", () => {
  it("imports one layer with the vector and font notes", async () => {
    const render = fillRender();
    const result = await decodeSvg(inputOf(svg("<text>A</text><text>B</text>")), depsOf(render));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.kind).toBe("image");
    expect(result.design.format).toBe("svg");
    expect(result.design.width).toBe(200);
    expect(result.design.elements).toHaveLength(1);
    expect(result.design.notes).toEqual([
      { kind: DesignImportNoteKind.VectorRasterized, count: 1 },
      { kind: DesignImportNoteKind.FontsNotImported, count: 2 },
    ]);
    const blob = vi.mocked(render).mock.calls[0]?.[0];
    expect(blob?.type).toBe("image/svg+xml;charset=utf-8");
  });

  it("never renders a refused file", async () => {
    const render = fillRender();
    for (const text of [svg("<script/>"), svg('<image href="https://example.test/a.png"/>'), "x"]) {
      const result = await decodeSvg(inputOf(text), depsOf(render));
      expect(result.ok).toBe(false);
    }
    expect(render).not.toHaveBeenCalled();
  });

  it("writes the size into the markup when the file has none, and gates it again", async () => {
    const render = fillRender();
    await decodeSvg(inputOf(svg("", 'viewBox="0 0 80 80"')), depsOf(render));
    const blob = vi.mocked(render).mock.calls[0]?.[0];
    const text = await blob?.text();
    expect(text).toContain('width="80"');
    expect(text).toContain('height="80"');
  });

  it("maps a render failure, a timeout and a cancel", async () => {
    const failing: SvgRender = async () => {
      throw new Error("boom");
    };
    const failed = await decodeSvg(inputOf(svg()), depsOf(failing));
    expect(!failed.ok && failed.message).toBe(DESIGN_IMPORT_MESSAGE.svgRender);
    const slow: SvgRender = async () => {
      throw new ImportTimeoutError();
    };
    const timed = await decodeSvg(inputOf(svg()), depsOf(slow));
    expect(!timed.ok && timed.message).toBe(DESIGN_IMPORT_MESSAGE.timedOut);
    const aborting: SvgRender = async () => {
      throw new ImportAbortedError();
    };
    expect(await decodeSvg(inputOf(svg()), depsOf(aborting))).toBe(IMPORT_CANCELLED);
    const controller = new AbortController();
    controller.abort();
    const render = fillRender();
    expect(await decodeSvg(inputOf(svg(), { signal: controller.signal }), depsOf(render))).toBe(
      IMPORT_CANCELLED,
    );
    expect(render).not.toHaveBeenCalled();
  });

  it("discards pixels whose size differs from the plan", async () => {
    const wrong: SvgRender = async () => ({
      ok: true,
      pixels: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
    });
    const result = await decodeSvg(inputOf(svg()), depsOf(wrong));
    expect(!result.ok && result.message).toBe(DESIGN_IMPORT_MESSAGE.svgRender);
  });
});

describe("svgHandler", () => {
  it("is a main-thread image handler with a 5 MiB cap", () => {
    expect(svgHandler.runsIn).toBe("main");
    expect(svgHandler.kind).toBe("image");
    expect(svgHandler.maxBytes).toBe(5 * 1024 * 1024);
    expect(svgHandler.extensions).toEqual(["svg"]);
  });

  it("sniffs svg text and nothing else", () => {
    expect(hasSvgHead(encodeText(svg()))).toBe(true);
    expect(hasSvgHead(encodeText('<?xml version="1.0"?>\n<!-- c -->\n<svg width="1"/>'))).toBe(
      true,
    );
    expect(hasSvgHead(encodeText("<svgfoo/>"))).toBe(false);
    expect(hasSvgHead(encodeText("hello <svg>"))).toBe(false);
    expect(hasSvgHead(new Uint8Array([0x3c, 0, 0x73, 0x76, 0x67]))).toBe(false);
    expect(hasSvgHead(new Uint8Array(0))).toBe(false);
  });
});

describe("static guard on the SVG sources", () => {
  it("never puts markup in the page DOM", () => {
    const banned = [
      ["inner", "HTML"],
      ["outer", "HTML"],
      ["insertAdjacent", "HTML"],
      ["dangerouslySet", "InnerHTML"],
      ["append", "Child"],
      ["document", ".body"],
      ["createElement", "NS"],
    ].map((parts) => parts.join(""));
    for (const name of ["svg-gate.ts", "svg-raster.ts", "svg-render.ts"]) {
      const text = readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), "utf8");
      for (const token of banned) expect(text, `${name} ${token}`).not.toContain(token);
    }
  });
});

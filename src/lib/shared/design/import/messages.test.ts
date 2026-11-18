import { describe, expect, it } from "vitest";
import {
  DESIGN_IMPORT_FORMAT_LABEL,
  DESIGN_IMPORT_NOTE_SENTENCE,
  describeImportNotes,
} from "@/lib/shared/design/import/messages";
import { DesignImportNoteKind } from "@/lib/shared/design/import/types";

const ACCENT: Record<string, string> = {
  a: String.fromCharCode(0xe1),
  e: String.fromCharCode(0xe9),
  o: String.fromCharCode(0xf3),
  c: String.fromCharCode(0xe7),
  t: String.fromCharCode(0xe3),
};

const accented = (text: string): string =>
  text.replace(/\{(\w)\}/g, (_match, key: string) => ACCENT[key] ?? key);

describe("import notes", () => {
  it("has the exact sentence for every note kind (count 2)", () => {
    const expected: Record<DesignImportNoteKind, string> = {
      text_as_pixels: "Texto convertido em pixels (2 camadas).",
      smart_object_as_pixels: "Objetos inteligentes convertidos em pixels (2).",
      layer_style_dropped: "Estilos de camada ignorados (2).",
      adjustment_layer_dropped: "Camadas de ajuste ignoradas (2).",
      blend_mode_fallback: "Modos de mesclagem sem equivalente (2 camadas).",
      clipping_partial: "M{a}scaras de corte aplicadas s{o} em parte (2).",
      groups_flattened: "Grupos muito profundos foram achatados (2).",
      flattened_image_only: "O arquivo s{o} tinha a imagem final, sem camadas.",
      cmyk_converted: "Cores CMYK convertidas para RGB.",
      depth_reduced: "Profundidade de cor reduzida para 8 bits.",
      first_page_only: "S{o} a primeira p{a}gina foi importada.",
      downscaled: "Imagem reduzida para caber na p{a}gina (2).",
      animation_ignored: "Anima{c}{t}o ignorada: s{o} o primeiro quadro foi importado.",
    };
    expect(Object.keys(expected).sort()).toEqual(Object.values(DesignImportNoteKind).sort());
    for (const kind of Object.values(DesignImportNoteKind)) {
      expect(DESIGN_IMPORT_NOTE_SENTENCE[kind](2)).toBe(accented(expected[kind]));
    }
  });

  it("has the exact label for every format", () => {
    expect(DESIGN_IMPORT_FORMAT_LABEL).toEqual({
      psd: "PSD",
      ai: "AI",
      pdf: "PDF",
      png: "PNG",
      jpeg: "JPEG",
      webp: "WebP",
    });
  });

  it("uses the singular for a count of 1", () => {
    expect(DESIGN_IMPORT_NOTE_SENTENCE[DesignImportNoteKind.TextAsPixels](1)).toBe(
      "Texto convertido em pixels (1 camada).",
    );
  });

  it("writes one sentence per note, in order, with the count", () => {
    const text = describeImportNotes([
      { kind: DesignImportNoteKind.TextAsPixels, count: 1 },
      { kind: DesignImportNoteKind.TextAsPixels, count: 3 },
      { kind: DesignImportNoteKind.LayerStyleDropped, count: 2 },
    ]);
    expect(text).toBe(
      "Texto convertido em pixels (1 camada). Texto convertido em pixels (3 camadas). Estilos de camada ignorados (2).",
    );
    expect(describeImportNotes([])).toBe("");
  });
});

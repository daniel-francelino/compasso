import { describe, expect, it } from "vitest";
import {
  DESIGN_IMPORT_FORMAT_LABEL,
  DESIGN_IMPORT_NOTE_SENTENCE,
  describeImportNotes,
} from "@/lib/shared/design/import/messages";
import { DesignImportFormat, DesignImportNoteKind } from "@/lib/shared/design/import/types";

describe("import notes", () => {
  it("has a sentence for every note kind and a label for every format", () => {
    for (const kind of Object.values(DesignImportNoteKind)) {
      expect(DESIGN_IMPORT_NOTE_SENTENCE[kind](2).length).toBeGreaterThan(0);
    }
    for (const format of Object.values(DesignImportFormat)) {
      expect(DESIGN_IMPORT_FORMAT_LABEL[format].length).toBeGreaterThan(0);
    }
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

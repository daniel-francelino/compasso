import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DESIGN_IMPORT_CANCEL_LABEL,
  DESIGN_IMPORT_FORMAT_LABEL,
  DESIGN_IMPORT_LABEL,
  DESIGN_IMPORT_MESSAGE,
  DESIGN_IMPORT_PROGRESS,
  DESIGN_IMPORT_NOTE_SENTENCE,
  IMPORT_UPLOAD_REASON,
} from "@/lib/shared/design/import/messages";
import { DesignImportNoteKind } from "@/lib/shared/design/import/types";

const GLOSSARY = readFileSync(
  decodeURIComponent(
    new URL("../../../../../docs/standards/ui-glossary.md", import.meta.url).pathname.replace(
      /^\/([A-Za-z]:)/,
      "$1",
    ),
  ),
  "utf8",
);

const countPlaceholder = (sentence: string): string => sentence.replace(/\b7\b/, "%n");

describe("import copy against docs/standards/ui-glossary.md", () => {
  it("lists every fixed refusal text of DESIGN_IMPORT_MESSAGE", () => {
    const fixed = Object.entries(DESIGN_IMPORT_MESSAGE).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value] as const] : [],
    );
    expect(fixed.length).toBeGreaterThan(10);
    const missing = fixed
      .filter(([, text]) => text !== DESIGN_IMPORT_MESSAGE.cancelled)
      .filter(([, text]) => !GLOSSARY.includes(text))
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it("lists the labels, the progress text and the permission reason", () => {
    for (const text of [
      DESIGN_IMPORT_LABEL,
      DESIGN_IMPORT_PROGRESS,
      DESIGN_IMPORT_CANCEL_LABEL,
      IMPORT_UPLOAD_REASON,
    ]) {
      expect(GLOSSARY, text).toContain(text);
    }
  });

  it("lists every note kind with its sentence", () => {
    for (const kind of Object.values(DesignImportNoteKind)) {
      expect(GLOSSARY, kind).toContain(`\`${kind}\``);
      const sentence = countPlaceholder(DESIGN_IMPORT_NOTE_SENTENCE[kind](7)).replace(
        "(1 camadas)",
        "(%n camadas)",
      );
      const normalized = sentence.replace("7 camadas", "%n camadas");
      expect(GLOSSARY, kind).toContain(normalized);
    }
  });

  it("lists the done toast for every format", () => {
    for (const label of Object.values(DESIGN_IMPORT_FORMAT_LABEL)) {
      expect(GLOSSARY).toContain(`"${label} importado."`);
    }
  });
});

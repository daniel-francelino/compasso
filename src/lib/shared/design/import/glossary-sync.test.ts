import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

const GLOSSARY_LINES = readFileSync(
  fileURLToPath(new URL("../../../../../docs/standards/ui-glossary.md", import.meta.url)),
  "utf8",
).split(String.fromCharCode(10));

const rowStarting = (firstCell: string): string => {
  const row = GLOSSARY_LINES.find((line) => line.startsWith(`| ${firstCell}`));
  if (row === undefined) throw new Error(`glossary row not found: ${firstCell}`);
  return row;
};

const SENTINEL = 7777;

const asTemplate = (sentence: string): string => sentence.replaceAll(String(SENTINEL), "%n");

describe("import copy against the rows of docs/standards/ui-glossary.md", () => {
  const refusals = rowStarting("Recusas da importa");
  const notes = rowStarting("Observa");

  it("lists every fixed refusal text of DESIGN_IMPORT_MESSAGE in the refusals row", () => {
    const fixed = Object.entries(DESIGN_IMPORT_MESSAGE).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value] as const] : [],
    );
    expect(fixed.length).toBeGreaterThan(10);
    const missing = fixed
      .filter(([, text]) => text !== DESIGN_IMPORT_MESSAGE.cancelled)
      .filter(([, text]) => !refusals.includes(text))
      .map(([key]) => key);
    expect(missing).toEqual([]);
  });

  it("lists the permission reason in the refusals row", () => {
    expect(refusals).toContain(IMPORT_UPLOAD_REASON);
  });

  it("lists the menu label and the progress and cancel labels in their rows", () => {
    expect(rowStarting("Importar")).toContain(DESIGN_IMPORT_LABEL);
    const progress = rowStarting("Importando arquivo");
    expect(progress).toContain(DESIGN_IMPORT_PROGRESS);
    expect(progress).toContain(DESIGN_IMPORT_CANCEL_LABEL);
  });

  it("lists the done toast for every format in the progress row", () => {
    const progress = rowStarting("Importando arquivo");
    for (const label of Object.values(DESIGN_IMPORT_FORMAT_LABEL)) {
      expect(progress).toContain(`"${label} importado."`);
    }
  });

  it("lists every note kind with its sentence in the notes row", () => {
    for (const kind of Object.values(DesignImportNoteKind)) {
      expect(notes, kind).toContain(`\`${kind}\``);
      expect(notes, kind).toContain(asTemplate(DESIGN_IMPORT_NOTE_SENTENCE[kind](SENTINEL)));
    }
  });

  it("lists no note kind that the code does not have", () => {
    const listed = [...notes.matchAll(/`([a-z_]+)`/g)].map((match) => match[1]);
    expect([...listed].sort()).toEqual(Object.values(DesignImportNoteKind).sort());
  });
});

import {
  DesignImportNoteKind,
  type ImportNote,
  type ImportedDesign,
} from "@/lib/shared/design/import/types";
import type { DesignElement } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, type PageSize } from "@/lib/shared/design/types";

export type ImportPlacement = {
  elements: DesignElement[];
  size: PageSize | null;
  notes: ImportNote[];
};

export type PageState = PageSize & { empty: boolean };

const clampSide = (side: number): number =>
  Math.min(DESIGN_LIMITS.maxPageSide, Math.max(DESIGN_LIMITS.minPageSide, side));

export const placeDocumentDesign = (design: ImportedDesign, page: PageState): ImportPlacement => ({
  elements: design.elements,
  size: page.empty ? { width: design.width, height: design.height } : null,
  notes: design.notes,
});

const withDownscaledNote = (notes: readonly ImportNote[]): ImportNote[] =>
  notes.some((note) => note.kind === DesignImportNoteKind.Downscaled)
    ? [...notes]
    : [...notes, { kind: DesignImportNoteKind.Downscaled, count: 1 }];

export const placeImageDesign = (design: ImportedDesign, page: PageState): ImportPlacement => {
  const target: PageSize = page.empty
    ? { width: clampSide(design.width), height: clampSide(design.height) }
    : { width: page.width, height: page.height };
  const scale = Math.min(1, target.width / design.width, target.height / design.height);
  const scaled = scale < 1;
  const width = scaled
    ? Math.max(DESIGN_LIMITS.minSize, Math.min(target.width, Math.round(design.width * scale)))
    : design.width;
  const height = scaled
    ? Math.max(DESIGN_LIMITS.minSize, Math.min(target.height, Math.round(design.height * scale)))
    : design.height;
  const x = Math.round((target.width - width) / 2);
  const y = Math.round((target.height - height) / 2);
  return {
    elements: design.elements.map((element) => ({ ...element, x, y, width, height })),
    size: page.empty ? target : null,
    notes: scaled ? withDownscaledNote(design.notes) : design.notes,
  };
};

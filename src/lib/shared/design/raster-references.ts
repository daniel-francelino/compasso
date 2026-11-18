import type { DesignDocument } from "@/lib/shared/design/schemas";
import { DesignElementKind } from "@/lib/shared/design/types";

export const referencedRasterIds = (
  documents: readonly DesignDocument[],
  pixelStepLayerIds: Iterable<string>,
): Set<string> => {
  const referenced = new Set<string>(pixelStepLayerIds);
  for (const document of documents) {
    for (const page of document.pages) {
      for (const element of page.elements) {
        if (element.kind === DesignElementKind.Raster) referenced.add(element.id);
      }
    }
  }
  return referenced;
};

export const unreferencedRasterIds = (
  documents: readonly DesignDocument[],
  pixelStepLayerIds: Iterable<string>,
  heldIds: Iterable<string>,
): string[] => {
  const referenced = referencedRasterIds(documents, pixelStepLayerIds);
  return [...heldIds].filter((id) => !referenced.has(id));
};

import type { History } from "@/lib/shared/design/history";
import type { DesignDocument, DesignElement, RasterElement } from "@/lib/shared/design/schemas";
import { inheritPixelStep } from "@/lib/shared/design/timeline";
import { DesignElementKind } from "@/lib/shared/design/types";

const isRaster = (element: DesignElement): element is RasterElement =>
  element.kind === DesignElementKind.Raster;

export const rasterElementsOf = (document: DesignDocument): RasterElement[] =>
  document.pages.flatMap((page) => page.elements.filter(isRaster));

export const withPixelsVersion = (
  document: DesignDocument,
  id: string,
  versionId: string,
): DesignDocument => {
  let changed = false;
  const pages = document.pages.map((page) => {
    const target = page.elements.find((element) => element.id === id);
    if (target === undefined || !isRaster(target) || target.pixelsVersionId === versionId) {
      return page;
    }
    changed = true;
    return {
      ...page,
      elements: page.elements.map((element) =>
        element.id === id ? { ...target, pixelsVersionId: versionId } : element,
      ),
    };
  });
  return changed ? inheritPixelStep(document, { ...document, pages }) : document;
};

export type PixelsVersionEntry = { id: string; versionId: string };

export const retargetHistory = (
  history: History<DesignDocument>,
  entries: readonly PixelsVersionEntry[],
): History<DesignDocument> => {
  const retarget = (document: DesignDocument) =>
    entries.reduce(
      (current, entry) => withPixelsVersion(current, entry.id, entry.versionId),
      document,
    );
  return {
    ...history,
    past: history.past.map(retarget),
    present: retarget(history.present),
    future: history.future.map(retarget),
  };
};

export const pendingPixelIds = (document: DesignDocument, dirty: readonly string[]): string[] => {
  const present = new Set(rasterElementsOf(document).map((element) => element.id));
  return dirty.filter((id) => present.has(id));
};

export const duplicatedPixelIds = (
  document: DesignDocument,
  owners: ReadonlyMap<string, string>,
): string[] =>
  rasterElementsOf(document)
    .filter((element) => {
      const owner =
        element.pixelsVersionId === null ? undefined : owners.get(element.pixelsVersionId);
      return owner !== undefined && owner !== element.id;
    })
    .map((element) => element.id);

export const claimPixelOwners = (document: DesignDocument, owners: Map<string, string>): void => {
  for (const element of rasterElementsOf(document)) {
    if (element.pixelsVersionId === null || owners.has(element.pixelsVersionId)) continue;
    owners.set(element.pixelsVersionId, element.id);
  }
};

export const pixelFileName = (id: string, suffix: string): string =>
  `camada-${id.slice(0, 8)}-${suffix}.png`;

export const layersDueForFlush = (
  ids: readonly string[],
  lastSentAt: ReadonlyMap<string, number>,
  now: number,
  minGapMs: number,
): string[] =>
  ids.filter((id) => {
    const last = lastSentAt.get(id);
    return last === undefined || now - last >= minGapMs;
  });

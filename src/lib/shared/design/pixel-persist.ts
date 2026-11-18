import type { History } from "@/lib/shared/design/history";
import type { DesignDocument, DesignElement, RasterElement } from "@/lib/shared/design/schemas";
import {
  isMaskKey,
  isMaskable,
  maskKey,
  maskPixelSize,
  ownerIdOfKey,
} from "@/lib/shared/design/layer-mask";
import { inheritPixelStep } from "@/lib/shared/design/timeline";
import { DesignElementKind } from "@/lib/shared/design/types";

const isRaster = (element: DesignElement): element is RasterElement =>
  element.kind === DesignElementKind.Raster;

export const rasterElementsOf = (document: DesignDocument): RasterElement[] =>
  document.pages.flatMap((page) => page.elements.filter(isRaster));

export type PixelRef = {
  key: string;
  versionId: string | null;
  width: number;
  height: number;
  mask: boolean;
};

export const pixelRefsOf = (document: DesignDocument): PixelRef[] =>
  document.pages.flatMap((page) =>
    page.elements.flatMap((element): PixelRef[] => {
      const refs: PixelRef[] = [];
      if (isRaster(element)) {
        refs.push({
          key: element.id,
          versionId: element.pixelsVersionId,
          width: element.pixelWidth,
          height: element.pixelHeight,
          mask: false,
        });
      }
      if (element.mask !== null && isMaskable(element)) {
        refs.push({
          key: maskKey(element.id),
          versionId: element.mask.mediaVersionId,
          ...maskPixelSize(element),
          mask: true,
        });
      }
      return refs;
    }),
  );

const retargeted = (
  element: DesignElement,
  forMask: boolean,
  versionId: string,
): DesignElement | null => {
  if (forMask && (element.mask === null || element.mask.mediaVersionId === versionId)) {
    return null;
  }
  if (forMask && element.mask !== null) {
    return { ...element, mask: { ...element.mask, mediaVersionId: versionId } };
  }
  if (!isRaster(element) || element.pixelsVersionId === versionId) return null;
  return { ...element, pixelsVersionId: versionId };
};

export const withPixelsVersion = (
  document: DesignDocument,
  key: string,
  versionId: string,
): DesignDocument => {
  const id = ownerIdOfKey(key);
  const forMask = isMaskKey(key);
  let changed = false;
  const pages = document.pages.map((page) => {
    const target = page.elements.find((element) => element.id === id);
    const next = target === undefined ? null : retargeted(target, forMask, versionId);
    if (next === null) return page;
    changed = true;
    return {
      ...page,
      elements: page.elements.map((element) => (element.id === id ? next : element)),
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
  const present = new Set(pixelRefsOf(document).map((ref) => ref.key));
  return dirty.filter((key) => present.has(key));
};

export const duplicatedPixelIds = (
  document: DesignDocument,
  owners: ReadonlyMap<string, string>,
): string[] =>
  pixelRefsOf(document)
    .filter((ref) => {
      const owner = ref.versionId === null ? undefined : owners.get(ref.versionId);
      return owner !== undefined && owner !== ref.key;
    })
    .map((ref) => ref.key);

export const claimPixelOwners = (document: DesignDocument, owners: Map<string, string>): void => {
  for (const ref of pixelRefsOf(document)) {
    if (ref.versionId === null || owners.has(ref.versionId)) continue;
    owners.set(ref.versionId, ref.key);
  }
};

export const pixelFileName = (key: string, suffix: string): string =>
  `${isMaskKey(key) ? "mascara" : "camada"}-${ownerIdOfKey(key).slice(0, 8)}-${suffix}.png`;

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

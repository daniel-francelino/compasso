import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { loadImage } from "@/lib/shared/design/browser";
import { rasterPixelsIds } from "@/lib/shared/design/document";
import { imageToBuffer } from "@/lib/shared/design/raster-canvas";
import { createRasterStore, type RasterStore } from "@/lib/shared/design/raster-store";
import type { DesignDocument, RasterElement } from "@/lib/shared/design/schemas";
import { DesignElementKind } from "@/lib/shared/design/types";
import { MediaVariant } from "@/lib/shared/media/schemas";

export const RASTER_MEMORY_MESSAGE =
  "Memória insuficiente para esta camada. Exclua camadas ou reduza o tamanho do design e tente de novo.";
export const RASTER_LOAD_MESSAGE =
  "Não foi possível carregar os pixels de uma camada. Ela aparece vazia nesta sessão.";

export type RasterHandle = {
  store: RasterStore;
  revision: number;
  ready: boolean;
  failed: boolean;
};

const rasterElements = (document: DesignDocument): RasterElement[] =>
  document.pages.flatMap((page) =>
    page.elements.flatMap((element) =>
      element.kind === DesignElementKind.Raster ? [element] : [],
    ),
  );

export const useRasterStore = (document: DesignDocument): RasterHandle => {
  const [store] = useState(() => createRasterStore());
  const revision = useSyncExternalStore(store.subscribe, store.snapshot);
  const elements = rasterElements(document);
  const signed = useSignedUrls(rasterPixelsIds(document), MediaVariant.Original);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const requested = useRef(new Set<string>());
  const latest = useRef(elements);
  latest.current = elements;
  const urls = signed.data;
  const elementsKey = elements
    .map((element) => `${element.id}:${element.pixelsVersionId ?? ""}`)
    .join("|");

  useEffect(() => {
    const failedNow: string[] = [];
    for (const element of latest.current) {
      if (element.pixelsVersionId !== null || store.has(element.id)) continue;
      if (store.ensure(element.id, element.pixelWidth, element.pixelHeight) !== null) continue;
      failedNow.push(element.id);
    }
    if (failedNow.length === 0) return;
    toast.error(RASTER_MEMORY_MESSAGE);
    setFailedIds((current) => new Set([...current, ...failedNow]));
  }, [elementsKey, store]);

  useEffect(() => {
    if (urls === undefined) return;
    const pending = latest.current.filter(
      (element) =>
        element.pixelsVersionId !== null &&
        !store.has(element.id) &&
        !requested.current.has(element.id),
    );
    for (const element of pending) requested.current.add(element.id);
    void (async () => {
      const failedNow: string[] = [];
      let memory = false;
      for (const element of pending) {
        const url = element.pixelsVersionId === null ? undefined : urls[element.pixelsVersionId];
        const image = url === undefined ? null : await loadImage(url);
        const buffer = image === null ? null : imageToBuffer(image);
        if (buffer === null) {
          failedNow.push(element.id);
          continue;
        }
        if (store.set(element.id, buffer)) continue;
        memory = true;
        failedNow.push(element.id);
      }
      if (failedNow.length === 0) return;
      toast.error(memory ? RASTER_MEMORY_MESSAGE : RASTER_LOAD_MESSAGE);
      setFailedIds((current) => new Set([...current, ...failedNow]));
    })();
  }, [urls, elementsKey, store]);

  const ready = elements.every((element) => store.has(element.id) || failedIds.has(element.id));
  return { store, revision, ready, failed: failedIds.size > 0 || signed.isError };
};

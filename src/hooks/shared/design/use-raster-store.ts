import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useSignedUrls } from "@/hooks/shared/use-signed-urls";
import { loadImage } from "@/lib/shared/design/browser";
import { rasterPixelsIds } from "@/lib/shared/design/document";
import { pixelRefsOf } from "@/lib/shared/design/pixel-persist";
import { createPixelBuffer } from "@/lib/shared/design/raster/pixel-buffer";
import { imageToBuffer } from "@/lib/shared/design/raster-canvas";
import { createRasterStore, type RasterStore } from "@/lib/shared/design/raster-store";
import type { DesignDocument } from "@/lib/shared/design/schemas";
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
  failedIds: ReadonlySet<string>;
  maskView: string | null;
  setMaskView: (id: string | null) => void;
};

const WHITE = { r: 255, g: 255, b: 255, a: 255 };

export const useRasterStore = (document: DesignDocument): RasterHandle => {
  const [store] = useState(() => createRasterStore());
  const revision = useSyncExternalStore(store.subscribe, store.snapshot);
  const elements = pixelRefsOf(document);
  const [maskView, setMaskView] = useState<string | null>(null);
  const signed = useSignedUrls(rasterPixelsIds(document), MediaVariant.Original);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const requested = useRef(new Set<string>());
  const latest = useRef(elements);
  latest.current = elements;
  const urls = signed.data;
  const elementsKey = elements
    .map((element) => `${element.key}:${element.versionId ?? ""}`)
    .join("|");

  useEffect(() => {
    const failedNow: string[] = [];
    for (const element of latest.current) {
      if (element.versionId !== null || store.has(element.key)) continue;
      const created = element.mask
        ? store.set(element.key, createPixelBuffer(element.width, element.height, WHITE))
        : store.ensure(element.key, element.width, element.height) !== null;
      if (!created) failedNow.push(element.key);
    }
    if (failedNow.length === 0) return;
    toast.error(RASTER_MEMORY_MESSAGE);
    setFailedIds((current) => new Set([...current, ...failedNow]));
  }, [elementsKey, store]);

  useEffect(() => {
    if (urls === undefined) return;
    const pending = latest.current.filter(
      (element) =>
        element.versionId !== null &&
        !store.has(element.key) &&
        !requested.current.has(element.key),
    );
    for (const element of pending) requested.current.add(element.key);
    void (async () => {
      const failedNow: string[] = [];
      let memory = false;
      for (const element of pending) {
        const url = element.versionId === null ? undefined : urls[element.versionId];
        const image = url === undefined ? null : await loadImage(url);
        const buffer = image === null ? null : imageToBuffer(image);
        if (buffer === null) {
          failedNow.push(element.key);
          continue;
        }
        if (store.set(element.key, buffer)) continue;
        memory = true;
        failedNow.push(element.key);
      }
      if (failedNow.length === 0) return;
      toast.error(memory ? RASTER_MEMORY_MESSAGE : RASTER_LOAD_MESSAGE);
      setFailedIds((current) => new Set([...current, ...failedNow]));
    })();
  }, [urls, elementsKey, store]);

  const ready = elements.every((element) => store.has(element.key) || failedIds.has(element.key));
  return {
    store,
    revision,
    ready,
    failed: failedIds.size > 0 || signed.isError,
    failedIds,
    maskView,
    setMaskView,
  };
};

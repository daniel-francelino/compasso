import { useEffect, useRef, useState } from "react";
import { newItem, sendUpload } from "@/hooks/shared/use-media-upload";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { ErrorCode, dbErrorMessage } from "@/lib/shared/auth/errors";
import { logError } from "@/lib/shared/logger";
import { nowMs } from "@/lib/shared/dates";
import {
  type PixelsVersionEntry,
  claimPixelOwners,
  duplicatedPixelIds,
  layersDueForFlush,
  pendingPixelIds,
  pixelFileName,
} from "@/lib/shared/design/pixel-persist";
import { bufferToPng } from "@/lib/shared/design/raster-canvas";
import type { RasterStore } from "@/lib/shared/design/raster-store";
import type { DesignDocument } from "@/lib/shared/design/schemas";
import { DESIGN_LIMITS, DesignSaveState } from "@/lib/shared/design/types";
import { MediaScope } from "@/lib/shared/enums";

const ENCODE_FAILED = "Não foi possível preparar os pixels de uma camada para o envio.";

type Options = {
  store: RasterStore;
  revision: number;
  document: DesignDocument;
  enabled: boolean;
  brandId: string;
  reuseAssets: boolean;
  onSaved: (entries: PixelsVersionEntry[]) => void;
};

export const usePixelPersist = (options: Options) => {
  const { store, revision, document, enabled } = options;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assets = useRef(new Map<string, string>());
  const owners = useRef(new Map<string, string>());
  const claimed = useRef(new Set<string>());
  const lastSentAt = useRef(new Map<string, number>());
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef(options);
  latest.current = options;

  const sendLayer = async (id: string, saved: PixelsVersionEntry[]): Promise<string | null> => {
    const { brandId, reuseAssets } = latest.current;
    const buffer = store.get(id);
    if (buffer === undefined) {
      store.clearDirty(id);
      return null;
    }
    try {
      const startedAt = store.revisionOf(id);
      const blob = await bufferToPng(buffer);
      if (blob === null) return ENCODE_FAILED;
      const file = new File([blob], pixelFileName(id, crypto.randomUUID().slice(0, 8)), {
        type: "image/png",
      });
      const known = reuseAssets ? assets.current.get(id) : undefined;
      const fresh = { scope: MediaScope.Brand, brandId, hidden: true };
      const first = await sendUpload(
        newItem(file),
        known === undefined ? fresh : { scope: MediaScope.Brand, brandId, assetId: known },
      );
      const gone = !first.ok && first.code === ErrorCode.NotFound;
      const sent = gone ? await sendUpload(newItem(file), fresh) : first;
      if (!sent.ok) return sent.message;
      assets.current.set(id, sent.assetId);
      owners.current.set(sent.versionId, id);
      lastSentAt.current.set(id, nowMs());
      saved.push({ id, versionId: sent.versionId });
      if (store.revisionOf(id) === startedAt) store.clearDirty(id);
      return null;
    } catch (caught) {
      logError(caught);
      return dbErrorMessage({ message: "unknown" });
    }
  };

  const runAll = async (idle: boolean): Promise<string | null> => {
    const dirty = pendingPixelIds(latest.current.document, store.dirtyIds());
    const ids = idle
      ? layersDueForFlush(dirty, lastSentAt.current, nowMs(), DESIGN_LIMITS.pixelFlushMinGapMs)
      : dirty;
    const saved: PixelsVersionEntry[] = [];
    let failure: string | null = null;
    for (const id of ids) {
      const first = await sendLayer(id, saved);
      failure = first === null ? null : await sendLayer(id, saved);
      if (failure !== null) break;
    }
    if (saved.length > 0) latest.current.onSaved(saved);
    return failure;
  };

  const flushWith = (idle: boolean): Promise<boolean> => {
    const next = chain.current.then(async () => {
      if (pendingPixelIds(latest.current.document, store.dirtyIds()).length === 0) return true;
      setUploading(true);
      setError(null);
      const message = await runAll(idle);
      setUploading(false);
      setError(message);
      return message === null;
    });
    chain.current = next;
    return next;
  };

  const flush = (): Promise<boolean> => flushWith(false);

  const flushRef = useRef(flushWith);
  flushRef.current = flushWith;

  const pending = pendingPixelIds(document, store.dirtyIds()).length;

  useEffect(() => {
    for (const id of duplicatedPixelIds(document, owners.current)) {
      if (claimed.current.has(id) || !store.has(id)) continue;
      claimed.current.add(id);
      store.markChanged(id);
    }
    claimPixelOwners(document, owners.current);
  }, [document, revision, store]);

  useEffect(() => {
    if (!enabled || pending === 0) return undefined;
    const timer = window.setTimeout(() => void flushRef.current(true), DESIGN_LIMITS.pixelFlushMs);
    return () => window.clearTimeout(timer);
  }, [enabled, pending, revision]);

  useUnsavedChanges(enabled && (pending > 0 || uploading || error !== null));

  const state = uploading
    ? DesignSaveState.Uploading
    : error === null
      ? null
      : DesignSaveState.UploadFailed;
  return { state, message: error, pending, flush };
};

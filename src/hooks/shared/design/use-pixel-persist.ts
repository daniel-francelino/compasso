import { useEffect, useRef, useState } from "react";
import { newItem, sendUpload } from "@/hooks/shared/use-media-upload";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { dbErrorMessage } from "@/lib/shared/auth/errors";
import { logError } from "@/lib/shared/logger";
import {
  claimPixelOwners,
  duplicatedPixelIds,
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
  onSaved: (elementId: string, versionId: string) => void;
};

export const usePixelPersist = (options: Options) => {
  const { store, revision, document, enabled } = options;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assets = useRef(new Map<string, string>());
  const owners = useRef(new Map<string, string>());
  const claimed = useRef(new Set<string>());
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const latest = useRef(options);
  latest.current = options;

  const sendLayer = async (id: string): Promise<string | null> => {
    const { brandId, reuseAssets, onSaved } = latest.current;
    const buffer = store.get(id);
    if (buffer === undefined) {
      store.clearDirty(id);
      return null;
    }
    try {
      const startedAt = store.revisionOf(id);
      const blob = await bufferToPng(buffer);
      if (blob === null) return ENCODE_FAILED;
      const file = new File([blob], pixelFileName(id), { type: "image/png" });
      const known = reuseAssets ? assets.current.get(id) : undefined;
      const fresh = { scope: MediaScope.Brand, brandId, hidden: true };
      const first = await sendUpload(
        newItem(file),
        known === undefined ? fresh : { scope: MediaScope.Brand, brandId, assetId: known },
      );
      const sent = first.ok || known === undefined ? first : await sendUpload(newItem(file), fresh);
      if (!sent.ok) return sent.message;
      assets.current.set(id, sent.assetId);
      owners.current.set(sent.versionId, id);
      onSaved(id, sent.versionId);
      if (store.revisionOf(id) === startedAt) store.clearDirty(id);
      return null;
    } catch (caught) {
      logError(caught);
      return dbErrorMessage({ message: "unknown" });
    }
  };

  const runAll = async (): Promise<string | null> => {
    for (const id of pendingPixelIds(latest.current.document, store.dirtyIds())) {
      const first = await sendLayer(id);
      const message = first === null ? null : await sendLayer(id);
      if (message !== null) return message;
    }
    return null;
  };

  const flush = (): Promise<boolean> => {
    const next = chain.current.then(async () => {
      if (pendingPixelIds(latest.current.document, store.dirtyIds()).length === 0) return true;
      setUploading(true);
      setError(null);
      const message = await runAll();
      setUploading(false);
      setError(message);
      return message === null;
    });
    chain.current = next;
    return next;
  };

  const flushRef = useRef(flush);
  flushRef.current = flush;

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
    const timer = window.setTimeout(() => void flushRef.current(), DESIGN_LIMITS.pixelFlushMs);
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

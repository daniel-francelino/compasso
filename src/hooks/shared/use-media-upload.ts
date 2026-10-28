import { useCallback, useRef, useState } from "react";
import { dbErrorMessage } from "@/lib/shared/auth/errors";
import type { MediaScope } from "@/lib/shared/enums";
import { formatBytes } from "@/lib/shared/format";
import { logError } from "@/lib/shared/logger";
import {
  ACCEPTED_FORMATS_LABEL,
  DEFAULT_LIMITS_MB,
  DISPLAY_SIDE,
  MAX_FILES_PER_UPLOAD,
  MediaKind,
  THUMB_SIDE,
  extensionOf,
  kindOfMime,
  mimeOfFile,
} from "@/lib/shared/media/limits";
import { type VideoInfo, inspectVideo, makeDerivative } from "@/lib/shared/media/resize";
import {
  type UploadPlan,
  abortUpload,
  confirmUpload,
  requestUpload,
} from "@/lib/shared/media/upload.functions";
import { browserStorage } from "@/lib/shared/storage/browser-storage";
import type { BrowserUploadResult } from "@/lib/shared/storage/types";

export const UploadStatus = {
  Queued: "queued",
  Uploading: "uploading",
  Done: "done",
  Failed: "failed",
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

export type UploadItem = {
  id: string;
  file: File;
  status: UploadStatus;
  message: string | null;
  assetId: string | null;
  versionId: string | null;
};

export type Target = {
  scope: MediaScope;
  brandId?: string | undefined;
  assetId?: string | undefined;
};

const MB = 1024 * 1024;

const kindNames: Record<MediaKind, string> = {
  [MediaKind.Image]: "imagens",
  [MediaKind.Video]: "vídeos",
  [MediaKind.Document]: "PDFs",
};

const unsupportedMessage = (file: File): string => {
  const extension = extensionOf(file.name);
  const named = extension === "" ? "" : ` (.${extension})`;
  return `Formato não aceito${named}. Aceitamos ${ACCEPTED_FORMATS_LABEL}.`;
};

export const rejectionFor = (file: File): string | null => {
  const kind = kindOfMime(mimeOfFile(file));
  if (kind === null) return unsupportedMessage(file);
  if (file.size <= 0) {
    return "O arquivo está vazio (0 bytes). Se veio do WhatsApp ou de outro app, baixe de novo e tente outra vez.";
  }
  const limit = DEFAULT_LIMITS_MB[kind];
  return file.size > limit * MB
    ? `O arquivo tem ${formatBytes(file.size)} e o limite para ${kindNames[kind]} é ${limit} MB.`
    : null;
};

export const newItem = (file: File): UploadItem => ({
  id: crypto.randomUUID(),
  file,
  status: rejectionFor(file) === null ? UploadStatus.Queued : UploadStatus.Failed,
  message: rejectionFor(file),
  assetId: null,
  versionId: null,
});

type Outcome = { ok: true; assetId: string; versionId: string } | { ok: false; message: string };

type Prepared = { thumb: Blob | null; display: Blob | null; video: VideoInfo | null };

const prepare = async (file: File, kind: MediaKind | null): Promise<Prepared> => {
  if (kind === MediaKind.Video) {
    const video = await inspectVideo(file, THUMB_SIDE);
    return { thumb: video?.cover ?? null, display: null, video };
  }
  if (kind !== MediaKind.Image) return { thumb: null, display: null, video: null };
  const [thumb, display] = await Promise.all([
    makeDerivative(file, THUMB_SIDE),
    makeDerivative(file, DISPLAY_SIDE),
  ]);
  return { thumb, display, video: null };
};

const failureMessageOf = (status: number): string => {
  if (status === 0) return dbErrorMessage({ message: "upload_network" });
  if (status === 401 || status === 403) return dbErrorMessage({ message: "upload_link_expired" });
  return dbErrorMessage({ message: "upload_storage_refused" });
};

const firstFailedStatus = (results: BrowserUploadResult[]): number | null => {
  for (const result of results) {
    if (!result.ok) return result.status;
  }
  return null;
};

const abandon = async (versionId: string) => {
  try {
    await abortUpload({ data: { versionId } });
  } catch (error) {
    logError(error);
  }
};

const transfer = async (
  planned: UploadPlan,
  file: File,
  mime: string,
  prepared: Prepared,
  onProgress?: (fraction: number) => void,
): Promise<Outcome> => {
  const storage = browserStorage();
  const skipped: BrowserUploadResult = { ok: true };
  const results = await Promise.all([
    storage.upload(planned.original, file, mime, onProgress),
    planned.thumb && prepared.thumb
      ? storage.upload(planned.thumb, prepared.thumb, "image/webp")
      : skipped,
    planned.display && prepared.display
      ? storage.upload(planned.display, prepared.display, "image/webp")
      : skipped,
  ]);
  const failedStatus = firstFailedStatus(results);
  if (failedStatus !== null) {
    await abandon(planned.versionId);
    return { ok: false, message: failureMessageOf(failedStatus) };
  }

  const { video } = prepared;
  const confirmed = await confirmUpload({
    data: {
      versionId: planned.versionId,
      ...(video ? { width: video.width, height: video.height, durationMs: video.durationMs } : {}),
    },
  });
  return confirmed.ok
    ? { ok: true, assetId: confirmed.assetId, versionId: confirmed.versionId }
    : { ok: false, message: confirmed.message };
};

export const sendUpload = async (
  item: UploadItem,
  target: Target,
  onProgress?: (fraction: number) => void,
): Promise<Outcome> => {
  const { file } = item;
  const mime = mimeOfFile(file);
  let versionId: string | null = null;
  try {
    const prepared = await prepare(file, kindOfMime(mime));
    const planned = await requestUpload({
      data: {
        scope: target.scope,
        ...(target.brandId ? { brandId: target.brandId } : {}),
        ...(target.assetId ? { assetId: target.assetId } : {}),
        filename: file.name,
        size: file.size,
        mime,
        idempotencyKey: item.id,
      },
    });
    if (!planned.ok) return { ok: false, message: planned.message };
    versionId = planned.versionId;
    return await transfer(planned, file, mime, prepared, onProgress);
  } catch (error) {
    logError(error);
    if (versionId !== null) await abandon(versionId);
    return { ok: false, message: dbErrorMessage({ message: "unknown" }) };
  }
};

export const useMediaUpload = (target: Target, onFinished: (items: UploadItem[]) => void) => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }, []);

  const add = useCallback((files: File[]) => {
    setItems((current) => [...current, ...files.map(newItem)].slice(0, MAX_FILES_PER_UPLOAD));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const start = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const finished: UploadItem[] = [];
    const queue = items.filter((item) => item.status === UploadStatus.Queued);
    for (const item of queue) {
      patch(item.id, { status: UploadStatus.Uploading, message: null });
      const outcome = await sendUpload(item, target);
      const next: Partial<UploadItem> = outcome.ok
        ? { status: UploadStatus.Done, assetId: outcome.assetId, versionId: outcome.versionId }
        : { status: UploadStatus.Failed, message: outcome.message };
      patch(item.id, next);
      finished.push({ ...item, ...next });
    }
    running.current = false;
    setBusy(false);
    onFinished(finished);
  }, [items, onFinished, patch, target]);

  const retryFailed = useCallback(() => {
    setItems((current) =>
      current.map((item) =>
        item.status === UploadStatus.Failed && rejectionFor(item.file) === null
          ? { ...item, id: crypto.randomUUID(), status: UploadStatus.Queued, message: null }
          : item,
      ),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, busy, add, remove, start, retryFailed, clear };
};

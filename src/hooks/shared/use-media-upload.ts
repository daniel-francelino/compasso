import { useCallback, useRef, useState } from "react";
import type { MediaScope } from "@/lib/shared/enums";
import {
  DEFAULT_LIMITS_MB,
  DISPLAY_SIDE,
  MAX_FILES_PER_UPLOAD,
  MediaKind,
  THUMB_SIDE,
  kindOfMime,
} from "@/lib/shared/media/limits";
import { inspectVideo, makeDerivative } from "@/lib/shared/media/resize";
import { abortUpload, confirmUpload, requestUpload } from "@/lib/shared/media/upload.functions";
import { browserStorage } from "@/lib/shared/storage/browser-storage";

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

type Target = { scope: MediaScope; brandId?: string | undefined; assetId?: string | undefined };

const MB = 1024 * 1024;

export const rejectionFor = (file: File): string | null => {
  const kind = kindOfMime(file.type);
  if (kind === null) return "Este tipo de arquivo não é aceito.";
  if (file.size <= 0) return "O arquivo está vazio.";
  return file.size > DEFAULT_LIMITS_MB[kind] * MB
    ? `O arquivo passa de ${DEFAULT_LIMITS_MB[kind]} MB.`
    : null;
};

const newItem = (file: File): UploadItem => ({
  id: crypto.randomUUID(),
  file,
  status: rejectionFor(file) === null ? UploadStatus.Queued : UploadStatus.Failed,
  message: rejectionFor(file),
  assetId: null,
  versionId: null,
});

type Outcome = { ok: true; assetId: string; versionId: string } | { ok: false; message: string };

const send = async (item: UploadItem, target: Target): Promise<Outcome> => {
  const { file } = item;
  const kind = kindOfMime(file.type);
  const video = kind === MediaKind.Video ? await inspectVideo(file, THUMB_SIDE) : null;
  const [thumb, display] =
    kind === MediaKind.Image
      ? await Promise.all([makeDerivative(file, THUMB_SIDE), makeDerivative(file, DISPLAY_SIDE)])
      : [video?.cover ?? null, null];

  const planned = await requestUpload({
    data: {
      scope: target.scope,
      ...(target.brandId ? { brandId: target.brandId } : {}),
      ...(target.assetId ? { assetId: target.assetId } : {}),
      filename: file.name,
      size: file.size,
      mime: file.type,
      idempotencyKey: item.id,
    },
  });
  if (!planned.ok) return { ok: false, message: planned.message };

  const storage = browserStorage();
  const uploads = await Promise.all([
    storage.upload(planned.original, file, file.type),
    planned.thumb && thumb ? storage.upload(planned.thumb, thumb, "image/webp") : true,
    planned.display && display ? storage.upload(planned.display, display, "image/webp") : true,
  ]);
  if (uploads.some((done) => !done)) {
    await abortUpload({ data: { versionId: planned.versionId } });
    return { ok: false, message: "Não foi possível enviar o arquivo." };
  }

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
      const outcome = await send(item, target);
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

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { newItem, sendUpload } from "@/hooks/shared/use-media-upload";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { imageIdsOf, signAll, videoIdsOf } from "@/hooks/shared/video/use-video-sources";
import { DESIGN_PRESET_SIZE, type DesignPreset } from "@/lib/shared/design/types";
import { MediaScope } from "@/lib/shared/enums";
import { fileSlug } from "@/lib/shared/file-name";
import { formatBytes } from "@/lib/shared/format";
import { logError } from "@/lib/shared/logger";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { mixAudio } from "@/lib/shared/video/audio-mix";
import {
  type ExportEvent,
  type ExportJobInput,
  type ExportLayer,
  type ExportMainSegment,
  ExportMessage,
} from "@/lib/shared/video/export-protocol";
import type { VideoDocument } from "@/lib/shared/video/schemas";
import { rasterizeText } from "@/lib/shared/video/text-raster";
import { mainStarts } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoClipKind, VideoExportStage } from "@/lib/shared/video/types";
import { recordVideoExport } from "@/lib/shared/video/video.functions";

type Options = { projectId: string; projectName: string; brandId: string; preset: DesignPreset };

type Prepared = { job: ExportJobInput; transfer: Transferable[] };

const PREPARE_FAILED =
  "Não foi possível carregar os arquivos do vídeo. Confira sua conexão e se o armazenamento permite a leitura (CORS).";
const RENDER_FAILED =
  "O navegador não conseguiu gerar o vídeo. Use o Chrome ou o Edge atualizados e tente de novo.";

const fetchBlobs = async (urls: Record<string, string>): Promise<Map<string, Blob>> => {
  const entries = await Promise.all(
    Object.entries(urls).map(async ([id, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`fetch_${response.status}`);
      return [id, await response.blob()] as const;
    }),
  );
  return new Map(entries);
};

const bitmapsOf = async (files: ReadonlyMap<string, Blob>): Promise<Map<string, ImageBitmap>> => {
  const entries = await Promise.all(
    [...files].map(async ([id, file]) => [id, await createImageBitmap(file)] as const),
  );
  return new Map(entries);
};

const textLayers = async (document: VideoDocument): Promise<ExportLayer[]> => {
  const layers = await Promise.all(
    document.texts.map(async (clip) => {
      const raster = await rasterizeText(clip);
      if (raster === null) return null;
      return {
        bitmap: await createImageBitmap(raster.canvas),
        startMs: clip.startMs,
        durationMs: clip.durationMs,
        x: raster.x,
        y: raster.y,
        width: raster.width,
        height: raster.height,
        opacity: 1,
      };
    }),
  );
  return layers.filter((layer) => layer !== null);
};

const prepareJob = async (
  document: VideoDocument,
  preset: DesignPreset,
  durationMs: number,
): Promise<Prepared> => {
  const videoIds = videoIdsOf(document);
  const imageIds = imageIdsOf(document);
  const [videoUrls, imageUrls] = await Promise.all([
    videoIds.length === 0 ? {} : signAll(videoIds, MediaVariant.Original),
    imageIds.length === 0 ? {} : signAll(imageIds, MediaVariant.Original),
  ]);
  const [videos, imageFiles] = await Promise.all([fetchBlobs(videoUrls), fetchBlobs(imageUrls)]);
  const images = await bitmapsOf(imageFiles);
  const starts = mainStarts(document);
  const main: ExportMainSegment[] = document.main.map((clip, index) => ({
    kind: clip.kind,
    file: clip.kind === VideoClipKind.Video ? (videos.get(clip.mediaVersionId) ?? null) : null,
    bitmap: clip.kind === VideoClipKind.Image ? (images.get(clip.mediaVersionId) ?? null) : null,
    startMs: starts[index] ?? 0,
    durationMs: clip.durationMs,
    sourceInMs: clip.sourceInMs,
    fit: clip.fit,
  }));
  const overlays: ExportLayer[] = document.overlays.flatMap((clip) => {
    const bitmap = images.get(clip.mediaVersionId);
    return bitmap === undefined ? [] : [{ ...clip, bitmap }];
  });
  const texts = await textLayers(document);
  const audio = await mixAudio(document, durationMs, videos);
  const layers = [...overlays, ...texts];
  return {
    job: {
      size: DESIGN_PRESET_SIZE[preset],
      durationMs,
      background: document.background,
      fadeInMs: document.fadeInMs,
      fadeOutMs: document.fadeOutMs,
      main,
      layers,
      audio,
    },
    transfer: [
      ...new Set([...images.values(), ...texts.map((layer) => layer.bitmap)]),
      ...audio.channels.map((channel) => channel.buffer),
    ],
  };
};

const createWorker = async (): Promise<Worker> => {
  const { default: ExportWorker } = await import("@/lib/shared/video/export.worker?worker");
  return new ExportWorker();
};

export const useVideoExport = ({ projectId, projectName, brandId, preset }: Options) => {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<VideoExportStage | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const output = useRef<{ file: File; versionNo: number } | null>(null);
  const worker = useRef<Worker | null>(null);
  const cancelled = useRef(false);

  const finishWorker = () => {
    worker.current?.terminate();
    worker.current = null;
  };

  const fail = (message: string) => {
    finishWorker();
    setError(message);
    setStage(VideoExportStage.Failed);
  };

  const upload = useCallback(async () => {
    const pending = output.current;
    if (pending === null) return;
    setError(null);
    setProgress(0);
    setStage(VideoExportStage.Uploading);
    const sent = await sendUpload(
      newItem(pending.file),
      { scope: MediaScope.Brand, brandId },
      setProgress,
    );
    if (!sent.ok) {
      setError(sent.message);
      setStage(VideoExportStage.Failed);
      return;
    }
    const recorded = await recordVideoExport({
      data: { id: projectId, versionNo: pending.versionNo, mediaVersionId: sent.versionId },
    });
    if (!recorded.ok) {
      setError(recorded.message);
      setStage(VideoExportStage.Failed);
      return;
    }
    output.current = null;
    setAssetId(sent.assetId);
    setStage(VideoExportStage.Done);
    void queryClient.invalidateQueries({ queryKey: QueryKey.Video.exports(projectId) });
    void queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
  }, [brandId, projectId, queryClient]);

  const receive = (versionNo: number) => (event: MessageEvent<ExportEvent>) => {
    const message = event.data;
    if (message.type === ExportMessage.Progress) {
      setProgress(message.fraction);
      return;
    }
    finishWorker();
    if (message.type === ExportMessage.Cancelled) {
      setStage(VideoExportStage.Cancelled);
      return;
    }
    if (message.type === ExportMessage.Failed) {
      logError(new Error(`video_export_failed ${message.reason}`));
      fail(RENDER_FAILED);
      return;
    }
    if (message.buffer.byteLength > VIDEO_LIMITS.maxExportBytes) {
      fail(
        `O vídeo gerado tem ${formatBytes(message.buffer.byteLength)} e passa do limite de 100 MB. Encurte o vídeo e exporte de novo.`,
      );
      return;
    }
    const name = `${fileSlug(projectName, "video")}.mp4`;
    output.current = { file: new File([message.buffer], name, { type: "video/mp4" }), versionNo };
    void upload();
  };

  const start = async (document: VideoDocument, durationMs: number, versionNo: number) => {
    cancelled.current = false;
    output.current = null;
    setError(null);
    setAssetId(null);
    setProgress(0);
    setStage(VideoExportStage.Preparing);
    let prepared: Prepared;
    try {
      prepared = await prepareJob(document, preset, durationMs);
    } catch (reason) {
      logError(reason);
      fail(PREPARE_FAILED);
      return;
    }
    if (cancelled.current) {
      setStage(VideoExportStage.Cancelled);
      return;
    }
    try {
      worker.current = await createWorker();
    } catch (reason) {
      logError(reason);
      fail(RENDER_FAILED);
      return;
    }
    setStage(VideoExportStage.Rendering);
    worker.current.addEventListener("message", receive(versionNo));
    worker.current.addEventListener("error", () => fail(RENDER_FAILED));
    worker.current.postMessage(
      { type: ExportMessage.Start, job: prepared.job },
      { transfer: prepared.transfer },
    );
  };

  const cancel = () => {
    cancelled.current = true;
    if (worker.current === null) {
      setStage((current) =>
        current === VideoExportStage.Preparing ? VideoExportStage.Cancelled : current,
      );
      return;
    }
    worker.current.postMessage({ type: ExportMessage.Cancel });
  };

  useEffect(() => () => worker.current?.terminate(), []);

  const busy =
    stage === VideoExportStage.Preparing ||
    stage === VideoExportStage.Rendering ||
    stage === VideoExportStage.Uploading;

  useUnsavedChanges(busy);

  return {
    stage,
    progress,
    error,
    assetId,
    busy,
    canRetryUpload: stage === VideoExportStage.Failed && output.current !== null,
    start,
    cancel,
    retryUpload: () => void upload(),
    reset: () => {
      output.current = null;
      setStage(null);
      setError(null);
      setAssetId(null);
      setProgress(0);
    },
  };
};

export type VideoExport = ReturnType<typeof useVideoExport>;

import { useState } from "react";
import { toast } from "sonner";
import type { PickedMedia } from "@/components/shared/media/media-picker";
import type { VideoEditor } from "@/hooks/shared/video/use-video-editor";
import { signAll } from "@/hooks/shared/video/use-video-sources";
import { imageNaturalSize, readCanvasChrome } from "@/lib/shared/design/browser";
import type { DesignPreset } from "@/lib/shared/design/types";
import { logError } from "@/lib/shared/logger";
import { MediaKind } from "@/lib/shared/media/limits";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { probeVideo } from "@/lib/shared/video/probe";
import {
  canAdd,
  createAudioClip,
  createMainClip,
  createOverlayClip,
  createTextClip,
  remainingMs,
} from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoClipKind, VideoTrack } from "@/lib/shared/video/types";

const IMAGE_SECONDS_MS = 3000;
const FULL_TIME =
  "O vídeo chegou ao limite de 90 segundos. Encurte ou remova clipes para adicionar outro.";
const FULL_TRACK = "Esta faixa chegou ao limite de clipes. Remova algum para adicionar outro.";
const NO_ROOM = "Não há espaço depois do cursor: mova o cursor para antes dos 90 segundos.";
const NO_CHROME = "Não foi possível ler as cores do tema. Recarregue a página.";
const UNREADABLE_IMAGE = "Não foi possível abrir esta imagem. Tente de novo.";
const UNREADABLE_VIDEO = "Não foi possível abrir este vídeo. Tente de novo.";

const newId = () => crypto.randomUUID();

const originalUrl = async (versionId: string): Promise<string | null> => {
  try {
    const urls = await signAll([versionId], MediaVariant.Original);
    return urls[versionId] ?? null;
  } catch (error) {
    logError(error);
    return null;
  }
};

export const useVideoAdders = ({
  editor,
  preset,
  playheadMs,
}: {
  editor: VideoEditor;
  preset: DesignPreset;
  playheadMs: () => number;
}) => {
  const [busy, setBusy] = useState(false);

  const roomAfterPlayhead = () =>
    Math.min(IMAGE_SECONDS_MS, VIDEO_LIMITS.maxDurationMs - playheadMs());

  const addMainItem = async (
    item: PickedMedia,
    addedClips: number,
    addedMs: number,
  ): Promise<number | null> => {
    if (editor.document.main.length + addedClips >= VIDEO_LIMITS.maxMainClips) {
      toast.error(FULL_TRACK);
      return null;
    }
    const room = remainingMs(editor.document) - addedMs;
    if (room < VIDEO_LIMITS.minClipMs) {
      toast.error(FULL_TIME);
      return null;
    }
    if (item.kind === MediaKind.Image) {
      const duration = Math.min(IMAGE_SECONDS_MS, room);
      editor.addMain(createMainClip(newId(), VideoClipKind.Image, item.versionId, duration));
      return duration;
    }
    const url = await originalUrl(item.versionId);
    const probe = url === null ? null : await probeVideo(url, true);
    if (probe === null || !probe.ok) {
      toast.error(probe?.message ?? UNREADABLE_VIDEO, { description: item.name });
      return 0;
    }
    const duration = Math.min(probe.durationMs, room);
    editor.addMain(createMainClip(newId(), VideoClipKind.Video, item.versionId, duration));
    return duration;
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    addClips: (items: PickedMedia[]) =>
      run(async () => {
        let addedMs = 0;
        let addedClips = 0;
        for (const item of items) {
          const duration = await addMainItem(item, addedClips, addedMs);
          if (duration === null) return;
          addedMs += duration;
          addedClips += duration > 0 ? 1 : 0;
        }
      }),
    addOverlay: ([item]: PickedMedia[]) =>
      run(async () => {
        if (item === undefined) return;
        if (!canAdd(editor.document, VideoTrack.Overlay)) {
          toast.error(FULL_TRACK);
          return;
        }
        const duration = roomAfterPlayhead();
        if (duration < VIDEO_LIMITS.minClipMs) {
          toast.error(NO_ROOM);
          return;
        }
        const natural = await imageNaturalSize(item.versionId);
        if (natural === null) {
          toast.error(UNREADABLE_IMAGE, { description: item.name });
          return;
        }
        editor.addOverlay(
          createOverlayClip(newId(), item.versionId, preset, natural, playheadMs(), duration),
        );
      }),
    addText: () => {
      const chrome = readCanvasChrome();
      if (chrome === null) {
        toast.error(NO_CHROME);
        return;
      }
      if (!canAdd(editor.document, VideoTrack.Text)) {
        toast.error(FULL_TRACK);
        return;
      }
      const duration = roomAfterPlayhead();
      if (duration < VIDEO_LIMITS.minClipMs) {
        toast.error(NO_ROOM);
        return;
      }
      editor.addText(createTextClip(newId(), preset, chrome.surface, playheadMs(), duration));
    },
    addAudio: ([item]: PickedMedia[]) =>
      run(async () => {
        if (item === undefined) return;
        if (!canAdd(editor.document, VideoTrack.Audio)) {
          toast.error(FULL_TRACK);
          return;
        }
        const room = VIDEO_LIMITS.maxDurationMs - playheadMs();
        if (room < VIDEO_LIMITS.minClipMs) {
          toast.error(NO_ROOM);
          return;
        }
        const url = await originalUrl(item.versionId);
        const probe = url === null ? null : await probeVideo(url, false);
        if (probe === null || !probe.ok) {
          toast.error(probe?.message ?? UNREADABLE_VIDEO, { description: item.name });
          return;
        }
        editor.addAudio(
          createAudioClip(newId(), item.versionId, playheadMs(), Math.min(probe.durationMs, room)),
        );
      }),
  };
};

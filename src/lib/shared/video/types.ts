import type { ValueOf } from "@/lib/shared/utils";

export const VideoClipKind = {
  Video: "video",
  Image: "image",
} as const;
export type VideoClipKind = ValueOf<typeof VideoClipKind>;

export const VideoFit = {
  Cover: "cover",
  Contain: "contain",
} as const;
export type VideoFit = ValueOf<typeof VideoFit>;

export const VideoTrack = {
  Main: "main",
  Overlay: "overlay",
  Text: "text",
  Audio: "audio",
} as const;
export type VideoTrack = ValueOf<typeof VideoTrack>;

export const VideoTrimEdge = {
  Start: "start",
  End: "end",
} as const;
export type VideoTrimEdge = ValueOf<typeof VideoTrimEdge>;

export const VideoStatusFilter = {
  Active: "active",
  Trash: "trash",
} as const;
export type VideoStatusFilter = ValueOf<typeof VideoStatusFilter>;

export const VideoExportStage = {
  Preparing: "preparing",
  Rendering: "rendering",
  Uploading: "uploading",
  Done: "done",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type VideoExportStage = ValueOf<typeof VideoExportStage>;

export const VIDEO_CLIP_KIND_LABEL: Record<VideoClipKind, string> = {
  [VideoClipKind.Video]: "Vídeo",
  [VideoClipKind.Image]: "Imagem",
};

export const VIDEO_FIT_LABEL: Record<VideoFit, string> = {
  [VideoFit.Cover]: "Preencher",
  [VideoFit.Contain]: "Ajustar",
};

export const VIDEO_TRACK_LABEL: Record<VideoTrack, string> = {
  [VideoTrack.Main]: "Principal",
  [VideoTrack.Overlay]: "Sobreposição",
  [VideoTrack.Text]: "Texto",
  [VideoTrack.Audio]: "Música",
};

export const VIDEO_EXPORT_STAGE_LABEL: Record<VideoExportStage, string> = {
  [VideoExportStage.Preparing]: "Preparando…",
  [VideoExportStage.Rendering]: "Gerando o vídeo…",
  [VideoExportStage.Uploading]: "Enviando para a biblioteca…",
  [VideoExportStage.Done]: "Vídeo exportado",
  [VideoExportStage.Failed]: "Não foi possível exportar",
  [VideoExportStage.Cancelled]: "Exportação cancelada",
};

export const VIDEO_LIMITS = {
  nameMax: 120,
  fps: 30,
  maxDurationMs: 90000,
  minClipMs: 100,
  maxMainClips: 50,
  maxOverlays: 20,
  maxTexts: 30,
  maxAudio: 5,
  maxBytes: 262144,
  maxText: 500,
  minFontSize: 12,
  maxFontSize: 300,
  maxProjectFadeMs: 3000,
  maxAudioFadeMs: 10000,
  maxCoordinate: 20000,
  minSize: 1,
  maxSize: 20000,
  maxSourceMs: 3600000,
  videoBitrate: 6000000,
  audioBitrate: 128000,
  audioSampleRate: 48000,
  audioChannels: 2,
  maxExportBytes: 100 * 1024 * 1024,
  history: 100,
  autosaveMs: 2000,
  driftSeconds: 0.15,
  snapScreenPx: 8,
  minZoom: 0.02,
  maxZoom: 0.5,
  defaultZoom: 0.1,
  desktopMinWidth: 1024,
} as const;

export const VIDEO_PAGE_SIZE = 20;

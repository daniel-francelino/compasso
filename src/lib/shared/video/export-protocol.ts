import type { PageSize } from "@/lib/shared/design/types";
import type { ValueOf } from "@/lib/shared/utils";
import type { VideoClipKind, VideoFit } from "@/lib/shared/video/types";

export const ExportMessage = {
  Start: "start",
  Cancel: "cancel",
  Progress: "progress",
  Done: "done",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type ExportMessage = ValueOf<typeof ExportMessage>;

export type ExportMainSegment = {
  kind: VideoClipKind;
  file: Blob | null;
  bitmap: ImageBitmap | null;
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  fit: VideoFit;
};

export type ExportLayer = {
  bitmap: ImageBitmap;
  startMs: number;
  durationMs: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

export type ExportJobInput = {
  size: PageSize;
  durationMs: number;
  background: string;
  fadeInMs: number;
  fadeOutMs: number;
  main: ExportMainSegment[];
  layers: ExportLayer[];
  audio: { channels: Float32Array[]; sampleRate: number } | null;
};

export type ExportCommand =
  { type: typeof ExportMessage.Start; job: ExportJobInput } | { type: typeof ExportMessage.Cancel };

export type ExportEvent =
  | { type: typeof ExportMessage.Progress; fraction: number }
  | { type: typeof ExportMessage.Done; buffer: ArrayBuffer }
  | { type: typeof ExportMessage.Failed; reason: string }
  | { type: typeof ExportMessage.Cancelled };

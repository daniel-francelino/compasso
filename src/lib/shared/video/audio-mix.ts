import { logError } from "@/lib/shared/logger";
import type { VideoDocument } from "@/lib/shared/video/schemas";
import { mainStarts } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoClipKind } from "@/lib/shared/video/types";

export type MixedAudio = { channels: Float32Array[]; sampleRate: number };

type Placement = {
  mediaVersionId: string;
  startMs: number;
  durationMs: number;
  sourceInMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
};

const placementsOf = (document: VideoDocument): Placement[] => {
  const starts = mainStarts(document);
  const main = document.main.flatMap((clip, index) =>
    clip.kind === VideoClipKind.Video && clip.volume > 0
      ? [
          {
            mediaVersionId: clip.mediaVersionId,
            startMs: starts[index] ?? 0,
            durationMs: clip.durationMs,
            sourceInMs: clip.sourceInMs,
            volume: clip.volume,
            fadeInMs: 0,
            fadeOutMs: 0,
          },
        ]
      : [],
  );
  const music = document.audio.filter((clip) => clip.volume > 0);
  return [...main, ...music];
};

const decodeAll = async (
  context: OfflineAudioContext,
  ids: readonly string[],
  files: ReadonlyMap<string, Blob>,
): Promise<Map<string, AudioBuffer>> => {
  const decoded = new Map<string, AudioBuffer>();
  for (const id of ids) {
    const file = files.get(id);
    if (file === undefined) continue;
    try {
      decoded.set(id, await context.decodeAudioData(await file.arrayBuffer()));
    } catch (error) {
      logError(error);
    }
  }
  return decoded;
};

const envelope = (gain: GainNode, placement: Placement, seconds: (ms: number) => number) => {
  const start = seconds(placement.startMs);
  const end = seconds(placement.startMs + placement.durationMs);
  const fadeIn = Math.min(placement.fadeInMs, placement.durationMs / 2);
  const fadeOut = Math.min(placement.fadeOutMs, placement.durationMs / 2);
  gain.gain.setValueAtTime(fadeIn > 0 ? 0 : placement.volume, start);
  if (fadeIn > 0) gain.gain.linearRampToValueAtTime(placement.volume, start + seconds(fadeIn));
  if (fadeOut <= 0) return;
  gain.gain.setValueAtTime(placement.volume, end - seconds(fadeOut));
  gain.gain.linearRampToValueAtTime(0, end);
};

const masterFade = (gain: GainNode, document: VideoDocument, durationSeconds: number) => {
  const fadeIn = document.fadeInMs / 1000;
  const fadeOut = document.fadeOutMs / 1000;
  gain.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, 0);
  if (fadeIn > 0) gain.gain.linearRampToValueAtTime(1, fadeIn);
  if (fadeOut <= 0) return;
  gain.gain.setValueAtTime(1, Math.max(0, durationSeconds - fadeOut));
  gain.gain.linearRampToValueAtTime(0, durationSeconds);
};

export const mixAudio = async (
  document: VideoDocument,
  durationMs: number,
  files: ReadonlyMap<string, Blob>,
): Promise<MixedAudio> => {
  const sampleRate = VIDEO_LIMITS.audioSampleRate;
  const durationSeconds = durationMs / 1000;
  const context = new OfflineAudioContext(
    VIDEO_LIMITS.audioChannels,
    Math.max(1, Math.ceil(durationSeconds * sampleRate)),
    sampleRate,
  );
  const placements = placementsOf(document);
  const buffers = await decodeAll(
    context,
    [...new Set(placements.map((item) => item.mediaVersionId))],
    files,
  );
  const master = context.createGain();
  masterFade(master, document, durationSeconds);
  master.connect(context.destination);
  const seconds = (ms: number) => ms / 1000;

  for (const placement of placements) {
    const buffer = buffers.get(placement.mediaVersionId);
    if (buffer === undefined) continue;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    envelope(gain, placement, seconds);
    source.connect(gain);
    gain.connect(master);
    source.start(
      seconds(placement.startMs),
      seconds(placement.sourceInMs),
      seconds(placement.durationMs),
    );
  }

  const rendered = await context.startRendering();
  const channels = Array.from({ length: rendered.numberOfChannels }, (_, index) =>
    rendered.getChannelData(index).slice(),
  );
  return { channels, sampleRate };
};

import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  type WrappedCanvas,
} from "mediabunny";
import { type FrameImage, type FrameLayer, composeFrame } from "@/lib/shared/video/compose";
import {
  type ExportCommand,
  type ExportEvent,
  type ExportJobInput,
  type ExportMainSegment,
  ExportMessage,
} from "@/lib/shared/video/export-protocol";
import { fadeLevel, frameCount } from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoClipKind } from "@/lib/shared/video/types";

type Decoder = {
  input: Input | null;
  frames: AsyncGenerator<WrappedCanvas | null, void, unknown> | null;
};

const PROGRESS_EVERY = 15;

let cancelled = false;

const send = (event: ExportEvent, transfer: Transferable[] = []) =>
  globalThis.postMessage(event, { transfer });

const frameTime = (index: number) => (index * 1000) / VIDEO_LIMITS.fps;

const segmentAt = (segments: readonly ExportMainSegment[], timeMs: number) =>
  segments.findIndex(
    (segment) => segment.startMs <= timeMs && timeMs < segment.startMs + segment.durationMs,
  );

function* segmentTimestamps(segment: ExportMainSegment, firstFrame: number, total: number) {
  for (let index = firstFrame; index < total; index += 1) {
    const time = frameTime(index);
    if (time >= segment.startMs + segment.durationMs) return;
    yield (segment.sourceInMs + time - segment.startMs) / 1000;
  }
}

const openDecoder = async (
  segment: ExportMainSegment,
  firstFrame: number,
  total: number,
): Promise<Decoder> => {
  if (segment.kind !== VideoClipKind.Video || segment.file === null) {
    return { input: null, frames: null };
  }
  const input = new Input({ source: new BlobSource(segment.file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (track === null) return { input, frames: null };
  const sink = new CanvasSink(track, { poolSize: 2 });
  return {
    input,
    frames: sink.canvasesAtTimestamps(segmentTimestamps(segment, firstFrame, total)),
  };
};

const closeDecoder = async (decoder: Decoder) => {
  await decoder.frames?.return();
  decoder.input?.dispose();
};

const layersAt = (job: ExportJobInput, timeMs: number): FrameLayer[] =>
  job.layers
    .filter((layer) => layer.startMs <= timeMs && timeMs < layer.startMs + layer.durationMs)
    .map((layer) => ({
      image: layer.bitmap,
      width: layer.bitmap.width,
      height: layer.bitmap.height,
      x: layer.x,
      y: layer.y,
      boxWidth: layer.width,
      boxHeight: layer.height,
      opacity: layer.opacity,
    }));

const audioChunk = (job: ExportJobInput, second: number): AudioSample | null => {
  const { audio } = job;
  if (audio === null) return null;
  const from = second * audio.sampleRate;
  const length = Math.min(audio.sampleRate, (audio.channels[0]?.length ?? 0) - from);
  if (length <= 0) return null;
  const data = new Float32Array(length * audio.channels.length);
  audio.channels.forEach((channel, index) => {
    data.set(channel.subarray(from, from + length), index * length);
  });
  return new AudioSample({
    data,
    format: "f32-planar",
    numberOfChannels: audio.channels.length,
    sampleRate: audio.sampleRate,
    timestamp: second,
  });
};

const pushAudio = async (source: AudioSampleSource | null, job: ExportJobInput, second: number) => {
  if (source === null) return;
  const sample = audioChunk(job, second);
  if (sample === null) return;
  await source.add(sample);
  sample.close();
};

const nextFrameImage = async (
  segment: ExportMainSegment | undefined,
  decoder: Decoder,
  previous: FrameImage | null,
): Promise<FrameImage | null> => {
  if (segment === undefined) return null;
  if (segment.bitmap !== null) {
    return { image: segment.bitmap, width: segment.bitmap.width, height: segment.bitmap.height };
  }
  const next = await decoder.frames?.next();
  const wrapped = next?.done === false ? next.value : null;
  if (wrapped === null || wrapped === undefined) return previous;
  return { image: wrapped.canvas, width: wrapped.canvas.width, height: wrapped.canvas.height };
};

const render = async (job: ExportJobInput) => {
  const canvas = new OffscreenCanvas(job.size.width, job.size.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("canvas_unavailable");

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const video = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: VIDEO_LIMITS.videoBitrate,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(video, { frameRate: VIDEO_LIMITS.fps });
  const audio =
    job.audio === null
      ? null
      : new AudioSampleSource({ codec: "aac", bitrate: VIDEO_LIMITS.audioBitrate });
  if (audio !== null) output.addAudioTrack(audio);
  await output.start();

  const total = frameCount(job.durationMs);
  let current = -1;
  let decoder: Decoder = { input: null, frames: null };
  let previous: FrameImage | null = null;

  for (let index = 0; index < total; index += 1) {
    if (cancelled) {
      await closeDecoder(decoder);
      await output.cancel();
      return null;
    }
    const time = frameTime(index);
    const position = segmentAt(job.main, time);
    if (position !== current) {
      await closeDecoder(decoder);
      const segment = job.main[position];
      decoder =
        segment === undefined
          ? { input: null, frames: null }
          : await openDecoder(segment, index, total);
      current = position;
      previous = null;
    }
    const segment = job.main[position];
    previous = await nextFrameImage(segment, decoder, previous);
    composeFrame(context, {
      size: job.size,
      scale: 1,
      background: job.background,
      main: previous === null || segment === undefined ? null : { ...previous, fit: segment.fit },
      layers: layersAt(job, time),
      fade: fadeLevel(job, time, job.durationMs),
    });
    await video.add(index / VIDEO_LIMITS.fps, 1 / VIDEO_LIMITS.fps);
    if (index % VIDEO_LIMITS.fps === 0) await pushAudio(audio, job, index / VIDEO_LIMITS.fps);
    if (index % PROGRESS_EVERY === 0)
      send({ type: ExportMessage.Progress, fraction: index / total });
  }
  await closeDecoder(decoder);
  video.close();
  audio?.close();
  await output.finalize();
  return target.buffer;
};

globalThis.addEventListener("message", (event: MessageEvent<ExportCommand>) => {
  const command = event.data;
  if (command.type === ExportMessage.Cancel) {
    cancelled = true;
    return;
  }
  cancelled = false;
  void render(command.job)
    .then((buffer) => {
      if (buffer === null) {
        send({ type: ExportMessage.Cancelled });
        return;
      }
      send({ type: ExportMessage.Done, buffer }, [buffer]);
    })
    .catch((error: unknown) => {
      send({ type: ExportMessage.Failed, reason: error instanceof Error ? error.message : "" });
    });
});

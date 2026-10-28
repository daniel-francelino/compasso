export const makeDerivative = async (file: Blob, maxSide: number): Promise<Blob | null> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  } catch {
    return null;
  }
};

export type VideoInfo = { width: number; height: number; durationMs: number; cover: Blob | null };

const VIDEO_INSPECT_TIMEOUT_MS = 10_000;
const MAX_DURATION_MS = 86_400_000;

const durationOf = (seconds: number): number =>
  Number.isFinite(seconds) ? Math.min(MAX_DURATION_MS, Math.round(seconds * 1000)) : 0;

export const inspectVideo = (file: Blob, coverSide: number): Promise<VideoInfo | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const timer = setTimeout(() => finish(null), VIDEO_INSPECT_TIMEOUT_MS);
    const finish = (value: VideoInfo | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };

    const captureCover = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width <= 0 || height <= 0) {
        finish(null);
        return;
      }
      const scale = Math.min(1, coverSide / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blank = context?.getImageData(0, 0, 1, 1).data[3] === 0;
      const info = { width, height, durationMs: durationOf(video.duration) };
      if (blank) {
        finish({ ...info, cover: null });
        return;
      }
      canvas.toBlob((cover) => finish({ ...info, cover }), "image/webp", 0.82);
    };

    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      const seconds = Number.isFinite(video.duration) ? Math.min(1, video.duration / 10) : 0.1;
      video.currentTime = Math.max(0.05, seconds);
    };
    video.onseeked = captureCover;
  });

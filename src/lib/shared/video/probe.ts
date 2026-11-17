import { logError } from "@/lib/shared/logger";
import { VIDEO_LIMITS } from "@/lib/shared/video/types";

export type VideoProbe =
  { ok: true; durationMs: number; width: number; height: number } | { ok: false; message: string };

const UNSUPPORTED =
  "Este vídeo usa um formato que o navegador não consegue abrir (por exemplo HEVC, comum no iPhone). Converta para H.264 (MP4) e envie de novo para a biblioteca.";
const UNREADABLE =
  "Não foi possível ler este vídeo. Confira se o arquivo abre no computador e se o armazenamento permite a leitura (CORS).";
const NO_TRACK = "Este arquivo não tem imagem de vídeo.";
const NO_SOUND = "Este vídeo não tem som para usar como música.";

const loadMediabunny = () => import("mediabunny");

export const probeVideo = async (url: string, needsPicture: boolean): Promise<VideoProbe> => {
  try {
    const { ALL_FORMATS, Input, UrlSource } = await loadMediabunny();
    const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
    try {
      const video = await input.getPrimaryVideoTrack();
      const audio = await input.getPrimaryAudioTrack();
      if (needsPicture && video === null) return { ok: false, message: NO_TRACK };
      if (!needsPicture && audio === null) return { ok: false, message: NO_SOUND };
      if (needsPicture && video !== null && !(await video.canDecode())) {
        return { ok: false, message: UNSUPPORTED };
      }
      const seconds = await input.computeDuration();
      return {
        ok: true,
        durationMs: Math.max(VIDEO_LIMITS.minClipMs, Math.floor(seconds * 1000)),
        width: video?.displayWidth ?? 0,
        height: video?.displayHeight ?? 0,
      };
    } finally {
      input.dispose();
    }
  } catch (error) {
    logError(error);
    return { ok: false, message: UNREADABLE };
  }
};

export const canExportInBrowser = async (width: number, height: number): Promise<boolean> => {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return false;
  try {
    const { canEncodeAudio, canEncodeVideo } = await loadMediabunny();
    const [video, audio] = await Promise.all([
      canEncodeVideo("avc", { width, height, bitrate: VIDEO_LIMITS.videoBitrate }),
      canEncodeAudio("aac", {
        numberOfChannels: VIDEO_LIMITS.audioChannels,
        sampleRate: VIDEO_LIMITS.audioSampleRate,
        bitrate: VIDEO_LIMITS.audioBitrate,
      }),
    ]);
    return video && audio;
  } catch (error) {
    logError(error);
    return false;
  }
};

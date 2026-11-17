import type { VideoDocument } from "@/lib/shared/video/schemas";
import type { TimedClip } from "@/lib/shared/video/timeline";
import { VIDEO_CLIP_KIND_LABEL, VIDEO_TRACK_LABEL, VideoTrack } from "@/lib/shared/video/types";

const LABEL_LENGTH = 40;

export const clipLabel = (document: VideoDocument, clip: TimedClip): string => {
  if (clip.track === VideoTrack.Main) {
    const position = document.main.findIndex((item) => item.id === clip.id);
    const main = document.main[position];
    return main === undefined ? "" : `${VIDEO_CLIP_KIND_LABEL[main.kind]} ${position + 1}`;
  }
  if (clip.track === VideoTrack.Text) {
    const text = document.texts.find((item) => item.id === clip.id)?.text.trim() ?? "";
    return text === "" ? "Texto vazio" : text.slice(0, LABEL_LENGTH);
  }
  return clip.track === VideoTrack.Overlay ? "Imagem" : VIDEO_TRACK_LABEL[VideoTrack.Audio];
};

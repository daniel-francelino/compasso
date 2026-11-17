import { useQuery } from "@tanstack/react-query";
import { INTERNAL_URL_SECONDS } from "@/lib/shared/media/limits";
import { signMediaUrls } from "@/lib/shared/media/media.functions";
import { MediaVariant } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import type { VideoDocument } from "@/lib/shared/video/schemas";
import { VideoClipKind } from "@/lib/shared/video/types";

const CHUNK = 60;
const REFRESH_MS = (INTERNAL_URL_SECONDS - 60) * 1000;

const chunks = (ids: readonly string[]): string[][] =>
  Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, index) =>
    ids.slice(index * CHUNK, (index + 1) * CHUNK),
  );

export const signAll = async (
  ids: readonly string[],
  variant: MediaVariant,
): Promise<Record<string, string>> => {
  const parts = await Promise.all(
    chunks(ids).map(
      async (part) =>
        unwrapResult(await signMediaUrls({ data: { versionIds: part, variant } })).urls,
    ),
  );
  return Object.assign({}, ...parts);
};

export const videoIdsOf = (document: VideoDocument): string[] => [
  ...new Set([
    ...document.main
      .filter((clip) => clip.kind === VideoClipKind.Video)
      .map((clip) => clip.mediaVersionId),
    ...document.audio.map((clip) => clip.mediaVersionId),
  ]),
];

export const imageIdsOf = (document: VideoDocument): string[] => [
  ...new Set([
    ...document.main
      .filter((clip) => clip.kind === VideoClipKind.Image)
      .map((clip) => clip.mediaVersionId),
    ...document.overlays.map((clip) => clip.mediaVersionId),
  ]),
];

export type SourceUrls = { videos: Record<string, string>; images: Record<string, string> };

export const useVideoSources = (document: VideoDocument) => {
  const videos = videoIdsOf(document).sort();
  const images = imageIdsOf(document).sort();
  const key = `${videos.join(",")}|${images.join(",")}`;
  return useQuery({
    queryKey: QueryKey.Video.sources(key),
    queryFn: async (): Promise<SourceUrls> => {
      const [videoUrls, imageUrls] = await Promise.all([
        videos.length === 0 ? {} : signAll(videos, MediaVariant.Original),
        images.length === 0 ? {} : signAll(images, MediaVariant.Display),
      ]);
      return { videos: videoUrls, images: imageUrls };
    },
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
};

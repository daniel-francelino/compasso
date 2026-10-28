import type { ValueOf } from "@/lib/shared/utils";

export const MediaKind = {
  Image: "image",
  Video: "video",
  Document: "document",
} as const;
export type MediaKind = ValueOf<typeof MediaKind>;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/x-m4v",
  "video/quicktime",
  "video/3gpp",
  "video/3gpp2",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
] as const;
export const DOCUMENT_MIME_TYPES = ["application/pdf"] as const;

export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

export const MEDIA_MIME_TYPES = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
] as const;
export type MediaMime = (typeof MEDIA_MIME_TYPES)[number];

export const MAX_DERIVATIVE_BYTES = 2 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
export const MAX_FILES_PER_UPLOAD = 10;
export const THUMB_SIDE = 400;
export const DISPLAY_SIDE = 1600;

export const QUOTA_WARN_RATIO = 0.8;
export const QUOTA_ALERT_RATIO = 0.95;

export const INTERNAL_URL_SECONDS = 300;
export const EXTERNAL_URL_SECONDS = 120;

export const DEFAULT_LIMITS_MB = { image: 25, video: 100, document: 50 } as const;

export const kindOfMime = (mime: string): MediaKind | null => {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return MediaKind.Image;
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return MediaKind.Video;
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(mime)) return MediaKind.Document;
  return null;
};

export const isMediaMime = (mime: string): mime is MediaMime => kindOfMime(mime) !== null;

const MIME_BY_EXTENSION: Record<string, MediaMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  "3gp": "video/3gpp",
  "3g2": "video/3gpp2",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  pdf: "application/pdf",
};

export const ACCEPTED_FORMATS_LABEL =
  "imagens JPEG, PNG e WebP, vídeos MP4, MOV, M4V, 3GP, WebM, MKV e AVI, e PDFs";

export const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf(".");
  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
};

export const mimeOfFile = (file: { name: string; type: string }): string => {
  const declared = file.type.trim().toLowerCase();
  if (isMediaMime(declared)) return declared;
  return MIME_BY_EXTENSION[extensionOf(file.name)] ?? declared;
};

const extensionsOf = (kinds: readonly MediaKind[]): string[] =>
  Object.entries(MIME_BY_EXTENSION)
    .filter(([, mime]) => {
      const kind = kindOfMime(mime);
      return kind !== null && kinds.includes(kind);
    })
    .map(([extension]) => `.${extension}`);

const ALL_KINDS = [MediaKind.Image, MediaKind.Video, MediaKind.Document] as const;

const mimeTypesOf: Record<MediaKind, readonly string[]> = {
  [MediaKind.Image]: IMAGE_MIME_TYPES,
  [MediaKind.Video]: VIDEO_MIME_TYPES,
  [MediaKind.Document]: DOCUMENT_MIME_TYPES,
};

export const acceptFor = (kinds: readonly MediaKind[]): string =>
  [...kinds.flatMap((kind) => mimeTypesOf[kind]), ...extensionsOf(kinds)].join(",");

export const acceptAttribute = acceptFor(ALL_KINDS);

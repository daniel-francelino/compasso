import { z } from "zod";
import { ContentFormat } from "@/lib/shared/enums";
import { GRAPH_BASE, type MetaResult, graphGet, graphPost } from "@/lib/shared/social/graph.server";
import { PublishErrorCode } from "@/lib/shared/social/publish-codes";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_CAROUSEL_ITEMS = 2;
export const MAX_CAROUSEL_ITEMS = 20;
export const MAX_CAPTION_LENGTH = 2200;
export const MAX_HASHTAGS = 30;
export const JPEG_MIME = "image/jpeg";
export const VIDEO_MIME = "video/mp4";

export const ContainerStatus = {
  Expired: "EXPIRED",
  Error: "ERROR",
  Finished: "FINISHED",
  InProgress: "IN_PROGRESS",
  Published: "PUBLISHED",
} as const;
export type ContainerStatus = (typeof ContainerStatus)[keyof typeof ContainerStatus];

export type PublishMedia = {
  mimeType: string;
  sizeBytes: number | null;
  url: string;
};

export type PublishRequest = {
  format: string;
  caption: string;
  media: PublishMedia[];
};

export type RequestCheck = { ok: true } | { ok: false; code: PublishErrorCode };

const idSchema = z.object({ id: z.string().min(1) });
const statusSchema = z.object({ status_code: z.string().min(1) });
const permalinkSchema = z.object({ permalink: z.string().url() });
const quotaSchema = z.object({
  data: z
    .array(
      z.object({
        quota_usage: z.number().int().nonnegative(),
        config: z.object({ quota_total: z.number().int().positive() }).optional(),
      }),
    )
    .min(1),
});

const isImage = (media: PublishMedia): boolean => media.mimeType === JPEG_MIME;
const isVideo = (media: PublishMedia): boolean => media.mimeType === VIDEO_MIME;
const tooBig = (media: PublishMedia): boolean =>
  isImage(media) && media.sizeBytes !== null && media.sizeBytes > MAX_IMAGE_BYTES;

const refuse = (code: PublishErrorCode): RequestCheck => ({ ok: false, code });

export const hashtagCount = (caption: string): number =>
  (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

export const checkRequest = (request: PublishRequest): RequestCheck => {
  const { format, media, caption } = request;
  if (caption.length > MAX_CAPTION_LENGTH || hashtagCount(caption) > MAX_HASHTAGS) {
    return refuse(PublishErrorCode.Rejected);
  }
  if (media.length === 0 || media.some(tooBig)) return refuse(PublishErrorCode.MediaNotReady);
  if (format === ContentFormat.Image) {
    return media.length === 1 && media.every((item) => isImage(item) || isVideo(item))
      ? { ok: true }
      : refuse(PublishErrorCode.MediaNotReady);
  }
  if (format === ContentFormat.Carousel) {
    const sized = media.length >= MIN_CAROUSEL_ITEMS && media.length <= MAX_CAROUSEL_ITEMS;
    return sized && media.every(isImage) ? { ok: true } : refuse(PublishErrorCode.MediaNotReady);
  }
  if (format === ContentFormat.Reel) {
    return media.length === 1 && media.every(isVideo)
      ? { ok: true }
      : refuse(PublishErrorCode.MediaNotReady);
  }
  if (format === ContentFormat.Story) {
    return media.length === 1 && media.every((item) => isImage(item) || isVideo(item))
      ? { ok: true }
      : refuse(PublishErrorCode.MediaNotReady);
  }
  return refuse(PublishErrorCode.FormatNotSupported);
};

const createContainer = (
  token: string,
  accountId: string,
  params: Record<string, string>,
): Promise<MetaResult<{ id: string }>> =>
  graphPost(`${GRAPH_BASE}/${accountId}/media`, { ...params, access_token: token }, idSchema);

const mediaParams = (media: PublishMedia): Record<string, string> =>
  isVideo(media) ? { video_url: media.url } : { image_url: media.url };

const createCarousel = async (
  token: string,
  accountId: string,
  request: PublishRequest,
): Promise<MetaResult<{ id: string }>> => {
  const children: string[] = [];
  for (const item of request.media) {
    const child = await createContainer(token, accountId, {
      ...mediaParams(item),
      is_carousel_item: "true",
    });
    if (!child.ok) return child;
    children.push(child.data.id);
  }
  return createContainer(token, accountId, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: request.caption,
  });
};

export const startPublication = async (
  token: string,
  accountId: string,
  request: PublishRequest,
): Promise<MetaResult<{ id: string }>> => {
  const first = request.media[0];
  if (first === undefined) {
    return { ok: false, code: PublishErrorCode.MediaNotReady, provider: "empty", transient: false };
  }
  if (request.format === ContentFormat.Carousel) return createCarousel(token, accountId, request);
  if (request.format === ContentFormat.Reel) {
    return createContainer(token, accountId, {
      media_type: "REELS",
      video_url: first.url,
      caption: request.caption,
    });
  }
  if (request.format === ContentFormat.Story) {
    return createContainer(token, accountId, { media_type: "STORIES", ...mediaParams(first) });
  }
  if (isVideo(first)) {
    return createContainer(token, accountId, {
      media_type: "REELS",
      video_url: first.url,
      caption: request.caption,
    });
  }
  return createContainer(token, accountId, { image_url: first.url, caption: request.caption });
};

export const getContainerStatus = async (
  token: string,
  containerId: string,
): Promise<MetaResult<{ status: string }>> => {
  const result = await graphGet(
    `${GRAPH_BASE}/${containerId}`,
    token,
    { fields: "status_code" },
    statusSchema,
  );
  return result.ok ? { ok: true, data: { status: result.data.status_code } } : result;
};

export const publishContainer = (
  token: string,
  accountId: string,
  containerId: string,
): Promise<MetaResult<{ id: string }>> =>
  graphPost(
    `${GRAPH_BASE}/${accountId}/media_publish`,
    { creation_id: containerId, access_token: token },
    idSchema,
  );

export const getPermalink = async (
  token: string,
  mediaId: string,
): Promise<MetaResult<{ permalink: string }>> =>
  graphGet(`${GRAPH_BASE}/${mediaId}`, token, { fields: "permalink" }, permalinkSchema);

export type PublishingQuota = { used: number; total: number | null };

export const getPublishingQuota = async (
  token: string,
  accountId: string,
): Promise<MetaResult<PublishingQuota>> => {
  const result = await graphGet(
    `${GRAPH_BASE}/${accountId}/content_publishing_limit`,
    token,
    { fields: "quota_usage,config" },
    quotaSchema,
  );
  if (!result.ok) return result;
  const first = result.data.data[0];
  return {
    ok: true,
    data: { used: first?.quota_usage ?? 0, total: first?.config?.quota_total ?? null },
  };
};

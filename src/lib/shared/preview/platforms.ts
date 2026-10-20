import { ContentFormat, Platform } from "@/lib/shared/enums";

export type PlatformDescriptor = {
  platform: Platform;
  captionLimit: number | null;
  visibleCaption: number | null;
  handlePrefix: boolean;
};

export const platformDescriptors: Record<Platform, PlatformDescriptor> = {
  [Platform.Instagram]: {
    platform: Platform.Instagram,
    captionLimit: 2200,
    visibleCaption: 125,
    handlePrefix: true,
  },
  [Platform.Facebook]: {
    platform: Platform.Facebook,
    captionLimit: null,
    visibleCaption: null,
    handlePrefix: false,
  },
  [Platform.Linkedin]: {
    platform: Platform.Linkedin,
    captionLimit: 3000,
    visibleCaption: 210,
    handlePrefix: false,
  },
  [Platform.Tiktok]: {
    platform: Platform.Tiktok,
    captionLimit: 2200,
    visibleCaption: null,
    handlePrefix: true,
  },
  [Platform.Youtube]: {
    platform: Platform.Youtube,
    captionLimit: 5000,
    visibleCaption: null,
    handlePrefix: false,
  },
  [Platform.X]: {
    platform: Platform.X,
    captionLimit: 280,
    visibleCaption: null,
    handlePrefix: true,
  },
  [Platform.Pinterest]: {
    platform: Platform.Pinterest,
    captionLimit: 500,
    visibleCaption: null,
    handlePrefix: false,
  },
  [Platform.Threads]: {
    platform: Platform.Threads,
    captionLimit: 500,
    visibleCaption: null,
    handlePrefix: true,
  },
  [Platform.Email]: {
    platform: Platform.Email,
    captionLimit: null,
    visibleCaption: null,
    handlePrefix: false,
  },
  [Platform.Blog]: {
    platform: Platform.Blog,
    captionLimit: null,
    visibleCaption: null,
    handlePrefix: false,
  },
  [Platform.Other]: {
    platform: Platform.Other,
    captionLimit: null,
    visibleCaption: null,
    handlePrefix: false,
  },
};

const allPlatformRatios = (ratio: string): Record<Platform, string> => ({
  [Platform.Instagram]: ratio,
  [Platform.Facebook]: ratio,
  [Platform.Linkedin]: ratio,
  [Platform.Tiktok]: ratio,
  [Platform.Youtube]: ratio,
  [Platform.X]: ratio,
  [Platform.Pinterest]: ratio,
  [Platform.Threads]: ratio,
  [Platform.Email]: ratio,
  [Platform.Blog]: ratio,
  [Platform.Other]: ratio,
});

const mediaAspectRatios: Record<ContentFormat, Record<Platform, string>> = {
  [ContentFormat.Image]: {
    [Platform.Instagram]: "4 / 5",
    [Platform.Facebook]: "1 / 1",
    [Platform.Linkedin]: "4 / 5",
    [Platform.Tiktok]: "9 / 16",
    [Platform.Youtube]: "16 / 9",
    [Platform.X]: "1 / 1",
    [Platform.Pinterest]: "2 / 3",
    [Platform.Threads]: "4 / 5",
    [Platform.Email]: "16 / 9",
    [Platform.Blog]: "16 / 9",
    [Platform.Other]: "1 / 1",
  },
  [ContentFormat.Carousel]: {
    [Platform.Instagram]: "4 / 5",
    [Platform.Facebook]: "1 / 1",
    [Platform.Linkedin]: "4 / 5",
    [Platform.Tiktok]: "9 / 16",
    [Platform.Youtube]: "16 / 9",
    [Platform.X]: "1 / 1",
    [Platform.Pinterest]: "2 / 3",
    [Platform.Threads]: "4 / 5",
    [Platform.Email]: "16 / 9",
    [Platform.Blog]: "16 / 9",
    [Platform.Other]: "1 / 1",
  },
  [ContentFormat.Video]: {
    [Platform.Instagram]: "4 / 5",
    [Platform.Facebook]: "16 / 9",
    [Platform.Linkedin]: "16 / 9",
    [Platform.Tiktok]: "9 / 16",
    [Platform.Youtube]: "16 / 9",
    [Platform.X]: "16 / 9",
    [Platform.Pinterest]: "9 / 16",
    [Platform.Threads]: "4 / 5",
    [Platform.Email]: "16 / 9",
    [Platform.Blog]: "16 / 9",
    [Platform.Other]: "16 / 9",
  },
  [ContentFormat.Text]: {
    [Platform.Instagram]: "4 / 5",
    [Platform.Facebook]: "1 / 1",
    [Platform.Linkedin]: "4 / 5",
    [Platform.Tiktok]: "9 / 16",
    [Platform.Youtube]: "16 / 9",
    [Platform.X]: "1 / 1",
    [Platform.Pinterest]: "2 / 3",
    [Platform.Threads]: "4 / 5",
    [Platform.Email]: "16 / 9",
    [Platform.Blog]: "16 / 9",
    [Platform.Other]: "1 / 1",
  },
  [ContentFormat.Story]: allPlatformRatios("9 / 16"),
  [ContentFormat.Reel]: allPlatformRatios("9 / 16"),
  [ContentFormat.Article]: {
    [Platform.Instagram]: "16 / 9",
    [Platform.Facebook]: "16 / 9",
    [Platform.Linkedin]: "16 / 9",
    [Platform.Tiktok]: "16 / 9",
    [Platform.Youtube]: "16 / 9",
    [Platform.X]: "16 / 9",
    [Platform.Pinterest]: "2 / 3",
    [Platform.Threads]: "16 / 9",
    [Platform.Email]: "16 / 9",
    [Platform.Blog]: "16 / 9",
    [Platform.Other]: "16 / 9",
  },
  [ContentFormat.Other]: {
    [Platform.Instagram]: "1 / 1",
    [Platform.Facebook]: "1 / 1",
    [Platform.Linkedin]: "1 / 1",
    [Platform.Tiktok]: "1 / 1",
    [Platform.Youtube]: "1 / 1",
    [Platform.X]: "1 / 1",
    [Platform.Pinterest]: "2 / 3",
    [Platform.Threads]: "1 / 1",
    [Platform.Email]: "1 / 1",
    [Platform.Blog]: "1 / 1",
    [Platform.Other]: "1 / 1",
  },
};

export const previewAspectRatio = (platform: Platform, format: ContentFormat): string =>
  mediaAspectRatios[format][platform];

export const isImmersivePreview = (platform: Platform, format: ContentFormat): boolean =>
  format === ContentFormat.Story ||
  format === ContentFormat.Reel ||
  ((platform === Platform.Tiktok || platform === Platform.Pinterest) &&
    format === ContentFormat.Video);

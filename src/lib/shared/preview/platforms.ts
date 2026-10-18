import { Platform } from "@/lib/shared/enums";

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

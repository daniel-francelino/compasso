import { z } from "zod";
import { hexColorSchema } from "@/lib/shared/design/schemas";
import { DesignFont, DesignPreset, DesignTextAlign } from "@/lib/shared/design/types";
import { VIDEO_LIMITS, VideoClipKind, VideoFit, VideoStatusFilter } from "@/lib/shared/video/types";

const clipId = z.string().min(1).max(40);
const millis = (min: number, max: number) => z.number().int().min(min).max(max);
const duration = millis(VIDEO_LIMITS.minClipMs, VIDEO_LIMITS.maxDurationMs);
const start = millis(0, VIDEO_LIMITS.maxDurationMs);
const sourceIn = millis(0, VIDEO_LIMITS.maxSourceMs);
const unit = z.number().min(0).max(1);
const coordinate = z.number().min(-VIDEO_LIMITS.maxCoordinate).max(VIDEO_LIMITS.maxCoordinate);
const size = z.number().min(VIDEO_LIMITS.minSize).max(VIDEO_LIMITS.maxSize);

export const mainClipSchema = z.object({
  id: clipId,
  kind: z.nativeEnum(VideoClipKind),
  mediaVersionId: z.string().uuid(),
  durationMs: duration,
  sourceInMs: sourceIn,
  volume: unit,
  fit: z.nativeEnum(VideoFit),
});

export const overlayClipSchema = z.object({
  id: clipId,
  mediaVersionId: z.string().uuid(),
  startMs: start,
  durationMs: duration,
  x: coordinate,
  y: coordinate,
  width: size,
  height: size,
  opacity: unit,
});

export const textClipSchema = z.object({
  id: clipId,
  text: z.string().max(VIDEO_LIMITS.maxText),
  startMs: start,
  durationMs: duration,
  x: coordinate,
  y: coordinate,
  width: size,
  font: z.nativeEnum(DesignFont),
  fontSize: z.number().min(VIDEO_LIMITS.minFontSize).max(VIDEO_LIMITS.maxFontSize),
  bold: z.boolean(),
  italic: z.boolean(),
  color: hexColorSchema,
  align: z.nativeEnum(DesignTextAlign),
  background: hexColorSchema.nullable(),
});

export const audioClipSchema = z.object({
  id: clipId,
  mediaVersionId: z.string().uuid(),
  startMs: start,
  durationMs: duration,
  sourceInMs: sourceIn,
  volume: unit,
  fadeInMs: millis(0, VIDEO_LIMITS.maxAudioFadeMs),
  fadeOutMs: millis(0, VIDEO_LIMITS.maxAudioFadeMs),
});

export const videoDocumentSchema = z
  .object({
    version: z.literal(1),
    background: hexColorSchema,
    fadeInMs: millis(0, VIDEO_LIMITS.maxProjectFadeMs),
    fadeOutMs: millis(0, VIDEO_LIMITS.maxProjectFadeMs),
    main: z.array(mainClipSchema).max(VIDEO_LIMITS.maxMainClips),
    overlays: z.array(overlayClipSchema).max(VIDEO_LIMITS.maxOverlays),
    texts: z.array(textClipSchema).max(VIDEO_LIMITS.maxTexts),
    audio: z.array(audioClipSchema).max(VIDEO_LIMITS.maxAudio),
  })
  .superRefine((document, context) => {
    const ids = [
      ...document.main.map((clip) => clip.id),
      ...document.overlays.map((clip) => clip.id),
      ...document.texts.map((clip) => clip.id),
      ...document.audio.map((clip) => clip.id),
    ];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["main"] });
    }
    const mainTotal = document.main.reduce((total, clip) => total + clip.durationMs, 0);
    const ends = [...document.overlays, ...document.texts, ...document.audio].map(
      (clip) => clip.startMs + clip.durationMs,
    );
    if (Math.max(mainTotal, ...ends) > VIDEO_LIMITS.maxDurationMs) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["main"] });
    }
  });

export type MainClip = z.infer<typeof mainClipSchema>;
export type OverlayClip = z.infer<typeof overlayClipSchema>;
export type TextClip = z.infer<typeof textClipSchema>;
export type AudioClip = z.infer<typeof audioClipSchema>;
export type VideoDocument = z.infer<typeof videoDocumentSchema>;

const projectName = z.string().trim().min(1).max(VIDEO_LIMITS.nameMax);
const expectedVersion = z.number().int().min(1);
const projectId = z.string().uuid();

export const listVideoProjectsSchema = z.object({
  search: z.string().max(100).default(""),
  page: z.number().int().min(1).max(10000).default(1),
  status: z.nativeEnum(VideoStatusFilter).default(VideoStatusFilter.Active),
  brandId: z.string().uuid().optional(),
});

export const videoProjectIdSchema = z.object({ id: projectId });

export const createVideoProjectSchema = z.object({
  brandId: z.string().uuid(),
  name: projectName,
  preset: z.nativeEnum(DesignPreset),
  document: videoDocumentSchema,
});

export const saveVideoProjectDraftSchema = z.object({
  id: projectId,
  document: videoDocumentSchema,
  expectedVersion,
});

export const renameVideoProjectSchema = z.object({
  id: projectId,
  name: projectName,
  expectedVersion,
});

export const saveVideoProjectVersionSchema = z.object({ id: projectId, expectedVersion });

export const setVideoProjectTrashedSchema = z.object({ id: projectId, trashed: z.boolean() });

export const recordVideoExportSchema = z.object({
  id: projectId,
  versionNo: z.number().int().min(1),
  mediaVersionId: z.string().uuid(),
});

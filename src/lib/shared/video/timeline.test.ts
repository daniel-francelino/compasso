import { describe, expect, it } from "vitest";
import { rgbToHex } from "@/lib/shared/design/document";
import { DesignPreset } from "@/lib/shared/design/types";
import { videoDocumentSchema } from "@/lib/shared/video/schemas";
import {
  activeAt,
  addAudioClip,
  addMainClip,
  addTextClip,
  canSplit,
  createAudioClip,
  createMainClip,
  createTextClip,
  emptyVideoDocument,
  fadeLevel,
  formatTimecode,
  frameCount,
  mainStarts,
  mediaVersionIds,
  moveMainClip,
  projectDuration,
  removeClip,
  setClipStart,
  snapValue,
  splitClip,
  trimClip,
} from "@/lib/shared/video/timeline";
import { VIDEO_LIMITS, VideoClipKind, VideoTrack, VideoTrimEdge } from "@/lib/shared/video/types";

const VIDEO_A = "00000000-0000-4000-8000-000000000001";
const VIDEO_B = "00000000-0000-4000-8000-000000000002";
const IMAGE = "00000000-0000-4000-8000-000000000003";
const DARK = rgbToHex(31, 29, 43);
const LIGHT = rgbToHex(250, 250, 250);

const base = () => {
  let document = emptyVideoDocument(DARK);
  document = addMainClip(document, createMainClip("a", VideoClipKind.Video, VIDEO_A, 4000));
  document = addMainClip(document, createMainClip("b", VideoClipKind.Image, IMAGE, 3000));
  document = addMainClip(document, createMainClip("c", VideoClipKind.Video, VIDEO_B, 2000));
  return document;
};

const text = (id: string, startMs: number, durationMs: number) =>
  createTextClip(id, DesignPreset.Story, LIGHT, startMs, durationMs);

describe("timeline", () => {
  it("plays main clips one after the other", () => {
    expect(mainStarts(base())).toEqual([0, 4000, 7000]);
    expect(projectDuration(base())).toBe(9000);
  });

  it("counts the duration of clips that end after the main track", () => {
    expect(projectDuration(addTextClip(base(), text("t", 8000, 5000)))).toBe(13000);
  });

  it("finds the active clips and the time inside the main clip", () => {
    const document = addTextClip(base(), text("t", 4500, 1000));
    const frame = activeAt(document, 5000);
    expect(frame.main?.clip.id).toBe("b");
    expect(frame.main?.localMs).toBe(1000);
    expect(frame.texts.map((clip) => clip.id)).toEqual(["t"]);
    expect(activeAt(document, 9000).main).toBeNull();
  });

  it("splits a main video clip and moves the source point of the second half", () => {
    const document = splitClip(base(), { track: VideoTrack.Main, id: "a" }, 1500, "a2");
    expect(document.main.map((clip) => [clip.id, clip.durationMs, clip.sourceInMs])).toEqual([
      ["a", 1500, 0],
      ["a2", 2500, 1500],
      ["b", 3000, 0],
      ["c", 2000, 0],
    ]);
    expect(projectDuration(document)).toBe(9000);
  });

  it("refuses to split too close to an edge", () => {
    expect(canSplit(base(), { track: VideoTrack.Main, id: "a" }, 50)).toBe(false);
    expect(canSplit(base(), { track: VideoTrack.Main, id: "a" }, 3950)).toBe(false);
  });

  it("splits an audio clip and keeps the fade in on the first half only", () => {
    const clip = { ...createAudioClip("m", VIDEO_A, 1000, 6000), fadeInMs: 500, fadeOutMs: 800 };
    const document = splitClip(
      addAudioClip(base(), clip),
      { track: VideoTrack.Audio, id: "m" },
      3000,
      "m2",
    );
    const [first, second] = document.audio;
    expect(first).toMatchObject({ startMs: 1000, durationMs: 2000, sourceInMs: 0, fadeInMs: 500 });
    expect(second).toMatchObject({
      startMs: 3000,
      durationMs: 4000,
      sourceInMs: 2000,
      fadeInMs: 0,
      fadeOutMs: 800,
    });
  });

  it("trims the start of a main clip by moving its source point", () => {
    const ref = { track: VideoTrack.Main, id: "a" };
    const document = trimClip(base(), ref, VideoTrimEdge.Start, 1000, 10000);
    expect(document.main[0]).toMatchObject({ durationMs: 3000, sourceInMs: 1000 });
  });

  it("never trims the end past the source file", () => {
    const ref = { track: VideoTrack.Main, id: "a" };
    expect(trimClip(base(), ref, VideoTrimEdge.End, 9000, 5000).main[0]?.durationMs).toBe(5000);
  });

  it("never trims the start before the source file", () => {
    const ref = { track: VideoTrack.Main, id: "a" };
    const document = trimClip(base(), ref, VideoTrimEdge.Start, -500, 10000);
    expect(document.main[0]).toMatchObject({ durationMs: 4000, sourceInMs: 0 });
  });

  it("keeps the minimum clip duration when trimming", () => {
    const ref = { track: VideoTrack.Main, id: "c" };
    const document = trimClip(base(), ref, VideoTrimEdge.End, -5000, 10000);
    expect(document.main[2]?.durationMs).toBe(VIDEO_LIMITS.minClipMs);
  });

  it("trims the start of a text clip by moving its start, never before zero", () => {
    const document = addTextClip(base(), text("t", 1000, 2000));
    const ref = { track: VideoTrack.Text, id: "t" };
    const trimmed = trimClip(document, ref, VideoTrimEdge.Start, -3000, null);
    expect(trimmed.texts[0]).toMatchObject({ startMs: 0, durationMs: 3000 });
  });

  it("reorders main clips and ignores moves past the ends", () => {
    expect(moveMainClip(base(), "c", -1).main.map((clip) => clip.id)).toEqual(["a", "c", "b"]);
    expect(moveMainClip(base(), "a", -1)).toEqual(base());
  });

  it("moves a text clip but never before zero, and never moves a main clip", () => {
    const document = addTextClip(base(), text("t", 1000, 2000));
    expect(
      setClipStart(document, { track: VideoTrack.Text, id: "t" }, -400).texts[0]?.startMs,
    ).toBe(0);
    expect(setClipStart(document, { track: VideoTrack.Main, id: "a" }, 500)).toEqual(document);
  });

  it("removes a clip of any track", () => {
    const document = removeClip(base(), { track: VideoTrack.Main, id: "b" });
    expect(document.main.map((clip) => clip.id)).toEqual(["a", "c"]);
  });

  it("fades the picture in and out", () => {
    const document = { ...base(), fadeInMs: 1000, fadeOutMs: 2000 };
    expect(fadeLevel(document, 0, 9000)).toBe(0);
    expect(fadeLevel(document, 500, 9000)).toBe(0.5);
    expect(fadeLevel(document, 5000, 9000)).toBe(1);
    expect(fadeLevel(document, 8000, 9000)).toBe(0.5);
  });

  it("snaps to the nearest target within the threshold", () => {
    expect(snapValue(1040, [0, 1000, 2000], 50)).toBe(1000);
    expect(snapValue(1100, [0, 1000, 2000], 50)).toBe(1100);
  });

  it("counts the frames at 30 fps", () => {
    expect(frameCount(1000)).toBe(30);
    expect(frameCount(90000)).toBe(2700);
  });

  it("formats a timecode", () => {
    expect(formatTimecode(83450)).toBe("1:23.4");
  });

  it("lists every referenced media version once", () => {
    const document = addAudioClip(base(), createAudioClip("m", VIDEO_A, 0, 1000));
    expect(mediaVersionIds(document)).toEqual([VIDEO_A, IMAGE, VIDEO_B]);
  });

  it("accepts a valid document and refuses one longer than 90 seconds", () => {
    expect(videoDocumentSchema.safeParse(base()).success).toBe(true);
    const tooLong = addTextClip(base(), text("t", 89000, 2000));
    expect(videoDocumentSchema.safeParse(tooLong).success).toBe(false);
  });

  it("refuses duplicated clip ids", () => {
    const document = addTextClip(base(), text("a", 0, 1000));
    expect(videoDocumentSchema.safeParse(document).success).toBe(false);
  });
});

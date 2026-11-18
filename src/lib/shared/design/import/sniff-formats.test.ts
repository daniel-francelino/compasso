import { describe, expect, it } from "vitest";
import {
  hasJpegSignature,
  hasPdfHeader,
  hasPngSignature,
  hasPsdSignature,
  hasWebpSignature,
  importBaseName,
} from "@/lib/shared/design/import/sniff";
import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const ascii = (text: string): number[] => Array.from(text, (character) => character.charCodeAt(0));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const riff = (tag: string): Uint8Array =>
  Uint8Array.from([...ascii("RIFF"), 1, 2, 3, 4, ...ascii(tag)]);

describe("format signatures", () => {
  it("each signature detects exactly its own format", () => {
    const heads = {
      png: Uint8Array.from(PNG),
      jpeg: Uint8Array.from(JPEG),
      webp: riff("WEBP"),
      psd: Uint8Array.from(ascii("8BPS")),
      pdf: Uint8Array.from(ascii("%PDF-1.7")),
    };
    const checks = {
      png: hasPngSignature,
      jpeg: hasJpegSignature,
      webp: hasWebpSignature,
      psd: hasPsdSignature,
      pdf: hasPdfHeader,
    };
    for (const [format, check] of Object.entries(checks)) {
      for (const [headFormat, head] of Object.entries(heads)) {
        expect(check(head)).toBe(format === headFormat);
      }
    }
  });

  it("refuses near misses", () => {
    expect(hasWebpSignature(riff("WAVE"))).toBe(false);
    expect(hasWebpSignature(Uint8Array.from(ascii("RIFF")))).toBe(false);
    expect(hasJpegSignature(Uint8Array.from([0xff, 0xd8]))).toBe(false);
    expect(hasPngSignature(Uint8Array.from(PNG.slice(0, 7)))).toBe(false);
    expect(hasPngSignature(Uint8Array.from([...PNG.slice(0, 7), 0x0b]))).toBe(false);
    for (const check of [hasPngSignature, hasJpegSignature, hasWebpSignature, hasPsdSignature]) {
      expect(check(new Uint8Array())).toBe(false);
    }
  });
});

describe("importBaseName hostile names", () => {
  it("caps a 1 MB name at the layer name limit", () => {
    const name = `${"a".repeat(1024 * 1024)}.psd`;
    expect(Array.from(importBaseName(name)).length).toBeLessThanOrEqual(DESIGN_LIMITS.layerNameMax);
  });

  it("strips control and bidi characters and keeps markup as literal text", () => {
    const bidi = String.fromCharCode(0x202e);
    const nul = String.fromCharCode(0);
    const result = importBaseName(`a${bidi}${nul}<img onerror=x>.png`);
    expect(result).toBe("a<img onerror=x>");
  });

  it("keeps a name made only of dots and handles several dots", () => {
    expect(importBaseName("a.b.psd")).toBe("a.b");
    expect(importBaseName("")).toBe("");
  });
});

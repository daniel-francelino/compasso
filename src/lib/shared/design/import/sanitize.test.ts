import { describe, expect, it } from "vitest";
import { sanitizeImportName, sanitizeImportText } from "@/lib/shared/design/import/sanitize";

const BIDI = String.fromCharCode(0x202e);
const NUL = String.fromCharCode(0);
const NL = String.fromCharCode(10);
const ZERO_WIDTH = String.fromCharCode(0x200b);
const EMOJI = String.fromCodePoint(0x1f600);

describe("sanitizeImportName", () => {
  it("strips control, bidi and zero-width characters and keeps markup literal", () => {
    const raw = "  a" + BIDI + "b" + NUL + "c" + NL + "d" + ZERO_WIDTH + "e<b>";
    expect(sanitizeImportName(raw)).toBe("abcde<b>");
  });

  it("caps on code points without cutting a surrogate pair", () => {
    const name = sanitizeImportName(EMOJI.repeat(100));
    expect(Array.from(name)).toHaveLength(80);
    expect(name).not.toMatch(/\p{Cs}/u);
  });

  it("strips the other format characters, tag characters, separators and private use", () => {
    const hidden = [0xad, 0x180e, 0x2061, 0x206a, 0xfff9, 0x2028, 0x2029, 0xe000, 0xe0041, 0x200d];
    const raw = "a" + hidden.map((code) => String.fromCodePoint(code)).join("b") + "z";
    expect(sanitizeImportName(raw)).toBe("a" + "b".repeat(hidden.length - 1) + "z");
  });

  it("cuts a very large raw string before normalizing", () => {
    const name = sanitizeImportName("x".repeat(5_000_000));
    expect(name).toHaveLength(80);
  });

  it("returns an empty string for hidden-only input", () => {
    expect(sanitizeImportName(BIDI + NUL)).toBe("");
  });
});

describe("sanitizer idempotence", () => {
  const JOINER = String.fromCodePoint(0x200d);
  const ACUTE = String.fromCodePoint(0x0301);
  const samples = [
    "e" + JOINER + ACUTE,
    "  e" + JOINER + ACUTE + JOINER + ACUTE + "  ",
    "a" + ZERO_WIDTH + ACUTE + EMOJI + NL + "b",
    EMOJI.repeat(300) + ACUTE,
    "x".repeat(79) + "e" + JOINER + ACUTE,
  ];

  it("returns a stable name for every sample (sanitize twice equals once)", () => {
    for (const sample of samples) {
      const once = sanitizeImportName(sample);
      expect(sanitizeImportName(once)).toBe(once);
    }
  });

  it("returns a stable text for every sample", () => {
    for (const sample of samples) {
      const once = sanitizeImportText(sample, 50);
      expect(sanitizeImportText(once, 50)).toBe(once);
    }
  });

  it("composes the mark that a removed format character separated", () => {
    expect(sanitizeImportName("e" + JOINER + ACUTE)).toBe(String.fromCodePoint(0xe9));
  });
});

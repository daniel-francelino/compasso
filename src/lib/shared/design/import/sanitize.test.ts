import { describe, expect, it } from "vitest";
import { sanitizeImportName } from "@/lib/shared/design/import/sanitize";

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

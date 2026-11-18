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

  it("returns an empty string for hidden-only input", () => {
    expect(sanitizeImportName(BIDI + NUL)).toBe("");
  });
});

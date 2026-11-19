import { describe, expect, it } from "vitest";
import { appendBrandColors } from "@/lib/shared/design/brand-colors-merge";

describe("appendBrandColors", () => {
  it("keeps extra per-color fields and unrelated identity fields, appending only the new colors", () => {
    const stored = {
      palette_note: "keep me",
      fonts: ["Inter"],
      colors: [{ name: "Azul", hex: "#0000ff", role: "primary", extra: { n: 1 } }],
    };
    const out = appendBrandColors(stored, [{ name: "Rosa", hex: "#ff00ff" }]);
    expect(out).toEqual({
      palette_note: "keep me",
      fonts: ["Inter"],
      colors: [
        { name: "Azul", hex: "#0000ff", role: "primary", extra: { n: 1 } },
        { name: "Rosa", hex: "#ff00ff" },
      ],
    });
    expect(stored.colors).toHaveLength(1);
  });

  it("starts from an empty list when the stored value has no usable colors", () => {
    expect(appendBrandColors(null, [{ name: "A", hex: "#000000" }])).toEqual({
      colors: [{ name: "A", hex: "#000000" }],
    });
    expect(appendBrandColors([1], [{ name: "A", hex: "#000000" }])).toEqual({
      colors: [{ name: "A", hex: "#000000" }],
    });
  });
});

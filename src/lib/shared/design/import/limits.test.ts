import { describe, expect, it } from "vitest";
import { sizeFitsPage } from "@/lib/shared/design/import/limits";

const TOO_LARGE =
  "A tela do arquivo passa de 4096 px em um dos lados. Reduza o tamanho e tente de novo.";
const TOO_SMALL = `A tela do arquivo ${String.fromCharCode(0xe9)} menor que 64 px. Use um arquivo maior.`;

const messageOf = (width: number, height: number): string | null => {
  const result = sizeFitsPage(width, height);
  return result.ok ? null : result.message;
};

describe("sizeFitsPage", () => {
  it("accepts sizes inside the limits and exactly on them", () => {
    for (const [width, height] of [
      [1080, 1350],
      [64, 4096],
      [4096, 64],
      [64, 64],
      [4096, 4096],
    ] as const) {
      expect(messageOf(width, height)).toBeNull();
    }
  });

  it.each([
    [4097, 100],
    [100, 4097],
    [4097, 4097],
  ])("refuses %i x %i as too large with the literal text", (width, height) => {
    expect(messageOf(width, height)).toBe(TOO_LARGE);
  });

  it.each([
    [63, 100],
    [100, 63],
    [63, 63],
  ])("refuses %i x %i as too small with the literal text", (width, height) => {
    expect(messageOf(width, height)).toBe(TOO_SMALL);
  });

  it("reports too large before too small when both apply", () => {
    expect(messageOf(4097, 63)).toBe(TOO_LARGE);
  });
});

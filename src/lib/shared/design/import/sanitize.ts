import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const CONTROL_OR_SURROGATE = /^[\p{Cc}\p{Cs}]$/u;

const HIDDEN_RANGES: readonly (readonly [number, number])[] = [
  [0x061c, 0x061c],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2060],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
];

const isUnsafe = (character: string): boolean => {
  if (CONTROL_OR_SURROGATE.test(character)) return true;
  const code = character.codePointAt(0) ?? 0;
  return HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);
};

export const sanitizeImportName = (raw: string, maxLength = DESIGN_LIMITS.layerNameMax): string =>
  Array.from(raw.normalize("NFC"))
    .filter((character) => !isUnsafe(character))
    .slice(0, maxLength)
    .join("")
    .trim();

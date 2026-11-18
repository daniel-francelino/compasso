import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const UNSAFE_CHARACTER = /^[\p{Cc}\p{Cs}\p{Cf}\p{Zl}\p{Zp}\p{Co}]$/u;

const TAG_FROM = 0xe0000;
const TAG_TO = 0xe007f;
const RAW_FACTOR = 4;

const isUnsafe = (character: string): boolean => {
  if (UNSAFE_CHARACTER.test(character)) return true;
  const code = character.codePointAt(0) ?? 0;
  return code >= TAG_FROM && code <= TAG_TO;
};

const cutCodePoints = (raw: string, limit: number): string => {
  const kept: string[] = [];
  for (const character of raw) {
    if (kept.length >= limit) break;
    kept.push(character);
  }
  return kept.join("");
};

export const sanitizeImportName = (raw: string, maxLength = DESIGN_LIMITS.layerNameMax): string =>
  Array.from(cutCodePoints(raw, maxLength * RAW_FACTOR).normalize("NFC"))
    .filter((character) => !isUnsafe(character))
    .slice(0, maxLength)
    .join("")
    .trim();

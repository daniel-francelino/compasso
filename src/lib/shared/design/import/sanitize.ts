import { DESIGN_LIMITS } from "@/lib/shared/design/types";

const UNSAFE_CHARACTER = /^[\p{Cc}\p{Cs}\p{Cf}\p{Zl}\p{Zp}\p{Co}]$/u;

const TAG_FROM = 0xe0000;
const TAG_TO = 0xe007f;
const RAW_FACTOR = 4;
const NEWLINE = "\n";
const CARRIAGE_RETURN = String.fromCharCode(13);

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

const unifyLineBreaks = (raw: string): string =>
  raw
    .split(CARRIAGE_RETURN + NEWLINE)
    .join(NEWLINE)
    .split(CARRIAGE_RETURN)
    .join(NEWLINE);

const cleanCodePoints = (raw: string, maxLength: number, keepNewline: boolean): string =>
  Array.from(
    cutCodePoints(keepNewline ? unifyLineBreaks(raw) : raw, maxLength * RAW_FACTOR).normalize(
      "NFC",
    ),
  )
    .filter((character) => (keepNewline && character === NEWLINE) || !isUnsafe(character))
    .slice(0, maxLength)
    .join("");

export const sanitizeImportName = (
  raw: string,
  maxLength: number = DESIGN_LIMITS.layerNameMax,
): string => cleanCodePoints(raw, maxLength, false).trim();

export const sanitizeImportText = (raw: string, maxLength: number): string =>
  cleanCodePoints(raw, maxLength, true);

export const countCodePoints = (value: string): number => {
  let count = 0;
  for (const character of value) {
    if (character.length > 0) count += 1;
  }
  return count;
};

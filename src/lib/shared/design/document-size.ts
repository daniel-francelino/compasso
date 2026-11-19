import type { DesignDocument } from "@/lib/shared/design/schemas";

const encoder = new TextEncoder();
const EXPONENT_NUMBER = /(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)/g;

const outsideStrings = (json: string): string => {
  let kept = "";
  let inString = false;
  let escaped = false;
  for (const char of json) {
    kept += inString ? "" : char;
    const closes: boolean = inString && !escaped && char === '"';
    const opens: boolean = !inString && char === '"';
    escaped = inString && !escaped && char === "\\";
    inString = opens || (inString && !closes);
  }
  return kept;
};

const expandedExtra = (match: string, sign: string, whole: string, fraction = "", exp = "0") => {
  const digits = whole.length + fraction.length;
  const expanded = sign.length + Math.abs(Number(exp)) + digits + 2;
  return Math.max(0, expanded - match.length);
};

const exponentExtra = (outside: string): number => {
  let extra = 0;
  outside.replace(EXPONENT_NUMBER, (match, sign, whole, fraction, exp) => {
    extra += expandedExtra(match, sign, whole, fraction, exp);
    return match;
  });
  return extra;
};

export const databaseDocumentBytes = (document: DesignDocument): number => {
  const json = JSON.stringify(document);
  const outside = outsideStrings(json);
  const separators = (outside.match(/[,:]/g) ?? []).length;
  return encoder.encode(json).length + separators + exponentExtra(outside);
};

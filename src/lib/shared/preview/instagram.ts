export const INSTAGRAM_CAROUSEL_MAX_ITEMS = 20;

export const INSTAGRAM_REEL_MAX_REM = 20;
export const INSTAGRAM_STORY_MAX_REM = 18;

export const FALLBACK_LOGO_PERCENT = 30;

export const instagramCaptionRule = {
  visibleCharacters: 125,
  visibleLines: 2,
} as const;

export const instagramSafeZones = {
  story: { topPercent: 14, bottomPercent: 18 },
  reel: { bottomPercent: 22, rightPercent: 16 },
} as const;

export const CaptionTokenKind = {
  Text: "text",
  Tag: "tag",
} as const;
export type CaptionTokenKind = (typeof CaptionTokenKind)[keyof typeof CaptionTokenKind];

export type CaptionToken = { kind: CaptionTokenKind; text: string };

const TAG_PATTERN = /([#@][\p{L}\p{N}_.]*[\p{L}\p{N}_])/gu;

export const collapseInstagramCaption = (caption: string): { text: string; truncated: boolean } => {
  const lines = caption
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");
  const joined = lines.join("\n");
  const truncated =
    lines.length > instagramCaptionRule.visibleLines ||
    joined.length > instagramCaptionRule.visibleCharacters;
  if (!truncated) return { text: joined, truncated: false };
  const visible = lines.slice(0, instagramCaptionRule.visibleLines).join("\n");
  return { text: visible.slice(0, instagramCaptionRule.visibleCharacters).trimEnd(), truncated };
};

export const tokenizeCaption = (text: string): CaptionToken[] =>
  text
    .split(TAG_PATTERN)
    .filter((part) => part !== "")
    .map((part) => ({
      kind: /^[#@]/u.test(part) ? CaptionTokenKind.Tag : CaptionTokenKind.Text,
      text: part,
    }));

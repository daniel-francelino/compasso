import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import type { ImportKindResult } from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const TOO_LARGE_PREFIX = DESIGN_IMPORT_MESSAGE.imageTooLarge(0, 0).split(" (")[0] ?? "";

export const MAX_DECLARED_PIXELS = 67_108_864;

export const declaredPixelsFit = (width: number, height: number): boolean =>
  width * height <= MAX_DECLARED_PIXELS;

export const remapImageFailure = (
  result: Result<ImportKindResult>,
  messages: { corrupt: string; tooLarge: string },
): Result<ImportKindResult> => {
  if (result.ok) return result;
  if (result.message === DESIGN_IMPORT_MESSAGE.imageCorrupt) return invalid(messages.corrupt);
  if (result.message.startsWith(TOO_LARGE_PREFIX)) {
    return invalid(messages.tooLarge);
  }
  return result;
};

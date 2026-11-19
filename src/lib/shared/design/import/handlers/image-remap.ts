import { failureReason } from "@/lib/shared/design/import/refusal";
import { DesignImportFailure, type ImportKindResult } from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

export const MAX_DECLARED_PIXELS = 67_108_864;

export const declaredPixelsFit = (width: number, height: number): boolean =>
  width * height <= MAX_DECLARED_PIXELS;

export const remapImageFailure = (
  result: Result<ImportKindResult>,
  messages: { corrupt: string; tooLarge: string },
): Result<ImportKindResult> => {
  if (result.ok) return result;
  const coded = failureReason(result, DesignImportFailure);
  if (coded?.reason === DesignImportFailure.Corrupt) return invalid(messages.corrupt);
  if (coded?.reason === DesignImportFailure.ImageTooLarge) return invalid(messages.tooLarge);
  return result;
};

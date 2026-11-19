import { decodeWithHeader } from "@/lib/shared/design/import/handlers/image";
import { readGifInfo } from "@/lib/shared/design/import/handlers/gif-header";
import {
  declaredPixelsFit,
  remapImageFailure,
} from "@/lib/shared/design/import/handlers/image-remap";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { hasGifSignature } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
  type ImportInput,
  type ImportKindResult,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const MAX_GIF_BYTES = 50 * 1024 * 1024;

const decodeGif = async (input: ImportInput): Promise<Result<ImportKindResult>> => {
  const info = readGifInfo(input.bytes);
  if (info === null) return invalid(DESIGN_IMPORT_MESSAGE.gifCorrupt);
  const fits =
    declaredPixelsFit(info.width, info.height) &&
    declaredPixelsFit(info.extentWidth, info.extentHeight);
  if (!fits) {
    return invalid(DESIGN_IMPORT_MESSAGE.gifTooLarge);
  }
  const decoded = await decodeWithHeader(DesignImportFormat.Gif, input, {
    width: info.width,
    height: info.height,
    orientation: 1,
    orientationKnown: true,
    animated: info.frames > 1,
  });
  return remapImageFailure(decoded, {
    corrupt: DESIGN_IMPORT_MESSAGE.gifCorrupt,
    tooLarge: DESIGN_IMPORT_MESSAGE.gifTooLarge,
  });
};

export const gifHandler: ImportHandler = {
  format: DesignImportFormat.Gif,
  kind: DesignImportKind.Image,
  extensions: ["gif"],
  maxBytes: MAX_GIF_BYTES,
  runsIn: "main",
  sniff: hasGifSignature,
  decode: decodeGif,
};

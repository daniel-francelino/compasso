import { readAvifInfo } from "@/lib/shared/design/import/handlers/avif-header";
import { decodeWithHeader } from "@/lib/shared/design/import/handlers/image";
import {
  MAX_DECLARED_PIXELS,
  declaredPixelsFit,
  remapImageFailure,
} from "@/lib/shared/design/import/handlers/image-remap";
import { failureReason } from "@/lib/shared/design/import/refusal";
import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { hasAvifSignature } from "@/lib/shared/design/import/sniff";
import {
  DesignImportFailure,
  DesignImportFormat,
  DesignImportKind,
  type ImportHandler,
  type ImportInput,
  type ImportKindResult,
} from "@/lib/shared/design/import/types";
import { type Result, invalid } from "@/lib/shared/server-utils";

const MAX_AVIF_BYTES = 50 * 1024 * 1024;
const HEADER_WINDOW_BYTES = 1024 * 1024;
const PROBE_BASE64 =
  "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";

let support: Promise<boolean> | null = null;

const probeBytes = (): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(globalThis.atob(PROBE_BASE64), (character) => character.charCodeAt(0));

const browserOpensAvif = (): Promise<boolean> => {
  support ??= (async () => {
    try {
      const bitmap = await createImageBitmap(new Blob([probeBytes()], { type: "image/avif" }));
      bitmap.close();
      return true;
    } catch {
      return false;
    }
  })();
  return support;
};

export const resetAvifSupportProbe = (): void => {
  support = null;
};

const decodeAvif = async (input: ImportInput): Promise<Result<ImportKindResult>> => {
  const info = readAvifInfo(input.bytes);
  if (info === null) return invalid(DESIGN_IMPORT_MESSAGE.avifCorrupt);
  if (info.largestPixels > MAX_DECLARED_PIXELS || !declaredPixelsFit(info.width, info.height)) {
    return invalid(DESIGN_IMPORT_MESSAGE.avifTooLarge);
  }
  if (info.ambiguous) return invalid(DESIGN_IMPORT_MESSAGE.avifCorrupt);
  const decoded = await decodeWithHeader(DesignImportFormat.Avif, input, {
    width: info.width,
    height: info.height,
    orientation: 1,
    orientationKnown: false,
    animated: info.animated,
  });
  const mapped = remapImageFailure(decoded, {
    corrupt: DESIGN_IMPORT_MESSAGE.avifCorrupt,
    tooLarge: DESIGN_IMPORT_MESSAGE.avifTooLarge,
  });
  const reason = decoded.ok ? null : failureReason(decoded, DesignImportFailure)?.reason;
  if (mapped.ok || reason !== DesignImportFailure.Corrupt) return mapped;
  return (await browserOpensAvif()) ? mapped : invalid(DESIGN_IMPORT_MESSAGE.avifUnsupported);
};

export const avifHandler: ImportHandler = {
  format: DesignImportFormat.Avif,
  kind: DesignImportKind.Image,
  extensions: ["avif"],
  maxBytes: MAX_AVIF_BYTES,
  runsIn: "main",
  headBytes: HEADER_WINDOW_BYTES,
  sniff: hasAvifSignature,
  decode: decodeAvif,
};

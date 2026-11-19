import { DESIGN_IMPORT_MESSAGE } from "@/lib/shared/design/import/messages";
import { DesignImportFailure, SketchRefusal } from "@/lib/shared/design/import/types";
import { type Failure, invalid } from "@/lib/shared/server-utils";

export type CodedFailure<Reason extends string> = Failure & {
  reason: Reason;
  args: readonly number[];
};

export const codedFailure = <Reason extends string>(
  reason: Reason,
  message: string,
  args: readonly number[] = [],
): CodedFailure<Reason> => ({ ...invalid(message), reason, args });

export const failureReason = <Reason extends string>(
  failure: Failure,
  registry: Readonly<Record<string, Reason>>,
): { reason: Reason; args: number[] } | null => {
  if (!("reason" in failure)) return null;
  const reason = Object.values(registry).find((value) => value === failure.reason);
  if (reason === undefined) return null;
  const args = "args" in failure && Array.isArray(failure.args) ? failure.args : [];
  return { reason, args: args.filter((arg): arg is number => typeof arg === "number") };
};

export const sketchRefusalMessage = (refusal: SketchRefusal, args: readonly number[]): string => {
  switch (refusal) {
    case SketchRefusal.NotZip:
      return DESIGN_IMPORT_MESSAGE.sketchNotZip;
    case SketchRefusal.UnsupportedVersion:
      return DESIGN_IMPORT_MESSAGE.sketchUnsupportedVersion;
    case SketchRefusal.NoArtboards:
      return DESIGN_IMPORT_MESSAGE.sketchNoArtboards;
    case SketchRefusal.NoLayers:
      return DESIGN_IMPORT_MESSAGE.noLayers;
    case SketchRefusal.Memory:
      return DESIGN_IMPORT_MESSAGE.memory;
    case SketchRefusal.LayerTooLarge:
      return DESIGN_IMPORT_MESSAGE.layerTooLarge;
    case SketchRefusal.TimedOut:
      return DESIGN_IMPORT_MESSAGE.timedOut;
    case SketchRefusal.ReadFailed:
      return DESIGN_IMPORT_MESSAGE.readFailed;
    case SketchRefusal.Encrypted:
      return DESIGN_IMPORT_MESSAGE.encrypted;
    case SketchRefusal.ZipEntries:
      return DESIGN_IMPORT_MESSAGE.zipTooManyEntries;
    case SketchRefusal.ZipTooLarge:
      return DESIGN_IMPORT_MESSAGE.zipTooLarge;
    case SketchRefusal.ZipRatio:
      return DESIGN_IMPORT_MESSAGE.zipRatioExceeded;
    case SketchRefusal.ZipPath:
      return DESIGN_IMPORT_MESSAGE.zipUnsafePath;
    case SketchRefusal.CanvasTooLarge:
      return DESIGN_IMPORT_MESSAGE.canvasTooLarge(args[0] ?? 0);
    case SketchRefusal.CanvasTooSmall:
      return DESIGN_IMPORT_MESSAGE.canvasTooSmall(args[0] ?? 0);
    case SketchRefusal.TooManyLayers:
      return DESIGN_IMPORT_MESSAGE.tooManyLayers(args[0] ?? 0);
    case SketchRefusal.ImageTooLarge:
      return DESIGN_IMPORT_MESSAGE.imageTooLarge(args[0] ?? 0, args[1] ?? 0);
    case SketchRefusal.Corrupt:
      return DESIGN_IMPORT_MESSAGE.sketchCorrupt;
  }
};

export const sketchFailure = (
  refusal: SketchRefusal,
  args: readonly number[] = [],
): CodedFailure<SketchRefusal> => codedFailure(refusal, sketchRefusalMessage(refusal, args), args);

export const imageCorruptFailure = (): CodedFailure<DesignImportFailure> =>
  codedFailure(DesignImportFailure.Corrupt, DESIGN_IMPORT_MESSAGE.imageCorrupt);

export const imageTooLargeFailure = (
  width: number,
  height: number,
): CodedFailure<DesignImportFailure> =>
  codedFailure(
    DesignImportFailure.ImageTooLarge,
    DESIGN_IMPORT_MESSAGE.imageTooLarge(width, height),
    [width, height],
  );

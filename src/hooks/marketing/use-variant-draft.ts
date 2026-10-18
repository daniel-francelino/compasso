import { useState } from "react";
import type { FileItem, VariantDetail } from "@/lib/marketing/content/types";
import type { ContentFormat } from "@/lib/shared/enums";

const filesOf = (variant: VariantDetail): FileItem[] =>
  variant.media.map((file) => ({
    mediaVersionId: file.mediaVersionId,
    altText: file.altText ?? "",
    name: file.name,
    kind: file.kind,
  }));

const sameFiles = (left: FileItem[], right: FileItem[]): boolean =>
  left.length === right.length &&
  left.every(
    (file, index) =>
      file.mediaVersionId === right[index]?.mediaVersionId &&
      file.altText === right[index]?.altText,
  );

export const useVariantDraft = (variant: VariantDetail) => {
  const [format, setFormat] = useState<ContentFormat>(variant.format);
  const [caption, setCaption] = useState(variant.caption);
  const [callToAction, setCallToAction] = useState(variant.callToAction ?? "");
  const [files, setFiles] = useState<FileItem[]>(() => filesOf(variant));
  const [plannedAt, setPlannedAt] = useState<string | null>(variant.plannedAt);

  const dirty =
    format !== variant.format ||
    caption !== variant.caption ||
    callToAction !== (variant.callToAction ?? "") ||
    plannedAt !== variant.plannedAt ||
    !sameFiles(files, filesOf(variant));

  return {
    format,
    setFormat,
    caption,
    setCaption,
    callToAction,
    setCallToAction,
    files,
    setFiles,
    plannedAt,
    setPlannedAt,
    dirty,
  };
};

export type VariantDraft = ReturnType<typeof useVariantDraft>;

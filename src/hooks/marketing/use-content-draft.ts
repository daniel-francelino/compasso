import { useRef, useState } from "react";
import type { ContentDetail, FileItem } from "@/lib/marketing/content/types";
import type { ContentFormat, ContentObjective } from "@/lib/shared/enums";
import type { RichDoc } from "@/lib/shared/rich-text/types";

export type DraftRow = {
  key: string;
  id: string | undefined;
  channelId: string;
  format: ContentFormat;
  caption: string;
  plannedAt: string | null;
  plannedTimezone: string | null;
  published: boolean;
  version: number | undefined;
};

export type DraftValues = {
  brandId: string;
  title: string;
  objectiveKind: ContentObjective | null;
  objective: string;
  briefing: RichDoc | null;
  internalNotes: string;
  assigneeId: string | null;
  tags: string[];
  productionDueDate: string | null;
  planSummary: string;
  planFiles: FileItem[];
  caption: string;
  callToAction: string;
  files: FileItem[];
  rows: DraftRow[];
};

export const emptyDraft = (brandId: string): DraftValues => ({
  brandId,
  title: "",
  objectiveKind: null,
  objective: "",
  briefing: null,
  internalNotes: "",
  assigneeId: null,
  tags: [],
  productionDueDate: null,
  planSummary: "",
  planFiles: [],
  caption: "",
  callToAction: "",
  files: [],
  rows: [],
});

export const draftOf = (content: ContentDetail): DraftValues => ({
  brandId: content.brandId,
  title: content.title,
  objectiveKind: content.objectiveKind,
  objective: content.objective ?? "",
  briefing: content.briefing,
  internalNotes: content.internalNotes ?? "",
  assigneeId: content.assigneeId,
  tags: content.tags,
  productionDueDate: content.productionDueDate,
  planSummary: content.planSummary ?? "",
  planFiles: content.planMedia.map((file) => ({
    mediaVersionId: file.mediaVersionId,
    altText: file.altText ?? "",
    name: file.name,
    kind: file.kind,
  })),
  caption: content.caption,
  callToAction: content.callToAction ?? "",
  files: content.media.map((file) => ({
    mediaVersionId: file.mediaVersionId,
    altText: file.altText ?? "",
    name: file.name,
    kind: file.kind,
  })),
  rows: content.channels.map((channel) => ({
    key: channel.id,
    id: channel.id,
    channelId: channel.channelId,
    format: channel.format,
    caption: channel.caption,
    plannedAt: channel.plannedAt,
    plannedTimezone: channel.plannedTimezone,
    published: channel.published !== null,
    version: channel.version,
  })),
});

const signature = (values: DraftValues): string =>
  JSON.stringify({
    ...values,
    rows: values.rows.map((row) => ({ ...row, key: row.id ?? "" })),
  });

export const useContentDraft = (initial: DraftValues) => {
  const [values, setValues] = useState<DraftValues>(initial);
  const baseline = useRef(signature(initial));
  const counter = useRef(0);

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const nextKey = (): string => {
    counter.current += 1;
    return `new-${counter.current}`;
  };

  const markSaved = () => {
    baseline.current = signature(values);
  };

  return {
    values,
    set,
    nextKey,
    markSaved,
    dirty: signature(values) !== baseline.current,
  };
};

export type ContentDraft = ReturnType<typeof useContentDraft>;

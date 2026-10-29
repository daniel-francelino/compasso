import { useRef, useState } from "react";
import { withPlanImages } from "@/lib/marketing/content/plan-images";
import type { ContentDetail, FileItem } from "@/lib/marketing/content/types";
import type { ContentFormat } from "@/lib/shared/enums";
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
  internalNotes: string;
  assigneeId: string | null;
  typeIds: string[];
  publishDate: string | null;
  planSummary: RichDoc | null;
  caption: string;
  callToAction: string;
  files: FileItem[];
  rows: DraftRow[];
};

export const emptyDraft = (brandId: string): DraftValues => ({
  brandId,
  title: "",
  internalNotes: "",
  assigneeId: null,
  typeIds: [],
  publishDate: null,
  planSummary: null,
  caption: "",
  callToAction: "",
  files: [],
  rows: [],
});

export const draftOf = (content: ContentDetail): DraftValues => ({
  brandId: content.brandId,
  title: content.title,
  internalNotes: content.internalNotes ?? "",
  assigneeId: content.assigneeId,
  typeIds: content.types.map((type) => type.id),
  publishDate: content.publishDate,
  planSummary: withPlanImages(content.planSummary, content.planMedia),
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
  const baseline = useRef(initial);
  const counter = useRef(0);

  const set = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const setAutomatic = <K extends keyof DraftValues>(key: K, value: DraftValues[K]) => {
    baseline.current = { ...baseline.current, [key]: value };
    setValues((current) => ({ ...current, [key]: value }));
  };

  const nextKey = (): string => {
    counter.current += 1;
    return `new-${counter.current}`;
  };

  const markSaved = () => {
    baseline.current = values;
  };

  return {
    values,
    set,
    setAutomatic,
    nextKey,
    markSaved,
    dirty: signature(values) !== signature(baseline.current),
  };
};

export type ContentDraft = ReturnType<typeof useContentDraft>;

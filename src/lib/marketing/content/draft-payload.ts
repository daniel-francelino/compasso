import type { DraftValues } from "@/hooks/marketing/use-content-draft";

export const draftPayload = (
  values: DraftValues,
  zone: string,
  options: {
    contentId: string | undefined;
    sourceNote: string | undefined;
    expectedVersion: number | undefined;
  },
) => ({
  ...(options.contentId === undefined ? {} : { id: options.contentId }),
  brandId: values.brandId,
  title: values.title,
  internalNotes: values.internalNotes,
  assigneeId: values.assigneeId,
  typeIds: values.typeIds,
  publishDate: values.publishDate,
  planSummary: values.planSummary,
  caption: values.caption,
  callToAction: values.callToAction,
  media: values.files.map((file) => ({
    mediaVersionId: file.mediaVersionId,
    altText: file.altText,
  })),
  channels: values.rows.map((row) => ({
    ...(row.id === undefined ? {} : { id: row.id }),
    channelId: row.channelId,
    format: row.format,
    caption: row.caption,
    plannedAt: row.plannedAt,
    plannedTimezone: row.plannedAt === null ? null : (row.plannedTimezone ?? zone),
  })),
  ...(options.sourceNote === undefined || options.contentId !== undefined
    ? {}
    : { sourceNote: options.sourceNote }),
  ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
});

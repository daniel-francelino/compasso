import type { PortalRequest } from "@/lib/portal/approvals/types";
import type { ContentFormat, Platform } from "@/lib/shared/enums";
import { ApprovalStage } from "@/lib/shared/enums";
import { previewAspectRatio } from "@/lib/shared/preview/platforms";

export const BENTO_MIN_COLUMN = 340;
export const BENTO_MAX_COLUMNS = 3;
export const BENTO_GAP = 12;

const PREVIEW_MAX_WIDTH = 384;
const CARD_PADDING = 32;
const CARD_CHROME = 150;
const CHANNEL_TABS = 44;
const DATE_PILL = 40;
const PREVIEW_HEADER = 64;
const PREVIEW_CAPTION = 72;
const PLAN_ROW = 40;
const PLAN_SUMMARY = 96;
const FALLBACK_RATIO = 1;

export const parseRatio = (value: string): number => {
  const [width, height] = value.split("/").map((part) => Number(part.trim()));
  if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
    return FALLBACK_RATIO;
  }
  return width / height;
};

export const columnCountFor = (width: number): number =>
  Math.max(
    1,
    Math.min(BENTO_MAX_COLUMNS, Math.floor((width + BENTO_GAP) / (BENTO_MIN_COLUMN + BENTO_GAP))),
  );

export const columnWidthFor = (width: number, columns: number): number =>
  columns === 0 ? width : (width - BENTO_GAP * (columns - 1)) / columns;

const tallestPreviewRatio = (request: PortalRequest): number =>
  Math.min(
    ...request.channels.map((channel) =>
      parseRatio(previewAspectRatio(channel.platform as Platform, channel.format as ContentFormat)),
    ),
    FALLBACK_RATIO * 10,
  );

export const estimateCardHeight = (request: PortalRequest, columnWidth: number): number => {
  if (request.stage === ApprovalStage.Plan) {
    const summary = request.planSummary === null ? 0 : PLAN_SUMMARY;
    return CARD_CHROME + summary + request.channels.length * PLAN_ROW;
  }
  const previewWidth = Math.min(PREVIEW_MAX_WIDTH, Math.max(columnWidth - CARD_PADDING, 0));
  const tabs = request.channels.length > 1 ? CHANNEL_TABS : 0;
  const media = previewWidth / tallestPreviewRatio(request);
  return CARD_CHROME + tabs + DATE_PILL + PREVIEW_HEADER + media + PREVIEW_CAPTION;
};

export const packBento = <T>(
  items: readonly T[],
  columns: number,
  heightOf: (item: T) => number,
): T[][] => {
  const count = Math.max(1, columns);
  const lanes: T[][] = Array.from({ length: count }, () => []);
  const heights: number[] = Array.from({ length: count }, () => 0);
  for (const item of items) {
    const target = heights.indexOf(Math.min(...heights));
    lanes[target]?.push(item);
    heights[target] = (heights[target] ?? 0) + heightOf(item) + BENTO_GAP;
  }
  return lanes;
};

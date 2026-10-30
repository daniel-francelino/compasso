import { ApprovalStage, ContentFormat, EditorialStatus, Platform } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";

export const EditorialTransitions: Record<EditorialStatus, readonly EditorialStatus[]> = {
  [EditorialStatus.Planning]: [
    EditorialStatus.InProduction,
    EditorialStatus.AwaitingApproval,
    EditorialStatus.Approved,
    EditorialStatus.Cancelled,
  ],
  [EditorialStatus.InProduction]: [
    EditorialStatus.Planning,
    EditorialStatus.AwaitingApproval,
    EditorialStatus.Approved,
    EditorialStatus.Cancelled,
  ],
  [EditorialStatus.ChangesRequested]: [
    EditorialStatus.Planning,
    EditorialStatus.InProduction,
    EditorialStatus.AwaitingApproval,
    EditorialStatus.Approved,
    EditorialStatus.Cancelled,
  ],
  [EditorialStatus.AwaitingApproval]: [
    EditorialStatus.Planning,
    EditorialStatus.InProduction,
    EditorialStatus.Approved,
    EditorialStatus.ChangesRequested,
    EditorialStatus.Cancelled,
  ],
  [EditorialStatus.Approved]: [
    EditorialStatus.Planning,
    EditorialStatus.InProduction,
    EditorialStatus.Published,
    EditorialStatus.Cancelled,
  ],
  [EditorialStatus.Published]: [],
  [EditorialStatus.Cancelled]: [],
};

export const canTransition = (from: EditorialStatus, to: EditorialStatus): boolean =>
  EditorialTransitions[from].includes(to);

export const DirectMoves: Record<EditorialStatus, readonly EditorialStatus[]> = {
  [EditorialStatus.Planning]: [EditorialStatus.InProduction],
  [EditorialStatus.InProduction]: [EditorialStatus.Planning],
  [EditorialStatus.ChangesRequested]: [EditorialStatus.Planning, EditorialStatus.InProduction],
  [EditorialStatus.AwaitingApproval]: [],
  [EditorialStatus.Approved]: [],
  [EditorialStatus.Published]: [],
  [EditorialStatus.Cancelled]: [],
};

export const submitStageOf = (caption: string, mediaCount: number): ApprovalStage =>
  caption.trim() !== "" || mediaCount > 0 ? ApprovalStage.Art : ApprovalStage.Plan;

export const submittableStatuses: readonly EditorialStatus[] = [
  EditorialStatus.Planning,
  EditorialStatus.InProduction,
  EditorialStatus.ChangesRequested,
  EditorialStatus.AwaitingApproval,
];

export const approvableStatuses: readonly EditorialStatus[] = submittableStatuses;

export const reopenableStatuses: readonly EditorialStatus[] = [
  EditorialStatus.Approved,
  EditorialStatus.AwaitingApproval,
  EditorialStatus.ChangesRequested,
];

export const platformFormats: Record<Platform, readonly ContentFormat[]> = {
  [Platform.Instagram]: [
    ContentFormat.Image,
    ContentFormat.Carousel,
    ContentFormat.Story,
    ContentFormat.Reel,
  ],
  [Platform.Facebook]: [
    ContentFormat.Text,
    ContentFormat.Image,
    ContentFormat.Carousel,
    ContentFormat.Video,
    ContentFormat.Story,
    ContentFormat.Reel,
  ],
  [Platform.Linkedin]: [
    ContentFormat.Text,
    ContentFormat.Image,
    ContentFormat.Carousel,
    ContentFormat.Video,
    ContentFormat.Article,
  ],
  [Platform.Tiktok]: [ContentFormat.Video, ContentFormat.Reel],
  [Platform.Youtube]: [ContentFormat.Video, ContentFormat.Reel, ContentFormat.Text],
  [Platform.X]: [ContentFormat.Text, ContentFormat.Image, ContentFormat.Video],
  [Platform.Pinterest]: [ContentFormat.Image, ContentFormat.Carousel, ContentFormat.Video],
  [Platform.Threads]: [
    ContentFormat.Text,
    ContentFormat.Image,
    ContentFormat.Carousel,
    ContentFormat.Video,
  ],
  [Platform.Email]: [ContentFormat.Text, ContentFormat.Article, ContentFormat.Image],
  [Platform.Blog]: [ContentFormat.Article, ContentFormat.Text, ContentFormat.Image],
  [Platform.Other]: Object.values(ContentFormat),
};

export type FormatRule = { min: number; max: number; kinds: readonly MediaKind[] };

export const formatRules: Record<ContentFormat, FormatRule> = {
  [ContentFormat.Image]: { min: 1, max: 10, kinds: [MediaKind.Image, MediaKind.Video] },
  [ContentFormat.Carousel]: { min: 2, max: 20, kinds: [MediaKind.Image, MediaKind.Video] },
  [ContentFormat.Video]: { min: 1, max: 1, kinds: [MediaKind.Video] },
  [ContentFormat.Text]: { min: 0, max: 4, kinds: [MediaKind.Image] },
  [ContentFormat.Story]: { min: 1, max: 10, kinds: [MediaKind.Image, MediaKind.Video] },
  [ContentFormat.Reel]: { min: 1, max: 1, kinds: [MediaKind.Video] },
  [ContentFormat.Article]: { min: 0, max: 10, kinds: [MediaKind.Image] },
  [ContentFormat.Other]: {
    min: 0,
    max: 20,
    kinds: [MediaKind.Image, MediaKind.Video, MediaKind.Document],
  },
};

export const fileCountProblem = (format: ContentFormat, count: number): string | null => {
  const rule = formatRules[format];
  if (count < rule.min) {
    return rule.min === 1
      ? "Adicione ao menos 1 arquivo."
      : `Adicione ao menos ${rule.min} arquivos.`;
  }
  if (count > rule.max) {
    return rule.max === 1
      ? "Este formato aceita 1 arquivo."
      : `Este formato aceita até ${rule.max} arquivos.`;
  }
  return null;
};

export const combinedRule = (formats: readonly ContentFormat[]): FormatRule => {
  const rules = (formats.length === 0 ? [ContentFormat.Other] : formats).map(
    (format) => formatRules[format],
  );
  const kinds = rules
    .map((rule) => rule.kinds)
    .reduce((left, right) => left.filter((kind) => right.includes(kind)));
  return {
    min: Math.max(...rules.map((rule) => rule.min)),
    max: Math.min(...rules.map((rule) => rule.max)),
    kinds,
  };
};

export const mediaProblem = (formats: readonly ContentFormat[], count: number): string | null =>
  formats.map((format) => fileCountProblem(format, count)).find((problem) => problem !== null) ??
  null;

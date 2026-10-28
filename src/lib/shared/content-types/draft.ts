import { ContentTypeColor } from "@/lib/shared/enums";

export type ContentTypeDraft = {
  id: string | undefined;
  name: string;
  color: ContentTypeColor;
  emoji: string;
};

export const emptyContentTypeDraft: ContentTypeDraft = {
  id: undefined,
  name: "",
  color: ContentTypeColor.Violet,
  emoji: "",
};

export const contentTypeInput = (draft: ContentTypeDraft) => ({
  ...(draft.id === undefined ? {} : { id: draft.id }),
  name: draft.name,
  color: draft.color,
  emoji: draft.emoji,
});

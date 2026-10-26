export const PostRanking = {
  Reach: "reach",
  Interactions: "interactions",
  Saves: "saves",
  Shares: "shares",
  Views: "views",
} as const;
export type PostRanking = (typeof PostRanking)[keyof typeof PostRanking];

export const postRankingLabels: Record<PostRanking, string> = {
  [PostRanking.Reach]: "Alcance",
  [PostRanking.Interactions]: "Interações",
  [PostRanking.Saves]: "Salvamentos",
  [PostRanking.Shares]: "Compartilhamentos",
  [PostRanking.Views]: "Visualizações",
};

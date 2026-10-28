export const AuthImage = {
  Social: "social",
  Analytics: "analytics",
  Brand: "brand",
} as const;

export type AuthImage = (typeof AuthImage)[keyof typeof AuthImage];

export const authImageFiles: Record<AuthImage, { src: string; position: string }> = {
  [AuthImage.Social]: { src: "/auth-social.jpg", position: "object-[70%_50%]" },
  [AuthImage.Analytics]: { src: "/auth-analytics.jpg", position: "object-[75%_50%]" },
  [AuthImage.Brand]: { src: "/auth-brand.jpg", position: "object-center" },
};

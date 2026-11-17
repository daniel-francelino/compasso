import { z } from "zod";

export const visualIdentitySchema = z.object({
  colors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(12)
    .default([]),
  fonts: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  guidelinesUrl: z.union([z.literal(""), z.string().url().startsWith("https://")]).default(""),
});

export type VisualIdentity = z.infer<typeof visualIdentitySchema>;

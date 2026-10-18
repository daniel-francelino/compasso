import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const clientEnv = (): ClientEnv =>
  clientEnvSchema.parse({
    VITE_SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"],
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  });

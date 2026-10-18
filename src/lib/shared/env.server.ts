import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const serverEnv = (): ServerEnv =>
  serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  });

const r2EnvSchema = z.object({
  endpoint: z.string().url(),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
});

export type R2Config = z.infer<typeof r2EnvSchema>;

const clean = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim() !== "" ? value.trim() : undefined;

export const r2Config = (): R2Config | null => {
  const accountId = clean(process.env["R2_ACCOUNT_ID"]);
  const endpoint =
    clean(process.env["R2_ENDPOINT"])?.replace(/\/+$/, "") ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const parsed = r2EnvSchema.safeParse({
    endpoint,
    accessKeyId: clean(process.env["R2_ACCESS_KEY_ID"]),
    secretAccessKey: clean(process.env["R2_SECRET_ACCESS_KEY"]),
    bucket: clean(process.env["R2_BUCKET"]),
  });
  return parsed.success ? parsed.data : null;
};
